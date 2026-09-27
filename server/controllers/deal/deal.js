const Deal = require('../../model/schema/deal')
const Contact = require('../../model/schema/contact')
const Property = require('../../model/schema/property')
const User = require('../../model/schema/user')
const { isAdmin, isValidId, ownerFilter, resolveOwner, sanitizeQuery, sharedInventory } = require('../../utils/access')
const { dealVisibility } = require('../../utils/deals')
const { displayName } = require('../../utils/names')
const { nextCode } = require('../../utils/sequence')

const DEAL_TYPES = ['sale', 'rent'];
const DEAL_STATUSES = ['negotiating', 'deposit', 'contract', 'completed', 'cancelled'];
// Deals holding the property: deposit paid, contract signed, handed over
const ACTIVE_STATUSES = ['deposit', 'contract', 'completed'];
const COMMISSION_STATUSES = ['pending', 'partial', 'received'];
const SPLIT_ROLES = ['listing', 'selling', 'support', 'manager'];
const MONEY_FIELDS = ['price', 'depositAmount', 'commissionAmount'];
const DATE_FIELDS = ['depositDate', 'contractDueDate', 'contractDate', 'completedDate', 'commissionReceivedDate'];
const FIELDS = [
    'title', 'dealType', 'status', 'contact', 'property', 'price', 'depositAmount', 'depositDate', 'contractDueDate',
    'contractNumber', 'contractDate', 'completedDate', 'payments', 'commissionRate', 'commissionAmount', 'commissionStatus',
    'commissionReceivedDate', 'commissionSplits', 'cancelReason', 'notes',
];

const POPULATE = [
    { path: 'contact', select: 'fullName firstName lastName title phoneNumber email createBy' },
    { path: 'property', select: 'code title propertyAddress propertyType transactionType price area listingStatus createBy' },
    { path: 'createBy', select: 'fullName firstName lastName username' },
    { path: 'commissionSplits.user', select: 'fullName firstName lastName username' },
];

const isEmpty = (value) => value === undefined || value === null || value === '';

// Keeps the known fields; empty strings become null (cleared)
const pickFields = (body) => Object.fromEntries(
    FIELDS.filter((field) => field in (body || {})).map((field) => [field, isEmpty(body[field]) ? null : body[field]])
);

const invalidNumber = (value, max = Infinity) => !isEmpty(value) && !(Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= max);

// Returns the reason why the data cannot be saved, or null
const validate = (data) => {
    if ('dealType' in data && !DEAL_TYPES.includes(data.dealType)) return 'Loại giao dịch không hợp lệ';
    if ('status' in data && !DEAL_STATUSES.includes(data.status)) return 'Trạng thái giao dịch không hợp lệ';
    if ('commissionStatus' in data && data.commissionStatus !== null && !COMMISSION_STATUSES.includes(data.commissionStatus)) return 'Trạng thái hoa hồng không hợp lệ';
    if ('contact' in data && !isValidId(data.contact)) return 'Khách hàng không hợp lệ';
    if (data.property && !isValidId(data.property)) return 'Bất động sản không hợp lệ';
    if (MONEY_FIELDS.some((field) => invalidNumber(data[field]))) return 'Số tiền không hợp lệ';
    if (invalidNumber(data.commissionRate, 100)) return 'Tỷ lệ hoa hồng phải từ 0 đến 100%';
    if (DATE_FIELDS.some((field) => !isEmpty(data[field]) && Number.isNaN(new Date(data[field]).getTime()))) return 'Ngày không hợp lệ';
    if ('payments' in data && data.payments !== null) {
        if (!Array.isArray(data.payments)) return 'Lịch thanh toán không hợp lệ';
        if (data.payments.some((p) => !p || typeof p !== 'object' || invalidNumber(p.amount))) return 'Lịch thanh toán không hợp lệ';
    }
    if ('commissionSplits' in data && data.commissionSplits !== null) {
        const splits = data.commissionSplits;
        if (!Array.isArray(splits)) return 'Chia hoa hồng không hợp lệ';
        if (splits.some((s) => !s || typeof s !== 'object' || !isValidId(s.user) || invalidNumber(s.percent, 100) || (s.role && !SPLIT_ROLES.includes(s.role)))) {
            return 'Chia hoa hồng không hợp lệ';
        }
        const total = splits.reduce((sum, s) => sum + Number(s.percent || 0), 0);
        if (total > 100.0001) return 'Tổng tỷ lệ chia hoa hồng vượt quá 100%';
    }
    return null;
};

// Commission computed from the rate when no amount is given, amounts of the
// shares computed from their percentage, dates of the steps filled in
const applyDerivedValues = (deal, statusChanged) => {
    if (isEmpty(deal.commissionAmount) && !isEmpty(deal.price) && !isEmpty(deal.commissionRate)) {
        deal.commissionAmount = Math.round((Number(deal.price) * Number(deal.commissionRate)) / 100);
    }
    const total = Number(deal.commissionAmount || 0);
    (deal.commissionSplits || []).forEach((split) => {
        split.amount = Math.round((total * Number(split.percent || 0)) / 100);
    });
    if (statusChanged) {
        const now = new Date();
        if (deal.status === 'deposit' && !deal.depositDate) deal.depositDate = now;
        if (deal.status === 'contract' && !deal.contractDate) deal.contractDate = now;
        if (deal.status === 'completed' && !deal.completedDate) deal.completedDate = now;
    }
    if (deal.commissionStatus === 'received' && !deal.commissionReceivedDate) {
        deal.commissionReceivedDate = new Date();
    }
};

// The customer must be one the caller manages, the property one they can see
const checkReferences = async (req, data, owner) => {
    if (data.contact) {
        const contact = await Contact.findOne({ _id: data.contact, deleted: { $ne: true } });
        if (!contact) return { status: 400, message: 'Không tìm thấy khách hàng' };
        if (!isAdmin(req) && String(contact.createBy) !== String(owner)) {
            return { status: 403, message: 'Bạn chỉ có thể tạo giao dịch cho khách hàng của mình' };
        }
    }
    if (data.property) {
        const filter = { _id: data.property, deleted: false, ...(sharedInventory() ? {} : ownerFilter(req)) };
        if (!await Property.exists(filter)) return { status: 400, message: 'Không tìm thấy bất động sản' };
    }
    const userIds = [...new Set((data.commissionSplits || []).map((split) => String(split.user)))];
    if (userIds.length && await User.countDocuments({ _id: { $in: userIds }, deleted: false }) !== userIds.length) {
        return { status: 400, message: 'Nhân viên nhận hoa hồng không hợp lệ' };
    }
    return null;
};

const defaultTitle = async (deal) => {
    const [contact, property] = await Promise.all([
        deal.contact ? Contact.findById(deal.contact).select('fullName firstName lastName') : null,
        deal.property ? Property.findById(deal.property).select('code title propertyAddress') : null,
    ]);
    const what = property ? (property.code || property.title || property.propertyAddress) : '';
    const action = deal.dealType === 'rent' ? 'Cho thuê' : 'Bán';
    return [`${action}${what ? ` ${what}` : ''}`, displayName(contact)].filter(Boolean).join(' - ');
};

// The property is deposited / sold / rented while a deal holds it, and available
// again when the deals holding it are cancelled (if a deal had set its status)
const refreshPropertyStatus = async (propertyId) => {
    if (!propertyId) return;
    const property = await Property.findOne({ _id: propertyId, deleted: false });
    if (!property) return;
    const deals = await Deal.find({ property: propertyId, deleted: false, status: { $in: ACTIVE_STATUSES } }).sort({ updatedDate: -1 });
    const signed = deals.find((deal) => deal.status === 'contract' || deal.status === 'completed');
    let status = null;
    if (signed) {
        status = signed.dealType === 'rent' ? 'rented' : 'sold';
    } else if (deals.length) {
        status = 'deposited';
    }
    if (status && property.listingStatus !== status) {
        await Property.updateOne({ _id: propertyId }, { $set: { listingStatus: status, statusSetByDeal: true, updatedDate: new Date() } });
    } else if (!status && property.statusSetByDeal) {
        await Property.updateOne({ _id: propertyId }, { $set: { listingStatus: 'available', statusSetByDeal: false, updatedDate: new Date() } });
    }
};

const CONTACT_STATUS = { deposit: 'deposited', contract: 'closed', completed: 'closed' };

const refreshContactStatus = async (deal) => {
    const status = CONTACT_STATUS[deal.status];
    if (status && deal.contact) {
        await Contact.updateOne({ _id: deal.contact }, { $set: { leadStatus: status, updatedDate: new Date() } });
    }
};

const present = (req, deal) => {
    const data = deal.toJSON();
    data.canEdit = isAdmin(req) || String(deal.createBy?._id ?? deal.createBy) === String(req.user.userId);
    return data;
};

const index = async (req, res) => {
    const { createBy, ...filters } = sanitizeQuery(req.query);
    const query = { ...filters, deleted: false, ...dealVisibility(req) };
    // Admins may list the deals of one employee
    if (createBy && isAdmin(req)) query.createBy = createBy;
    const deals = await Deal.find(query).populate(POPULATE).sort({ createdDate: -1 });
    res.status(200).json(deals.map((deal) => present(req, deal)));
}

const view = async (req, res) => {
    const deal = await Deal.findOne({ _id: req.params.id, deleted: false, ...dealVisibility(req) }).populate(POPULATE);
    if (!deal) return res.status(404).json({ message: 'Không tìm thấy giao dịch' });
    res.status(200).json(present(req, deal));
}

const add = async (req, res) => {
    const data = pickFields(req.body);
    if (!data.contact) {
        return res.status(400).json({ message: 'Chọn khách hàng của giao dịch' });
    }
    const invalid = validate(data);
    if (invalid) return res.status(400).json({ message: invalid });

    const owner = resolveOwner(req, req.body.createBy);
    const rejected = await checkReferences(req, data, owner);
    if (rejected) return res.status(rejected.status).json({ message: rejected.message });

    const deal = new Deal({ ...data, createBy: owner, createdDate: new Date() });
    applyDerivedValues(deal, true);
    if (!deal.title) deal.title = await defaultTitle(deal);
    await deal.validate();
    deal.code = await nextCode('deal', 'GD');
    await deal.save();

    await refreshPropertyStatus(deal.property);
    await refreshContactStatus(deal);
    res.status(200).json(deal);
}

const edit = async (req, res) => {
    const data = pickFields(req.body);
    const invalid = validate(data);
    if (invalid) return res.status(400).json({ message: invalid });

    // Only the employee managing the deal and admins may change it
    const deal = await Deal.findOne({ _id: req.params.id, deleted: false, ...ownerFilter(req) });
    if (!deal) return res.status(404).json({ message: 'Không tìm thấy giao dịch' });

    if ('contact' in data && data.contact === null) {
        return res.status(400).json({ message: 'Chọn khách hàng của giao dịch' });
    }
    const changedReferences = {
        ...(data.contact && String(data.contact) !== String(deal.contact) && { contact: data.contact }),
        ...(data.property && String(data.property) !== String(deal.property) && { property: data.property }),
        ...(data.commissionSplits && { commissionSplits: data.commissionSplits }),
    };
    const rejected = await checkReferences(req, changedReferences, deal.createBy);
    if (rejected) return res.status(rejected.status).json({ message: rejected.message });

    const previousProperty = deal.property;
    const previousStatus = deal.status;
    // Cleared values are removed, the commission is recomputed from the rate
    Object.entries(data).forEach(([field, value]) => deal.set(field, value === null ? undefined : value));
    if (!('commissionAmount' in data) && ('price' in data || 'commissionRate' in data) && !isEmpty(deal.commissionRate)) {
        deal.commissionAmount = undefined;
    }
    applyDerivedValues(deal, deal.status !== previousStatus);
    if (!deal.title) deal.title = await defaultTitle(deal);
    deal.updatedDate = new Date();
    await deal.save();

    await refreshPropertyStatus(deal.property);
    if (previousProperty && String(previousProperty) !== String(deal.property)) {
        await refreshPropertyStatus(previousProperty);
    }
    if (deal.status !== previousStatus) {
        await refreshContactStatus(deal);
    }
    res.status(200).json(deal);
}

const deleteData = async (req, res) => {
    const deal = await Deal.findOneAndUpdate(
        { _id: req.params.id, deleted: false, ...ownerFilter(req) },
        { deleted: true, updatedDate: new Date() }
    );
    if (!deal) return res.status(404).json({ message: 'Không tìm thấy giao dịch' });
    await refreshPropertyStatus(deal.property);
    res.status(200).json({ message: 'done' });
}

const deleteMany = async (req, res) => {
    if (!Array.isArray(req.body) || !req.body.every((id) => isValidId(id))) {
        return res.status(400).json({ message: 'An array of ids is expected' });
    }
    const deals = await Deal.find({ _id: { $in: req.body }, deleted: false, ...ownerFilter(req) });
    await Deal.updateMany({ _id: { $in: deals.map((deal) => deal._id) } }, { $set: { deleted: true, updatedDate: new Date() } });
    const properties = [...new Set(deals.map((deal) => deal.property).filter(Boolean).map(String))];
    for (const property of properties) {
        await refreshPropertyStatus(property);
    }
    res.status(200).json({ message: 'done', deleted: deals.length });
}

module.exports = { index, view, add, edit, deleteData, deleteMany }
