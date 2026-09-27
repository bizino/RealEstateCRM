const mongoose = require('mongoose');
const Contact = require('../../model/schema/contact');
const Lead = require('../../model/schema/lead');
const Property = require('../../model/schema/property');
const Deal = require('../../model/schema/deal');
const User = require('../../model/schema/user');
const { isAdmin } = require('../../utils/access');
const { dealVisibility } = require('../../utils/deals');
const { displayName } = require('../../utils/names');

// Months of the charts are the months of the company, not of the server
const timeZone = () => process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh';

const DEAL_STATUSES = ['negotiating', 'deposit', 'contract', 'completed', 'cancelled'];
const CLOSED_STATUSES = ['contract', 'completed'];
// Codes of older versions counted with their current equivalent
const PROPERTY_STATUS = { active: 'available', pending: 'deposited' };
const CONTACT_STATUS = { newLead: 'new', qualifiedLead: 'consulting', negotiatingLead: 'negotiating' };
const LEAD_SOURCE = {
    referrals: 'referral', eventsAndTradeShows: 'event', callCentersOrTelemarketing: 'telesale', onlineAggregatorsOrComparisonWebsites: 'portal',
};

const parseDate = (value, fallback) => {
    if (value === undefined || value === '') return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const monthKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: timeZone(), year: 'numeric', month: '2-digit' })
    .format(date).slice(0, 7);

// The 12 months ending with the month of `to`, oldest first ("2026-09")
const lastMonths = (to, count = 12) => {
    const [year, month] = monthKey(to).split('-').map(Number);
    return Array.from({ length: count }, (_, index) => {
        const date = new Date(Date.UTC(year, month - 1 - (count - 1 - index), 15));
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    });
};

// A deal counts in the period when its contract is signed (or, for older data
// without dates, when it was deposited / created)
const closingDate = (deal) => deal.contractDate || deal.completedDate || deal.depositDate || deal.createdDate;

const inPeriod = (date, from, to) => date && date >= from && date <= to;

const countBy = (rows) => rows.map((row) => ({ key: row._id ?? null, count: row.count }));

const summary = async (req, res) => {
    const now = new Date();
    const from = parseDate(req.query.from, new Date(now.getFullYear(), now.getMonth(), 1));
    const to = parseDate(req.query.to, now);
    if (!from || !to || from > to) {
        return res.status(400).json({ message: 'Khoảng thời gian không hợp lệ' });
    }

    const admin = isAdmin(req);
    const me = new mongoose.Types.ObjectId(req.user.userId);
    // Regular users get the figures of their own customers, listings and deals
    const scope = admin ? {} : { createBy: me };
    const created = { createdDate: { $gte: from, $lte: to } };

    const [
        contactTotal, contactNew, leadOpen, leadNew, leadConverted,
        propertyRows, contactSources, leadSources, contactStatuses, deals,
    ] = await Promise.all([
        Contact.countDocuments({ deleted: false, ...scope }),
        Contact.countDocuments({ deleted: false, ...scope, ...created }),
        Lead.countDocuments({ deleted: false, ...scope, leadStatus: { $nin: ['converted', 'lost'] } }),
        Lead.countDocuments({ deleted: false, ...scope, ...created }),
        Lead.countDocuments({ deleted: false, ...scope, leadConversionDate: { $gte: from, $lte: to } }),
        Property.aggregate([{ $match: { deleted: false, ...scope } }, { $group: { _id: '$listingStatus', count: { $sum: 1 } } }]),
        Contact.aggregate([{ $match: { deleted: false, ...scope, ...created } }, { $group: { _id: '$leadSource', count: { $sum: 1 } } }]),
        Lead.aggregate([{ $match: { deleted: false, ...scope, ...created } }, { $group: { _id: '$leadSource', count: { $sum: 1 } } }]),
        Contact.aggregate([{ $match: { deleted: false, ...scope } }, { $group: { _id: '$leadStatus', count: { $sum: 1 } } }]),
        Deal.find({ deleted: false, ...dealVisibility(req) }).lean(),
    ]);

    // Listings by status
    const byStatus = { available: 0, deposited: 0, sold: 0, rented: 0, paused: 0 };
    let propertyTotal = 0;
    propertyRows.forEach(({ _id, count }) => {
        const status = PROPERTY_STATUS[_id] || _id || 'available';
        byStatus[status] = (byStatus[status] || 0) + count;
        propertyTotal += count;
    });

    // Deals: pipeline (all time) and results of the period
    const dealsByStatus = Object.fromEntries(DEAL_STATUSES.map((status) => [status, 0]));
    const months = lastMonths(to);
    const monthly = Object.fromEntries(months.map((month) => [month, { month, deals: 0, salesValue: 0, commission: 0 }]));
    const firstMonth = months[0];
    const results = { closed: 0, salesValue: 0, commission: 0, commissionReceived: 0, depositCount: 0, depositAmount: 0 };
    const shares = new Map();

    const addShare = (userId, amount, dealId) => {
        const key = String(userId);
        const share = shares.get(key) || { userId: key, deals: new Set(), commission: 0 };
        share.deals.add(String(dealId));
        share.commission += amount;
        shares.set(key, share);
    };

    deals.forEach((deal) => {
        dealsByStatus[deal.status] = (dealsByStatus[deal.status] || 0) + 1;
        if (deal.status !== 'cancelled' && inPeriod(deal.depositDate, from, to)) {
            results.depositCount += 1;
            results.depositAmount += Number(deal.depositAmount || 0);
        }
        if (!CLOSED_STATUSES.includes(deal.status)) return;
        const date = closingDate(deal);
        const price = Number(deal.price || 0);
        const commission = Number(deal.commissionAmount || 0);

        const month = date && monthKey(date);
        if (month && month >= firstMonth && monthly[month]) {
            monthly[month].deals += 1;
            monthly[month].salesValue += price;
            monthly[month].commission += commission;
        }
        if (!inPeriod(date, from, to)) return;
        results.closed += 1;
        results.salesValue += price;
        results.commission += commission;
        if (deal.commissionStatus === 'received') results.commissionReceived += commission;

        // Commission of each employee: their share, or all of it for the
        // employee managing the deal when it is not split
        const splits = deal.commissionSplits || [];
        if (splits.length) {
            splits.forEach((split) => addShare(split.user, Number(split.amount || 0), deal._id));
        } else if (deal.createBy) {
            addShare(deal.createBy, commission, deal._id);
        }
    });

    // Employees only see their own commission
    const visibleShares = [...shares.values()].filter((share) => admin || share.userId === req.user.userId);
    const users = await User.find({ _id: { $in: visibleShares.map((share) => share.userId) } }).select('fullName firstName lastName username');
    const names = new Map(users.map((user) => [String(user._id), displayName(user) || user.username]));
    const commissionBySale = visibleShares
        .map((share) => ({ userId: share.userId, name: names.get(share.userId) || '', deals: share.deals.size, commission: share.commission }))
        .sort((a, b) => b.commission - a.commission);

    // Sources of the new customers and leads of the period
    const sources = new Map();
    [...contactSources, ...leadSources].forEach(({ _id, count }) => {
        const key = LEAD_SOURCE[_id] || _id || 'other';
        sources.set(key, (sources.get(key) || 0) + count);
    });

    res.status(200).json({
        period: { from, to },
        contacts: { total: contactTotal, new: contactNew },
        leads: { open: leadOpen, new: leadNew, converted: leadConverted },
        properties: { total: propertyTotal, byStatus },
        deals: { byStatus: dealsByStatus, ...results },
        monthly: months.map((month) => monthly[month]),
        commissionBySale,
        leadSources: [...sources.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
        contactStatuses: [...countBy(contactStatuses).reduce((map, { key, count }) => {
            const status = CONTACT_STATUS[key] || key || 'new';
            return map.set(status, (map.get(status) || 0) + count);
        }, new Map())].map(([status, count]) => ({ status, count })),
    });
};

module.exports = { summary };
