const TextMsg = require('../../model/schema/textMsg');
const User = require('../../model/schema/user');
const { castIds, ownerFilter, resolveOwner, scopedQuery } = require('../../utils/access');
const { nameExpr } = require('../../utils/names');


const add = async (req, res) => {
    try {
        const result = new TextMsg({ ...req.body, sender: resolveOwner(req, req.body.sender) });
        if (!await User.exists({ _id: result.sender, deleted: false })) {
            return res.status(400).json({ error: 'Invalid sender value' });
        }

        await result.save();
        // Only count the message once it is stored
        await User.updateOne({ _id: result.sender }, { $inc: { textsent: 1 } });
        res.status(200).json(result);
    } catch (err) {
        console.error('Failed to create :', err);
        res.status(400).json({ err, error: 'Failed to create' });
    }
}

const index = async (req, res) => {
    // const startDate = new Date('2023-08-07T00:00:00');
    // const endDate = new Date('2023-08-14T23:59:59');

    // const dates = [];

    // // Generate all date and time values between start and end dates
    // let currentDate = new Date(startDate);
    // while (currentDate <= endDate) {
    //     dates.push(new Date(currentDate));
    //     currentDate.setHours(currentDate.getHours() + 1); // Add one hour to the current date
    // }

    // const allData = await TextMsg.find();
    // for (const data of allData) {
    //     const randomDate = dates[Math.floor(Math.random() * dates.length)];
    //     await TextMsg.updateOne({ _id: data._id }, { $set: { timestamp: randomDate } });
    // }

    const query = castIds(scopedQuery(req, 'sender'), ['sender'])
    try {
        let result = await TextMsg.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'contacts',
                    localField: 'createFor',
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
            { $unwind: '$contact' },
            { $match: { 'contact.deleted': false, 'users.deleted': false } },
            {
                $addFields: {
                    senderName: nameExpr('$users'),
                    deleted: '$contact.deleted',
                    createByName: nameExpr('$contact'),
                }
            },
            { $project: { contact: 0, users: 0 } },

        ])

        res.status(200).json(result);
    } catch (err) {
        console.error('Failed :', err);
        res.status(400).json({ err, error: 'Failed ' });
    }
}

const view = async (req, res) => {
    try {
        let result = await TextMsg.findOne({ _id: req.params.id, ...ownerFilter(req, 'sender') })

        if (!result) return res.status(404).json({ message: "no Data Found." })

        let response = await TextMsg.aggregate([
            { $match: { _id: result._id } },
            {
                $lookup: {
                    from: 'contacts',
                    localField: 'createFor',
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
            { $unwind: '$contact' },
            { $match: { 'contact.deleted': false } },
            {
                $addFields: {
                    senderName: nameExpr('$users'),
                    deleted: '$contact.deleted',
                    createByName: nameExpr('$contact'),
                }
            },
            { $project: { contact: 0, users: 0 } }
        ])

        res.status(200).json(response[0])
    } catch (err) {
        console.error('Failed :', err);
        res.status(400).json({ err, error: 'Failed ' });
    }
}

module.exports = { add, index, view }