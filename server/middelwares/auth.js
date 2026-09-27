const jwt = require('jsonwebtoken');
const User = require('../model/schema/user');

// Tokens used to be signed with this hard coded key. It is kept as a fallback so
// existing deployments keep working, but JWT_SECRET must be set in production.
const LEGACY_JWT_SECRET = 'secret_key';
const getJwtSecret = () => process.env.JWT_SECRET || LEGACY_JWT_SECRET;

const auth = async (req, res, next) => {
    const header = req.headers.authorization;

    if (!header) {
        return res.status(401).json({ message: "Authentication failed , Token missing" });
    }
    // The web client sends the raw token, other clients may use "Bearer <token>"
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;

    let decode;
    try {
        decode = jwt.verify(token, getJwtSecret())
    } catch (err) {
        return res.status(401).json({ message: 'Authentication failed. Invalid token.' })
    }

    try {
        // Tokens of deleted users must stop working immediately
        const user = decode.userId && await User.findOne({ _id: decode.userId, deleted: false }).select('role');
        if (!user) {
            return res.status(401).json({ message: 'Authentication failed. User not found.' })
        }
        req.user = { ...decode, role: user.role }
        next();
    } catch (err) {
        next(err);
    }
}

const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    next();
}

module.exports = auth
module.exports.requireAdmin = requireAdmin
module.exports.getJwtSecret = getJwtSecret
module.exports.LEGACY_JWT_SECRET = LEGACY_JWT_SECRET
