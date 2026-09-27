const mongoose = require('mongoose');

const Task = new mongoose.Schema({
    title: String,
    category: String,
    description: String,
    notes: String,
    assignmentTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "contact",
    },
    assignmentToLead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lead",
    },
    // todo | inProgress | done
    status: { type: String, default: 'todo' },
    // high | normal | low
    priority: String,
    completedDate: Date,
    reminder: String,
    start: String,
    end: String,
    backgroundColor: String,
    borderColor: String,
    textColor: String,
    display: String,
    url: String,
    createBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    updatedDate: {
        type: Date,
        default: Date.now
    },
    createdDate: {
        type: Date,
    },
    deleted: {
        type: Boolean,
        default: false,
    },
})

module.exports = mongoose.model('task', Task);