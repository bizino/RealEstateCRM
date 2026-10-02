const mongoose = require('mongoose');

const meetingHistory = new mongoose.Schema({
    agenda: { type: String, required: true },
    attendes: [{
        type: mongoose.Schema.ObjectId,
        ref: 'contacts',
    }],
    attendesLead: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Lead',
    }],
    // Property shown to the customer (site visit)
    property: {
        type: mongoose.Schema.ObjectId,
        ref: 'property',
    },
    // viewing | consulting | signing | other
    meetingType: String,
    // scheduled | done | cancelled
    status: { type: String, default: 'scheduled' },
    // Outcome and feedback of the customer
    result: String,
    location: String,
    related: String,
    dateTime: String,
    notes: String,
    // meetingReminders: { type: String, required: true },
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: "users",
        require: true,
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    updatedDate: Date,
    deleted: {
        type: Boolean,
        default: false,
    },
})

module.exports = mongoose.model('meetingHistory', meetingHistory);
