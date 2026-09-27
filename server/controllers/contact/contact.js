const mongoose = require('mongoose')
const Contact = require('../../model/schema/contact')
const emailHistory = require('../../model/schema/email')
const MeetingHistory = require('../../model/schema/meeting')
const phoneCall = require('../../model/schema/phoneCall')
const Task = require('../../model/schema/task')
const TextMsg = require('../../model/schema/textMsg')
const DocumentSchema = require('../../model/schema/document')
const { ownerFilter, resolveOwner, scopedQuery } = require('../../utils/access')

const index = async (req, res) => {
    const query = scopedQuery(req)
    query.deleted = false;

    let allData = await Contact.find(query).populate({
        path: 'createBy',
        match: { deleted: false } // Populate only if createBy.deleted is false
    }).exec()

    const result = allData.filter(item => item.createBy !== null);
    res.send(result)
}

const add = async (req, res) => {
    try {
        req.body.createdDate = new Date();
        req.body.createBy = resolveOwner(req, req.body.createBy);
        const user = new Contact(req.body);
        await user.save();
        res.status(200).json(user);
    } catch (err) {
        console.error('Failed to create Contact:', err);
        res.status(400).json({ error: 'Failed to create Contact' });
    }
}

const addPropertyInterest = async (req, res) => {
    try {
        const { id } = req.params
        if (!Array.isArray(req.body)) {
            return res.status(400).json({ error: 'An array of property ids is expected' });
        }
        const result = await Contact.updateOne({ _id: id, ...ownerFilter(req) }, { $set: { interestProperty: req.body } });
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'No data found.' });
        }
        res.send(' uploaded successfully.');
    } catch (err) {
        console.error('Failed to create Contact:', err);
        res.status(400).json({ error: 'Failed to create Contact' });
    }
}

const edit = async (req, res) => {
    try {
        // The owner of a contact never changes through edit (the web client sends
        // the id of whoever is editing as createBy)
        const { createBy, ...data } = req.body;
        let result = await Contact.updateOne(
            { _id: req.params.id, ...ownerFilter(req) },
            { $set: { ...data, updatedDate: new Date() } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'No data found.' });
        }
        res.status(200).json(result);
    } catch (err) {
        console.error('Failed to Update Contact:', err);
        res.status(400).json({ error: 'Failed to Update Contact' });
    }
}

const view = async (req, res) => {
    try {
        let contact = await Contact.findOne({ _id: req.params.id, ...ownerFilter(req) });
        if (!contact) return res.status(404).json({ message: 'No data found.' })
        let interestProperty = await Contact.findOne({ _id: contact._id }).populate("interestProperty")

        let EmailHistory = await emailHistory.aggregate([
            { $match: { createBy: contact._id } },
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
                    senderName: { $concat: ['$users.firstName', ' ', '$users.lastName'] },
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
                            then: { $concat: ['$createByRef.title', ' ', '$createByRef.firstName', ' ', '$createByRef.lastName'] },
                            else: { $concat: ['$createByrefLead.leadName'] }
                        }
                    },
                }
            },
            {
                $project: {
                    createByRef: 0,
                    createByrefLead: 0,
                    users: 0,
                }
            },

            // {
            //     $lookup: {
            //         from: 'contacts',
            //         localField: 'createBy',
            //         foreignField: '_id',
            //         as: 'createdBy'
            //     }
            // },
            // {
            //     $lookup: {
            //         from: 'users',
            //         localField: 'sender',
            //         foreignField: '_id',
            //         as: 'users'
            //     }
            // },
            // { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
            // {
            //     $project: {
            //         sender: '$users.username',
            //         recipient: '$recipient',
            //         createBy: { $concat: [{ $arrayElemAt: ['$createdBy.title', 0] }, ' ', { $arrayElemAt: ['$createdBy.firstName', 0] }, ' ', { $arrayElemAt: ['$createdBy.lastName', 0] }] },
            //         timestamp: '$timestamp',
            //     }
            // }
            // --------------------------
            // {
            //     $lookup: {
            //         from: 'contacts',
            //         localField: '_id',
            //         foreignField: '_id',
            //         as: 'user'
            //     }
            // },
            // {
            //     $lookup: {
            //         from: 'contacts',
            //         let: { createdBy: '$createBy' },
            //         pipeline: [
            //             {
            //                 $match: {
            //                     $expr: { $eq: ['$_id', '$$createdBy'] }
            //                 }
            //             },
            //             {
            //                 $project: {
            //                     _id: 0,
            //                     firstName: 1,
            //                     lastName: 1,
            //                     emailHistory: 1
            //                 }
            //             }
            //         ],
            //         as: 'createdBy'
            //     }
            // }
            // ----------------------------
            // {
            //     $lookup: {
            //         from: 'contacts',
            //         let: { createdBy: '$createBy' }, // Create a variable to hold the 'createBy' field value
            //         pipeline: [
            //             {
            //                 $match: {
            //                     $expr: { $eq: ['$_id', '$$createdBy'] } // Use the variable to match the '_id' field in the 'contacts' collection
            //                 }
            //             },
            //             {
            //                 $project: {
            //                     _id: 0,
            //                     firstName: 1,
            //                     lastName: 1
            //                 }
            //             }
            //         ],
            //         as: 'createdBy'
            //     }
            // }
            // ------------------------
            // {
            //     $project: {
            //         _id: '$emailHistory._id',
            //         sender: '$emailHistory.sender',
            //         recipient: '$emailHistory.recipient',
            //         addedBy: '$emailHistory.timestamp',
            //     }
            // }
        ]);
        let phoneCallHistory = await phoneCall.aggregate([
            { $match: { createBy: contact._id } },
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
            { $unwind: '$contact' },
            { $match: { 'contact.deleted': false } },
            {
                $addFields: {
                    senderName: { $concat: ['$users.firstName', ' ', '$users.lastName'] },
                    deleted: '$contact.deleted',
                    createByName: { $concat: ['$contact.title', ' ', '$contact.firstName', ' ', '$contact.lastName'] },
                }
            },
            {
                $project: { contact: 0, users: 0 }
            },
        ]);
        let meetingHistory = await MeetingHistory.aggregate([
            {
                $match: {
                    $expr: {
                        $and: [
                            { $in: [contact._id, '$attendes'] },
                        ]
                    }
                }
            },
            {
                $lookup: {
                    from: 'contacts',
                    localField: 'attendes',
                    foreignField: '_id',
                    as: 'contact'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'createdBy',
                    foreignField: '_id',
                    as: 'users'
                }
            },
            { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    attendesArray: '$contact.email',
                    createdByName: '$users.username',
                }
            },
            {
                $project: {
                    contact: 0,
                    users: 0
                }
            }
        ]);
        let textMsg = await TextMsg.aggregate([
            { $match: { createFor: contact._id } },
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
                    sender: '$users.username',
                    deleted: '$contact.deleted',
                    createByName: { $concat: ['$contact.title', ' ', '$contact.firstName', ' ', '$contact.lastName'] },
                }
            },
            {
                $project: { contact: 0, users: 0 }
            },
        ]);

        let task = await Task.aggregate([
            { $match: { assignmentTo: contact._id } },
            {
                $lookup: {
                    from: 'contacts',
                    localField: 'assignmentTo',
                    foreignField: '_id',
                    as: 'contact'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'createBy',
                    foreignField: '_id',
                    as: 'users'
                }
            },
            { $unwind: { path: '$contact', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    assignmentToName: '$contact.email',
                    createByName: '$users.username',
                }
            },
            { $project: { contact: 0, users: 0 } },
        ])

        const Document = await DocumentSchema.aggregate([
            { $unwind: '$file' },
            { $match: { 'file.deleted': false, 'file.linkContact': contact._id } },
            {
                $lookup: {
                    from: 'users', // Replace 'users' with the actual name of your users collection
                    localField: 'createBy',
                    foreignField: '_id', // Assuming the 'createBy' field in DocumentSchema corresponds to '_id' in the 'users' collection
                    as: 'creatorInfo'
                }
            },
            { $unwind: { path: '$creatorInfo', preserveNullAndEmptyArrays: true } },
            { $match: { 'creatorInfo.deleted': false } },
            {
                $group: {
                    _id: '$_id',  // Group by the document _id (folder's _id)
                    folderName: { $first: '$folderName' }, // Get the folderName (assuming it's the same for all files in the folder)
                    createByName: { $first: { $concat: ['$creatorInfo.firstName', ' ', '$creatorInfo.lastName'] } },
                    files: { $push: '$file' }, // Push the matching files back into an array
                }
            },
            { $project: { creatorInfo: 0 } },
        ]);

        res.status(200).json({ interestProperty, contact, EmailHistory, phoneCallHistory, meetingHistory, textMsg, task, Document });
    }
    catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({ message: 'Invalid id.' });
        }
        console.error(error);
        res.status(500).json({ error, err: 'An error occurred.' });
    }
}

const deleteData = async (req, res) => {
    try {
        const contact = await Contact.findOneAndUpdate({ _id: req.params.id, ...ownerFilter(req) }, { deleted: true });
        if (!contact) {
            return res.status(404).json({ message: 'No data found.' })
        }
        res.status(200).json({ message: "done", contact })
    } catch (err) {
        res.status(404).json({ message: "error", err })
    }
}

const deleteMany = async (req, res) => {
    try {
        const contact = await Contact.updateMany({ _id: { $in: req.body }, ...ownerFilter(req) }, { $set: { deleted: true } });
        res.status(200).json({ message: "done", contact })
    } catch (err) {
        res.status(404).json({ message: "error", err })
    }
}

module.exports = { index, add, addPropertyInterest, view, edit, deleteData, deleteMany }