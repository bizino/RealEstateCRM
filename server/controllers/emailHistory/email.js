const { sendEmail } = require('../../middelwares/mail');
const EmailHistory = require('../../model/schema/email');
const User = require('../../model/schema/user');
const { castIds, isValidId, ownerFilter, resolveOwner, scopedQuery } = require('../../utils/access');
const { nameExpr } = require('../../utils/names');

const add = async (req, res) => {
    try {
        const { sender, recipient, subject, message, startDate, endDate, createBy, createByLead } = req.body;

        if (createBy && !isValidId(createBy)) {
            return res.status(400).json({ error: 'Invalid createBy value' });
        }
        if (createByLead && !isValidId(createByLead)) {
            return res.status(400).json({ error: 'Invalid createByLead value' });
        }

        const email = { sender: resolveOwner(req, sender), recipient, subject, message, startDate, endDate }

        if (createBy) {
            email.createBy = createBy;
        }
        if (createByLead) {
            email.createByLead = createByLead;
        }

        if (!await User.exists({ _id: email.sender, deleted: false })) {
            return res.status(400).json({ error: 'Invalid sender value' });
        }
        // sendEmail(email.recipient, email.subject, email.message)

        const result = new EmailHistory(email);
        await result.save();
        // Only count the email once it is stored
        await User.updateOne({ _id: email.sender }, { $inc: { emailsent: 1 } });
        res.status(200).json({ result });
    } catch (err) {
        console.error('Failed to create :', err);
        res.status(400).json({ err, error: 'Failed to create' });
    }
}

const index = async (req, res) => {
    try {
        const query = castIds(scopedQuery(req, 'sender'), ['sender'])

        let result = await EmailHistory.aggregate([
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
                    from: 'contacts', // Assuming this is the collection name for 'contacts'
                    localField: 'createBy',
                    foreignField: '_id',
                    as: 'createByRef'
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
            { $unwind: { path: '$createByRef', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$createByrefLead', preserveNullAndEmptyArrays: true } },
            { $match: { 'users.deleted': false } },
            {
                $addFields: {
                    senderName: nameExpr('$users'),
                    deleted: {
                        $cond: [
                            { $eq: ['$createByRef.deleted', false] },
                            '$createByRef.deleted',
                            { $ifNull: ['$createByrefLead.deleted', false] }
                        ]
                    },
                    createByName: {
                        $cond: {
                            if: '$createByRef',
                            then: nameExpr('$createByRef'),
                            else: { $ifNull: ['$createByrefLead.leadName', ''] }
                        }
                    },
                }
            },
            {
                $project: {
                    createByRef: 0,
                    createByrefLead: 0,
                    users: 0
                }
            },
        ])


        res.status(200).json(result);
    } catch (err) {
        console.error('Failed :', err);
        res.status(400).json({ err, error: 'Failed ' });
    }
}

const view = async (req, res) => {
    try {
        let result = await EmailHistory.findOne({ _id: req.params.id, ...ownerFilter(req, 'sender') })

        if (!result) return res.status(404).json({ message: "no Data Found." })

        let response = await EmailHistory.aggregate([
            { $match: { _id: result._id } },
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
                    from: 'contacts', // Assuming this is the collection name for 'contacts'
                    localField: 'createBy',
                    foreignField: '_id',
                    as: 'createByRef'
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
            { $unwind: { path: '$createByRef', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$createByrefLead', preserveNullAndEmptyArrays: true } },
            { $match: { 'users.deleted': false } },
            {
                $addFields: {
                    senderEmail: '$users.username',
                    senderName: nameExpr('$users'),
                    deleted: {
                        $cond: [
                            { $eq: ['$createByRef.deleted', false] },
                            '$createByRef.deleted',
                            { $ifNull: ['$createByrefLead.deleted', false] }
                        ]
                    },
                    createByName: {
                        $cond: {
                            if: '$createByRef',
                            then: nameExpr('$createByRef'),
                            else: { $ifNull: ['$createByrefLead.leadName', ''] }
                        }
                    },
                }
            },
            {
                $project: {
                    createByRef: 0,
                    createByrefLead: 0,
                    users: 0
                }
            },
        ])

        res.status(200).json(response[0])
    } catch (err) {
        console.error('Failed :', err);
        res.status(400).json({ err, error: 'Failed ' });
    }
}

module.exports = { add, index, view }