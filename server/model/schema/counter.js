const mongoose = require('mongoose');

// Named sequences used for readable codes (BDS00001, GD00001)
const counter = new mongoose.Schema({
    _id: String,
    seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counter);
