const mongoose = require('mongoose');

// Payment schedule of the buyer (đợt thanh toán)
const payment = new mongoose.Schema({
    name: String,
    dueDate: Date,
    amount: Number,
    paidDate: Date,
    note: String,
});

// Share of the commission of an employee
const commissionSplit = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // listing (đầu chủ) | selling (đầu khách) | support | manager
    role: String,
    // Percentage of the total commission, the amount is computed from it
    percent: Number,
    amount: Number,
}, { _id: false });

// A sale or rental closed (or being closed) with a customer (giao dịch)
const deal = new mongoose.Schema({
    // Readable code (GD00001), generated when the deal is created
    code: String,
    title: String,
    // sale | rent
    dealType: { type: String, default: 'sale' },
    // negotiating | deposit | contract | completed | cancelled
    status: { type: String, default: 'negotiating' },
    // Buyer / tenant
    contact: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact',
        required: true,
    },
    property: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'property',
    },
    // Agreed price in VND (sale price or monthly rent)
    price: Number,
    depositAmount: Number,
    depositDate: Date,
    // Date agreed with the owner to sign the sale contract / notarize
    contractDueDate: Date,
    contractNumber: String,
    contractDate: Date,
    completedDate: Date,
    payments: [payment],
    // Commission of the company: rate in % of the price, or a fixed amount
    commissionRate: Number,
    commissionAmount: Number,
    // pending | partial | received
    commissionStatus: { type: String, default: 'pending' },
    commissionReceivedDate: Date,
    commissionSplits: [commissionSplit],
    cancelReason: String,
    notes: String,
    createBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    createdDate: Date,
    updatedDate: {
        type: Date,
        default: Date.now,
    },
    deleted: {
        type: Boolean,
        default: false,
    },
});

module.exports = mongoose.model('Deal', deal);
