const mongoose = require('mongoose');
const Contact = require('../model/schema/contact');
const Lead = require('../model/schema/lead');
const User = require('../model/schema/user');
const { isAdmin } = require('./access');
const { displayName } = require('./names');
const { normalizePhone, phoneFilter } = require('./phone');

const notId = (id) => ({ $ne: new mongoose.Types.ObjectId(String(id)) });

// Customers belong to the employee who brought them in: a phone number already
// used by a contact, or by a lead not converted yet, of anyone in the company is
// a duplicate. The native collections are queried because numbers saved by older
// versions are numbers, which mongoose would cast to strings.
const findPhoneDuplicate = async (phones, { excludeContact, excludeLead } = {}) => {
    const numbers = [...new Set(phones.filter(Boolean))];
    for (const phone of numbers) {
        const contactFilter = phoneFilter(['phoneNumber', 'mobileNumber'], phone);
        if (!contactFilter) continue;
        const contactQuery = { deleted: { $ne: true }, ...contactFilter };
        if (excludeContact) contactQuery._id = notId(excludeContact);
        const contact = await Contact.collection.findOne(contactQuery, { projection: { fullName: 1, firstName: 1, lastName: 1, createBy: 1 } });
        if (contact) return { type: 'contact', phone, record: contact };

        const leadQuery = { deleted: { $ne: true }, leadStatus: { $ne: 'converted' }, ...phoneFilter(['leadPhoneNumber'], phone) };
        if (excludeLead) leadQuery._id = notId(excludeLead);
        const lead = await Lead.collection.findOne(leadQuery, { projection: { leadName: 1, createBy: 1 } });
        if (lead) return { type: 'lead', phone, record: lead };
    }
    return null;
};

// Body of the 409 answer. The record is only identified when the caller may open
// it, otherwise only the employee in charge is named.
const duplicateResponse = async (req, { type, phone, record }) => {
    const owner = record.createBy ? await User.findById(record.createBy).select('fullName firstName lastName username') : null;
    const ownerName = displayName(owner) || owner?.username || '';
    const visible = isAdmin(req) || String(record.createBy) === req.user.userId;
    const name = type === 'contact' ? displayName(record) : (record.leadName || '');
    const kind = type === 'contact' ? 'khách hàng' : 'khách tiềm năng';
    const inCharge = ownerName ? ` (phụ trách: ${ownerName})` : '';
    return {
        message: visible
            ? `Số điện thoại ${phone} đã có trong hệ thống: ${kind} ${name}${inCharge}`
            : `Số điện thoại ${phone} đã có trong hệ thống${inCharge}`,
        duplicate: { type, phone, ownerName, ...(visible && { _id: record._id, name }) },
    };
};

// Every number in use (normalized) with its record, to check the rows of a bulk
// import without one query per row
const buildPhoneIndex = async () => {
    const index = new Map();
    const contacts = await Contact.collection
        .find({ deleted: { $ne: true } }, { projection: { phoneNumber: 1, mobileNumber: 1, createBy: 1, fullName: 1, firstName: 1, lastName: 1 } })
        .toArray();
    contacts.forEach((record) => [record.phoneNumber, record.mobileNumber].forEach((phone) => {
        const normalized = normalizePhone(phone);
        if (normalized) index.set(normalized, { type: 'contact', record });
    }));
    const leads = await Lead.collection
        .find({ deleted: { $ne: true }, leadStatus: { $ne: 'converted' } }, { projection: { leadPhoneNumber: 1, createBy: 1, leadName: 1 } })
        .toArray();
    leads.forEach((record) => {
        const normalized = normalizePhone(record.leadPhoneNumber);
        if (normalized && !index.has(normalized)) index.set(normalized, { type: 'lead', record });
    });
    return index;
};

module.exports = { findPhoneDuplicate, duplicateResponse, buildPhoneIndex };
