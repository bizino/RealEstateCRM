const PhoneCall = require('../../model/schema/phoneCall');
const User = require('../../model/schema/user');
const { castIds, isValidId, resolveOwner, scopedQuery } = require('../../utils/access');

const add = async (req, res) => {
    try {
        const { sender, recipient, callDuration, startDate, endDate, callNotes, createBy, createByLead } = req.body;

        if (createBy && !isValidId(createBy)) {
            return res.status(400).json({ error: 'Invalid createBy value' });
        }
        if (createByLead && !isValidId(createByLead)) {
            return res.status(400).json({ error: 'Invalid createByLead value' });
        }
        const phoneCall = { sender: resolveOwner(req, sender), recipient, callDuration, startDate, endDate, callNotes }

        if (createBy) {
            phoneCall.createBy = createBy;
        }

        if (createByLead) {
            phoneCall.createByLead = createByLead;
        }

        if (!await User.exists({ _id: phoneCall.sender, deleted: false })) {
            return res.status(400).json({ error: 'Invalid sender value' });
        }

        const result = new PhoneCall(phoneCall);
        await result.save();
        // Only count the call once it is stored
        await User.updateOne({ _id: phoneCall.sender }, { $inc: { outboundcall: 1 } });
        res.status(200).json({ result });
    } catch (err) {
        console.error('Failed to create :', err);
        res.status(400).json({ err, error: 'Failed to create' });
    }
}

const index = async (req, res) => {
    try {

        const query = castIds(scopedQuery(req, 'sender'), ['sender'])
        let result = await PhoneCall.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'leads', // Assuming this is the collection name for 'leads'
                    localField: 'createByLead',
                    foreignField: '_id',
                    as: 'createByrefLead'
                }
            },
            {
                $lookup: {
                    from: 'contacts',
                    localField: 'createBy',
                    foreignField: '_id',
                    as: 'contact'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'sender',
                    foreignField: '_id',
                    as: 'users'
                }
            },
            { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$contact', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$createByrefLead', preserveNullAndEmptyArrays: true } },
            { $match: { 'users.deleted': false } },
            {
                $addFields: {
                    senderName: { $concat: ['$users.firstName', ' ', '$users.lastName'] },
                    deleted: {
                        $cond: [
                            { $eq: ['$contact.deleted', false] },
                            '$contact.deleted',
                            { $ifNull: ['$createByrefLead.deleted', false] }
                        ]
                    },
                    createByName: {
                        $cond: {
                            if: '$contact',
                            then: { $concat: ['$contact.title', ' ', '$contact.firstName', ' ', '$contact.lastName'] },
                            else: { $concat: ['$createByrefLead.leadName'] }
                        }
                    },
                }
            },
            { $project: { contact: 0, createByrefLead: 0, users: 0 } },
        ])

        res.status(200).json(result);
    } catch (err) {
        console.error('Failed :', err);
        res.status(400).json({ err, error: 'Failed ' });
    }
}

const view = async (req, res) => {
    try {
        let result = await PhoneCall.findOne({ _id: req.params.id })

        if (!result) return res.status(404).json({ message: "no Data Found." })

        let response = await PhoneCall.aggregate([
            { $match: { _id: result._id } },
            {
                $lookup: {
                    from: 'contacts',
                    localField: 'createBy',
                    foreignField: '_id',
                    as: 'contact'
                }
            },
            {
                $lookup: {
                    from: 'leads', // Assuming this is the collection name for 'leads'
                    localField: 'createByLead',
                    foreignField: '_id',
                    as: 'createByrefLead'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'sender',
                    foreignField: '_id',
                    as: 'users'
                }
            },
            { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$contact', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$createByrefLead', preserveNullAndEmptyArrays: true } },
            { $match: { 'users.deleted': false } },
            {
                $addFields: {
                    senderName: { $concat: ['$users.firstName', ' ', '$users.lastName'] },
                    deleted: {
                        $cond: [
                            { $eq: ['$contact.deleted', false] },
                            '$contact.deleted',
                            { $ifNull: ['$createByrefLead.deleted', false] }
                        ]
                    },
                    createByName: {
                        $cond: {
                            if: '$contact',
                            then: { $concat: ['$contact.title', ' ', '$contact.firstName', ' ', '$contact.lastName'] },
                            else: { $concat: ['$createByrefLead.leadName'] }
                        }
                    },
                }
            },
            { $project: { contact: 0, createByrefLead: 0, users: 0 } },
        ])

        res.status(200).json(response[0])
    } catch (err) {
        console.error('Failed :', err);
        res.status(400).json({ err, error: 'Failed ' });
    }
}

module.exports = { add, index, view }