const mongoose = require('mongoose');
const multer = require('multer');

// Wrap every function exported by a controller so that a rejected promise is
// passed to next() instead of becoming an unhandledRejection (which would
// terminate the Node.js process under Express 4).
const wrapAsync = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const wrapController = (controller) => Object.fromEntries(
    Object.entries(controller).map(([name, value]) => [name, typeof value === 'function' ? wrapAsync(value) : value])
);

// Central error handler, registered after all routes in app.js (Express
// recognises error handlers by their four arguments, keep `next`)
const errorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }
    if (err instanceof mongoose.Error.CastError || err?.name === 'BSONError') {
        return res.status(400).json({ message: 'Invalid id or value', error: err.message });
    }
    if (err instanceof mongoose.Error.ValidationError) {
        return res.status(400).json({ message: 'Validation failed', error: err.message });
    }
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: 'File upload failed', error: err.message });
    }
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: 'Invalid JSON body' });
    }
    // Other client errors raised by middlewares (body too large, ...)
    const status = err.status || err.statusCode;
    if (status >= 400 && status < 500) {
        return res.status(status).json({ message: err.message });
    }
    console.error('Unhandled error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
};

module.exports = { errorHandler, wrapAsync, wrapController };
