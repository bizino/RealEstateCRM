const mongoose = require('mongoose');

const isAdmin = (req) => req.user?.role === 'admin';

// Regular users may only touch records they own, admins may touch everything
const ownerFilter = (req, ownerField = 'createBy') => (isAdmin(req) ? {} : { [ownerField]: req.user.userId });

// Owner of a new record: regular users always own what they create, admins may
// create a record for someone else (and default to themselves)
const resolveOwner = (req, requestedOwner) => (isAdmin(req) && requestedOwner ? requestedOwner : req.user.userId);

// Only plain `?field=value` filters are accepted from the query string. Operator
// objects (?field[$ne]=x) and top level operators (?$where=...) are dropped.
const sanitizeQuery = (query = {}) => Object.fromEntries(
    Object.entries(query).filter(([key, value]) => !key.startsWith('$') && typeof value === 'string')
);

// Query string filter for list endpoints, always limited to the caller's own
// records for regular users whatever the client sends.
const scopedQuery = (req, ownerField = 'createBy') => ({ ...sanitizeQuery(req.query), ...ownerFilter(req, ownerField) });

// Aggregation pipelines do not cast values, convert the id filters ourselves.
// An invalid id throws a BSONError which the error handler turns into a 400.
const castIds = (query, fields) => {
    fields.forEach((field) => {
        if (query[field] !== undefined) {
            query[field] = new mongoose.Types.ObjectId(query[field]);
        }
    });
    return query;
};

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);

// Real estate agencies share their listings: every employee sees every property
// (the owner's contact details stay private). PROPERTY_VISIBILITY=own restricts
// employees to the properties they manage, like the other records.
const sharedInventory = () => process.env.PROPERTY_VISIBILITY !== 'own';

module.exports = { isAdmin, ownerFilter, resolveOwner, sanitizeQuery, scopedQuery, castIds, isValidId, sharedInventory };
