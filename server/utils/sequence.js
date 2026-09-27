const Counter = require('../model/schema/counter');

// Next readable code of a sequence, e.g. nextCode('property', 'BDS') -> BDS00001.
// The increment is atomic, two requests never get the same number.
const nextCode = async (name, prefix, digits = 5) => {
    const counter = await Counter.findOneAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return `${prefix}${String(counter.seq).padStart(digits, '0')}`;
};

module.exports = { nextCode };
