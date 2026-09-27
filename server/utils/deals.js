const mongoose = require('mongoose');
const { isAdmin } = require('./access');

// Regular users see the deals they manage and the deals they earn a commission
// on; admins see everything. castToObjectIds is needed in aggregation pipelines.
const dealVisibility = (req, castToObjectIds = false) => {
    if (isAdmin(req)) return {};
    const me = castToObjectIds ? new mongoose.Types.ObjectId(req.user.userId) : req.user.userId;
    return { $or: [{ createBy: me }, { 'commissionSplits.user': me }] };
};

module.exports = { dealVisibility };
