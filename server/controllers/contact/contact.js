const Contact = require('../../model/schema/contact')
const Lead = require('../../model/schema/lead')
const Deal = require('../../model/schema/deal')
const emailHistory = require('../../model/schema/email')
const MeetingHistory = require('../../model/schema/meeting')
const phoneCall = require('../../model/schema/phoneCall')
const Task = require('../../model/schema/task')
const TextMsg = require('../../model/schema/textMsg')
const DocumentSchema = require('../../model/schema/document')
const { isAdmin, ownerFilter, resolveOwner, scopedQuery } = require('../../utils/access')
const { findPhoneDuplicate, duplicateResponse, buildPhoneIndex } = require('../../utils/duplicates')
const { nameExpr, withFullName, displayName } = require('../../utils/names')
const { normalizePhone, isValidPhone } = require('../../utils/phone')

const MAX_IMPORT_ROWS = 5000;

// Normalizes what the client sends: full name split, phone numbers in national
// form, consent date. Fields managed by the server are dropped.
const prepareContact = (body) => {
    const { _id, deleted, createdDate, updatedDate, allowDuplicate, ...rest } = body || {};
    const data = withFullName(rest);
    ['phoneNumber', 'mobileNumber'].forEach((field) => {
        if (field in data) data[field] = normalizePhone(data[field]);
    });
    // Zalo is usually the phone number, but may be an id or a link
    if (typeof data.zalo === 'string' && /^[\d\s.+()-]+$/.test(data.zalo)) {
        data.zalo = normalizePhone(data.zalo);
    }
    if (data.dataConsent === true && !data.dataConsentDate) {
        data.dataConsentDate = new Date();
    }
    return data;
};

// Admins may knowingly save a number used elsewhere (a couple sharing a phone...)
const mayDuplicate = (req) => isAdmin(req) && req.body?.allowDuplicate === true;

const index = async (req, res) => {
    const query = scopedQuery(req)
    query.deleted = false;

    let allData = await Contact.find(query).populate({
        path: 'createBy',
        match: { deleted: false } // Populate only if createBy.deleted is false
    }).exec()

    const result = allData.filter(item => item.createBy !== null);
    res.send(result)
}

const add = async (req, res) => {
    const data = prepareContact(req.body);
    data.createdDate = new Date();
    data.createBy = resolveOwner(req, data.createBy);
    if (!mayDuplicate(req)) {
        const duplicate = await findPhoneDuplicate([data.phoneNumber, data.mobileNumber]);
        if (duplicate) {
            return res.status(409).json(await duplicateResponse(req, duplicate));
        }
    }
    const contact = new Contact(data);
    await contact.save();
    res.status(200).json(contact);
}

// Bulk import (CSV / Excel file read by the web client). Rows without name or
// with a missing, invalid or already known phone number are skipped and reported.
const importContacts = async (req, res) => {
    if (!Array.isArray(req.body)) {
        return res.status(400).json({ message: 'An array of contacts is expected' });
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
        const data = prepareContact(row);
        const phone = data.phoneNumber;
        if (!displayName(data)) {
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
        const duplicate = [phone, data.mobileNumber].map((number) => number && known.get(number)).find(Boolean);
        if (duplicate) {
            skipped.push(duplicate.importRow
                ? { row: line, phone, reason: 'Trùng số điện thoại trong file', duplicateOfRow: duplicate.importRow }
                : { row: line, phone, reason: 'Số điện thoại đã có trong hệ thống' });
            return;
        }
        [phone, data.mobileNumber].filter(Boolean).forEach((number) => known.set(number, { importRow: line }));
        docs.push({ ...data, createdDate, createBy: resolveOwner(req, data.createBy) });
    });
    const inserted = docs.length ? await Contact.insertMany(docs) : [];
    res.status(200).json({ inserted: inserted.length, skipped });
}

const addPropertyInterest = async (req, res) => {
    const { id } = req.params
    if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: 'An array of property ids is expected' });
    }
    const result = await Contact.updateOne({ _id: id, ...ownerFilter(req) }, { $set: { interestProperty: req.body, updatedDate: new Date() } });
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'No data found.' });
    }
    res.send(' uploaded successfully.');
}

const edit = async (req, res) => {
    // The owner of a contact never changes through edit (the web client sends
    // the id of whoever is editing as createBy)
    const { createBy, ...data } = prepareContact(req.body);
    const contact = await Contact.findOne({ _id: req.params.id, deleted: { $ne: true }, ...ownerFilter(req) });
    if (!contact) {
        return res.status(404).json({ message: 'No data found.' });
    }
    // Only new numbers are checked: older duplicates must not block other changes
    const current = [contact.phoneNumber, contact.mobileNumber].map(normalizePhone);
    const added = [data.phoneNumber, data.mobileNumber].filter((phone) => phone && !current.includes(phone));
    if (added.length && !mayDuplicate(req)) {
        const duplicate = await findPhoneDuplicate(added, { excludeContact: contact._id });
        if (duplicate) {
            return res.status(409).json(await duplicateResponse(req, duplicate));
        }
    }
    const result = await Contact.updateOne(
        { _id: contact._id },
        { $set: { ...data, updatedDate: new Date() } },
        { runValidators: true }
    );
    res.status(200).json(result);
}

const view = async (req, res) => {
    let contact = await Contact.findOne({ _id: req.params.id, deleted: { $ne: true }, ...ownerFilter(req) })
        .populate('createBy', 'fullName firstName lastName username');
    if (!contact) return res.status(404).json({ message: 'No data found.' })
    let interestProperty = await Contact.findOne({ _id: contact._id }).populate({ path: 'interestProperty', match: { deleted: false } })
    const name = displayName(contact);

    // The history of the leads converted into this contact is part of its history
    const leadIds = await Lead.distinct('_id', { convertedContact: contact._id });

    let EmailHistory = await emailHistory.aggregate([
        { $match: { $or: [{ createBy: contact._id }, { createByLead: { $in: leadIds } }] } },
        { $lookup: { from: 'users', localField: 'sender', foreignField: '_id', as: 'users' } },
        { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
        { $match: { 'users.deleted': false } },
        { $addFields: { senderName: nameExpr('$users'), deleted: false, createByName: name } },
        { $project: { users: 0 } },
        { $sort: { timestamp: -1 } },
    ]);
    let phoneCallHistory = await phoneCall.aggregate([
        { $match: { $or: [{ createBy: contact._id }, { createByLead: { $in: leadIds } }] } },
        { $lookup: { from: 'users', localField: 'sender', foreignField: '_id', as: 'users' } },
        { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
        { $addFields: { senderName: nameExpr('$users'), deleted: false, createByName: name } },
        { $project: { users: 0 } },
        { $sort: { timestamp: -1 } },
    ]);
    let meetingHistory = await MeetingHistory.aggregate([
        { $match: { $or: [{ attendes: contact._id }, { attendesLead: { $in: leadIds } }], deleted: { $ne: true } } },
        { $lookup: { from: 'users', localField: 'createdBy', foreignField: '_id', as: 'users' } },
        { $lookup: { from: 'properties', localField: 'property', foreignField: '_id', as: 'propertyRef' } },
        { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$propertyRef', preserveNullAndEmptyArrays: true } },
        {
            $addFields: {
                attendesArray: [name],
                createdByName: nameExpr('$users'),
                propertyName: { $ifNull: ['$propertyRef.title', '$propertyRef.propertyAddress'] },
                propertyCode: '$propertyRef.code',
            }
        },
        { $project: { users: 0, propertyRef: 0 } },
        { $sort: { dateTime: -1 } },
    ]);
    let textMsg = await TextMsg.aggregate([
        { $match: { createFor: contact._id } },
        { $lookup: { from: 'users', localField: 'sender', foreignField: '_id', as: 'users' } },
        { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
        { $addFields: { sender: '$users.username', deleted: false, createByName: name } },
        { $project: { users: 0 } },
    ]);

    let task = await Task.aggregate([
        { $match: { $or: [{ assignmentTo: contact._id }, { assignmentToLead: { $in: leadIds } }], deleted: false } },
        { $lookup: { from: 'users', localField: 'createBy', foreignField: '_id', as: 'users' } },
        { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
        { $addFields: { assignmentToName: name, createByName: nameExpr('$users') } },
        { $project: { users: 0 } },
        { $sort: { start: -1 } },
    ])

    const Document = await DocumentSchema.aggregate([
        { $unwind: '$file' },
        { $match: { 'file.deleted': false, $or: [{ 'file.linkContact': contact._id }, { 'file.linkLead': { $in: leadIds } }] } },
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

    const deals = await Deal.find({ contact: contact._id, deleted: false })
        .populate('property', 'code title propertyAddress propertyType')
        .sort({ createdDate: -1 });

    res.status(200).json({ interestProperty, contact, EmailHistory, phoneCallHistory, meetingHistory, textMsg, task, Document, deals });
}

const deleteData = async (req, res) => {
    const contact = await Contact.findOneAndUpdate({ _id: req.params.id, ...ownerFilter(req) }, { deleted: true, updatedDate: new Date() });
    if (!contact) {
        return res.status(404).json({ message: 'No data found.' })
    }
    res.status(200).json({ message: "done", contact })
}

const deleteMany = async (req, res) => {
    if (!Array.isArray(req.body)) {
        return res.status(400).json({ message: 'An array of ids is expected' })
    }
    const contact = await Contact.updateMany({ _id: { $in: req.body }, ...ownerFilter(req) }, { $set: { deleted: true, updatedDate: new Date() } });
    res.status(200).json({ message: "done", contact })
}

module.exports = { index, add, importContacts, addPropertyInterest, view, edit, deleteData, deleteMany }
