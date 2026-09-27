const Task = require('../../model/schema/task')
const { castIds, isValidId, ownerFilter, resolveOwner, scopedQuery } = require('../../utils/access');

const index = async (req, res) => {
    const query = castIds(scopedQuery(req), ['createBy']);
    query.deleted = false;

    try {
        let result = await Task.aggregate([
            { $match: query },
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
                    from: 'leads', // Assuming this is the collection name for 'leads'
                    localField: 'assignmentToLead',
                    foreignField: '_id',
                    as: 'Lead'
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
            { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$contact', preserveNullAndEmptyArrays: true } },
            { $unwind: { path: '$Lead', preserveNullAndEmptyArrays: true } },
            { $match: { 'users.deleted': false } },
            {
                $addFields: {
                    assignmentToName: {
                        $cond: {
                            if: '$contact',
                            then: { $concat: ['$contact.title', ' ', '$contact.firstName', ' ', '$contact.lastName'] },
                            else: { $concat: ['$Lead.leadName'] }
                        }
                    },
                }
            },
            { $project: { users: 0, contact: 0, Lead: 0 } },
        ]);

        res.send(result);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
    }
}

const add = async (req, res) => {
    try {
        const { title, category, description, notes, reminder, start, end, backgroundColor, borderColor, textColor, display, url, createBy, assignmentTo, assignmentToLead } = req.body;
        // Check if assignmentTo is a valid ObjectId if provided and not empty
        if (assignmentTo && !isValidId(assignmentTo)) {
            return res.status(400).json({ error: 'Invalid assignmentTo value' });
        }
        if (assignmentToLead && !isValidId(assignmentToLead)) {
            return res.status(400).json({ error: 'Invalid assignmentToLead value' });
        }
        const taskData = { title, category, description, notes, reminder, start, end, backgroundColor, borderColor, textColor, display, url, createBy: resolveOwner(req, createBy), createdDate: new Date() };

        if (assignmentTo) {
            taskData.assignmentTo = assignmentTo;
        }
        if (assignmentToLead) {
            taskData.assignmentToLead = assignmentToLead;
        }
        const result = new Task(taskData);
        await result.save();
        res.status(200).json(result);
    } catch (err) {
        console.error('Failed to create task:', err);
        res.status(400).json({ error: 'Failed to create task : ', err });
    }
}

const edit = async (req, res) => {
    try {
        // createBy is not taken from the body: the owner of a task never changes
        // through edit (the web client sends the id of whoever is editing)
        const { title, category, description, notes, reminder, start, end, backgroundColor, borderColor, textColor, display, url, assignmentTo, assignmentToLead } = req.body;

        if (assignmentTo && !isValidId(assignmentTo)) {
            return res.status(400).json({ error: 'Invalid assignmentTo value' });
        }
        if (assignmentToLead && !isValidId(assignmentToLead)) {
            return res.status(400).json({ error: 'Invalid assignmentToLead value' });
        }
        const taskData = { title, category, description, notes, reminder, start, end, backgroundColor, borderColor, textColor, display, url, updatedDate: new Date() };
        const unsetData = {};

        // A task is assigned to a contact or to a lead: the web client sends the
        // id of the selected one and null for the other, which is then cleared
        Object.entries({ assignmentTo, assignmentToLead }).forEach(([field, value]) => {
            if (value) {
                taskData[field] = value;
            } else if (field in req.body) {
                unsetData[field] = '';
            }
        });
        let result = await Task.updateOne(
            { _id: req.params.id, ...ownerFilter(req) },
            Object.keys(unsetData).length ? { $set: taskData, $unset: unsetData } : { $set: taskData }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "no Data Found." })
        }

        // const result = new Task(taskData);
        // await result.save();
        res.status(200).json(result);
    } catch (err) {
        console.error('Failed to create task:', err);
        res.status(400).json({ error: 'Failed to create task : ', err });
    }
}

const view = async (req, res) => {
    try {
        let response = await Task.findOne({ _id: req.params.id })
        if (!response) return res.status(404).json({ message: "no Data Found." })
        let result = await Task.aggregate([
            { $match: { _id: response._id } },
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
                    from: 'leads', // Assuming this is the collection name for 'leads'
                    localField: 'assignmentToLead',
                    foreignField: '_id',
                    as: 'Lead'
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
            { $unwind: { path: '$Lead', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    assignmentToName: {
                        $cond: {
                            if: '$contact',
                            then: { $concat: ['$contact.title', ' ', '$contact.firstName', ' ', '$contact.lastName'] },
                            else: { $concat: ['$Lead.leadName'] }
                        }
                    },
                    createByName: '$users.username',
                }
            },
            { $project: { contact: 0, users: 0, Lead: 0 } },
        ])
        res.status(200).json(result[0]);

    } catch (err) {
        console.log('Error:', err);
        res.status(400).json({ Error: err });
    }
}

const deleteData = async (req, res) => {
    try {
        const result = await Task.findOneAndUpdate({ _id: req.params.id, ...ownerFilter(req) }, { deleted: true });
        if (!result) {
            return res.status(404).json({ message: "no Data Found." })
        }
        res.status(200).json({ message: "done", result })
    } catch (err) {
        res.status(404).json({ message: "error", err })
    }
}

module.exports = { index, add, edit, view, deleteData }