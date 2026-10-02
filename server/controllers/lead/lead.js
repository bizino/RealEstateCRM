const Lead = require('../../model/schema/lead')
const Contact = require('../../model/schema/contact')
const EmailHistory = require('../../model/schema/email');
const PhoneCall = require('../../model/schema/phoneCall');
const Task = require('../../model/schema/task')
const MeetingHistory = require('../../model/schema/meeting')
const DocumentSchema = require('../../model/schema/document')
const { isAdmin, ownerFilter, resolveOwner, scopedQuery } = require('../../utils/access')
const { findPhoneDuplicate, duplicateResponse, buildPhoneIndex } = require('../../utils/duplicates')
const { nameExpr, withFullName } = require('../../utils/names')
const { normalizePhone, isValidPhone } = require('../../utils/phone')

const MAX_IMPORT_ROWS = 5000;

// Normalizes what the client sends; fields managed by the server are dropped
const prepareLead = (body) => {
    const { _id, deleted, createdDate, updatedDate, allowDuplicate, convertedContact, ...data } = body || {};
    if ('leadPhoneNumber' in data) data.leadPhoneNumber = normalizePhone(data.leadPhoneNumber);
    if (typeof data.leadName === 'string') data.leadName = data.leadName.trim().replace(/\s+/g, ' ');
    return data;
};

// Admins may knowingly save a number used elsewhere
const mayDuplicate = (req) => isAdmin(req) && req.body?.allowDuplicate === true;

const index = async (req, res) => {
    const query = scopedQuery(req)
    query.deleted = false;

    let allData = await Lead.find(query).populate({
        path: 'createBy',
        match: { deleted: false } // Populate only if createBy.deleted is false
    }).exec()

    const result = allData.filter(item => item.createBy !== null);
    res.send(result)
}

const addMany = async (req, res) => {
    if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: 'An array of leads is expected' });
    }
    const createdDate = new Date();
    const data = req.body.map((lead) => {
        const prepared = prepareLead(lead);
        return { ...prepared, createdDate, createBy: resolveOwner(req, prepared.createBy) };
    });
    const insertedLead = await Lead.insertMany(data);
    res.status(200).json(insertedLead);
};

// Bulk import (CSV / Excel file read by the web client, ad campaign exports...).
// Rows without name or with a missing, invalid or already known phone number are
// skipped and reported.
const importLeads = async (req, res) => {
    if (!Array.isArray(req.body)) {
        return res.status(400).json({ message: 'An array of leads is expected' });
    }
    if (req.body.length > MAX_IMPORT_ROWS) {
        return res.status(400).json({ message: `Tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần nhập` });
    }
    const known = await buildPhoneIndex();
    const createdDate = new Date();
    const skipped = [];
    const docs = [];
    req.body.forEach((row, index) => {
        const line = index + 1;
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
            skipped.push({ row: line, reason: 'Dòng không hợp lệ' });
            return;
        }
        const data = prepareLead(row);
        const phone = data.leadPhoneNumber;
        if (!data.leadName) {
            skipped.push({ row: line, phone, reason: 'Thiếu họ tên' });
            return;
        }
        if (!phone) {
            skipped.push({ row: line, reason: 'Thiếu số điện thoại' });
            return;
        }
        if (!isValidPhone(phone)) {
            skipped.push({ row: line, phone, reason: 'Số điện thoại không hợp lệ' });
            return;
        }
        const duplicate = known.get(phone);
        if (duplicate) {
            skipped.push(duplicate.importRow
                ? { row: line, phone, reason: 'Trùng số điện thoại trong file', duplicateOfRow: duplicate.importRow }
                : { row: line, phone, reason: 'Số điện thoại đã có trong hệ thống' });
            return;
        }
        known.set(phone, { importRow: line });
        docs.push({ leadStatus: 'new', ...data, createdDate, createBy: resolveOwner(req, data.createBy) });
    });
    const inserted = docs.length ? await Lead.insertMany(docs) : [];
    res.status(200).json({ inserted: inserted.length, skipped });
}

const add = async (req, res) => {
    const data = prepareLead(req.body);
    data.createdDate = new Date();
    data.createBy = resolveOwner(req, data.createBy);
    if (!mayDuplicate(req)) {
        const duplicate = await findPhoneDuplicate([data.leadPhoneNumber]);
        if (duplicate) {
            return res.status(409).json(await duplicateResponse(req, duplicate));
        }
    }
    const lead = new Lead(data);
    await lead.save();
    res.status(200).json(lead);
}

const edit = async (req, res) => {
    // The owner never changes through edit (the web client sends the id of
    // whoever is editing as createBy)
    const { createBy, ...data } = prepareLead(req.body);
    const lead = await Lead.findOne({ _id: req.params.id, deleted: { $ne: true }, ...ownerFilter(req) });
    if (!lead) {
        return res.status(404).json({ message: 'no Data Found.' });
    }
    const phone = data.leadPhoneNumber;
    if (phone && phone !== normalizePhone(lead.leadPhoneNumber) && !mayDuplicate(req)) {
        const duplicate = await findPhoneDuplicate([phone], { excludeLead: lead._id });
        if (duplicate) {
            return res.status(409).json(await duplicateResponse(req, duplicate));
        }
    }
    const result = await Lead.updateOne(
        { _id: lead._id },
        { $set: { ...data, updatedDate: new Date() } },
        { runValidators: true }
    );
    res.status(200).json(result);
}

// Turns a qualified lead into a contact (khách hàng). When a contact already uses
// the phone number the lead is linked to it instead of creating a duplicate.
const convert = async (req, res) => {
    const lead = await Lead.findOne({ _id: req.params.id, deleted: { $ne: true }, ...ownerFilter(req) });
    if (!lead) {
        return res.status(404).json({ message: 'no Data Found.' });
    }
    if (lead.leadStatus === 'converted' && lead.convertedContact) {
        return res.status(400).json({ message: 'Khách tiềm năng này đã được chuyển thành khách hàng', contactId: lead.convertedContact });
    }

    const phone = normalizePhone(lead.leadPhoneNumber);
    let contact = null;
    let existing = false;
    if (phone) {
        const duplicate = await findPhoneDuplicate([phone], { excludeLead: lead._id });
        if (duplicate?.type === 'contact') {
            const visible = isAdmin(req) || String(duplicate.record.createBy) === req.user.userId;
            if (!visible) {
                return res.status(409).json(await duplicateResponse(req, duplicate));
            }
            contact = await Contact.findById(duplicate.record._id);
            existing = true;
        }
    }
    if (!contact) {
        contact = await Contact.create({
            ...withFullName({ fullName: lead.leadName || '' }),
            phoneNumber: phone,
            email: lead.leadEmail,
            physicalAddress: lead.leadAddress,
            leadSource: lead.leadSource,
            leadStatus: 'consulting',
            customerType: lead.customerType,
            budgetFrom: lead.budgetFrom,
            budgetTo: lead.budgetTo,
            interestedArea: lead.interestedArea,
            interestedPropertyType: lead.interestedPropertyType,
            notesandComments: lead.leadNotes,
            createBy: lead.createBy,
            createdDate: new Date(),
        });
    }
    const now = new Date();
    await Lead.updateOne(
        { _id: lead._id },
        { $set: { leadStatus: 'converted', convertedContact: contact._id, leadConversionDate: now, updatedDate: now } }
    );
    res.status(200).json({ contact, existing });
}

const view = async (req, res) => {
    let lead = await Lead.findOne({ _id: req.params.id, deleted: { $ne: true }, ...ownerFilter(req) })
        .populate('createBy', 'fullName firstName lastName username')
    if (!lead) return res.status(404).json({ message: "no Data Found." })

    let Email = await EmailHistory.aggregate([
        { $match: { createByLead: lead._id } },
        { $lookup: { from: 'users', localField: 'sender', foreignField: '_id', as: 'users' } },
        { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
        { $match: { 'users.deleted': false } },
        { $addFields: { senderName: nameExpr('$users'), deleted: false, createByName: lead.leadName || '' } },
        { $project: { users: 0 } },
        { $sort: { timestamp: -1 } },
    ])

    let phoneCall = await PhoneCall.aggregate([
        { $match: { createByLead: lead._id } },
        { $lookup: { from: 'users', localField: 'sender', foreignField: '_id', as: 'users' } },
        { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
        { $match: { 'users.deleted': false } },
        { $addFields: { senderName: nameExpr('$users'), deleted: false, createByName: lead.leadName || '' } },
        { $project: { users: 0 } },
        { $sort: { timestamp: -1 } },
    ])

    let task = await Task.aggregate([
        { $match: { assignmentToLead: lead._id, deleted: false } },
        { $lookup: { from: 'users', localField: 'createBy', foreignField: '_id', as: 'users' } },
        { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
        { $addFields: { assignmentToName: lead.leadName || '', createByName: nameExpr('$users') } },
        { $project: { users: 0 } },
        { $sort: { start: -1 } },
    ])

    let meeting = await MeetingHistory.aggregate([
        { $match: { attendesLead: lead._id, deleted: { $ne: true } } },
        { $lookup: { from: 'users', localField: 'createdBy', foreignField: '_id', as: 'users' } },
        { $lookup: { from: 'properties', localField: 'property', foreignField: '_id', as: 'propertyRef' } },
        { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$propertyRef', preserveNullAndEmptyArrays: true } },
        {
            $addFields: {
                attendesArray: [lead.leadName || ''],
                createdByName: nameExpr('$users'),
                propertyName: { $ifNull: ['$propertyRef.title', '$propertyRef.propertyAddress'] },
                propertyCode: '$propertyRef.code',
            }
        },
        { $project: { users: 0, propertyRef: 0 } },
        { $sort: { dateTime: -1 } },
    ]);
    const Document = await DocumentSchema.aggregate([
        { $unwind: '$file' },
        { $match: { 'file.deleted': false, 'file.linkLead': lead._id } },
        { $lookup: { from: 'users', localField: 'createBy', foreignField: '_id', as: 'creatorInfo' } },
        { $unwind: { path: '$creatorInfo', preserveNullAndEmptyArrays: true } },
        { $match: { 'creatorInfo.deleted': false } },
        {
            $group: {
                _id: '$_id',  // Group by the document _id (folder's _id)
                folderName: { $first: '$folderName' },
                createByName: { $first: nameExpr('$creatorInfo') },
                files: { $push: '$file' }, // Push the matching files back into an array
            }
        },
    ]);

    res.status(200).json({ lead, Email, phoneCall, task, meeting, Document })
}

const deleteData = async (req, res) => {
    const lead = await Lead.findOneAndUpdate({ _id: req.params.id, ...ownerFilter(req) }, { deleted: true, updatedDate: new Date() });
    if (!lead) {
        return res.status(404).json({ message: "no Data Found." })
    }
    res.status(200).json({ message: "done", lead })
}

const deleteMany = async (req, res) => {
    if (!Array.isArray(req.body)) {
        return res.status(400).json({ message: 'An array of ids is expected' })
    }
    const lead = await Lead.updateMany({ _id: { $in: req.body }, ...ownerFilter(req) }, { $set: { deleted: true, updatedDate: new Date() } });
    res.status(200).json({ message: "done", lead })
}

module.exports = { index, add, addMany, importLeads, convert, view, edit, deleteData, deleteMany }
