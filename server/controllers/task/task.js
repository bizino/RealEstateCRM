const Task = require('../../model/schema/task')
const { castIds, isValidId, ownerFilter, resolveOwner, scopedQuery } = require('../../utils/access');
const { nameExpr } = require('../../utils/names');

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
                            then: nameExpr('$contact'),
                            else: { $ifNull: ['$Lead.leadName', ''] }
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

const TASK_STATUSES = ['todo', 'inProgress', 'done'];
const TASK_FIELDS = ['title', 'category', 'description', 'notes', 'status', 'priority', 'reminder', 'start', 'end', 'backgroundColor', 'borderColor', 'textColor', 'display', 'url'];

const pickTaskFields = (body) => Object.fromEntries(TASK_FIELDS.filter((field) => field in body).map((field) => [field, body[field]]));

const add = async (req, res) => {
    const { createBy, assignmentTo, assignmentToLead } = req.body;
    // Check if assignmentTo is a valid ObjectId if provided and not empty
    if (assignmentTo && !isValidId(assignmentTo)) {
        return res.status(400).json({ error: 'Invalid assignmentTo value' });
    }
    if (assignmentToLead && !isValidId(assignmentToLead)) {
        return res.status(400).json({ error: 'Invalid assignmentToLead value' });
    }
    const taskData = { ...pickTaskFields(req.body), createBy: resolveOwner(req, createBy), createdDate: new Date() };
    if (taskData.status !== undefined && !TASK_STATUSES.includes(taskData.status)) {
        return res.status(400).json({ error: 'Invalid status value' });
    }
    if (taskData.status === 'done') {
        taskData.completedDate = new Date();
    }

    if (assignmentTo) {
        taskData.assignmentTo = assignmentTo;
    }
    if (assignmentToLead) {
        taskData.assignmentToLead = assignmentToLead;
    }
    const result = new Task(taskData);
    await result.save();
    res.status(200).json(result);
}

const edit = async (req, res) => {
    // createBy is not taken from the body: the owner of a task never changes
    // through edit (the web client sends the id of whoever is editing)
    const { assignmentTo, assignmentToLead } = req.body;

    if (assignmentTo && !isValidId(assignmentTo)) {
        return res.status(400).json({ error: 'Invalid assignmentTo value' });
    }
    if (assignmentToLead && !isValidId(assignmentToLead)) {
        return res.status(400).json({ error: 'Invalid assignmentToLead value' });
    }
    const taskData = { ...pickTaskFields(req.body), updatedDate: new Date() };
    if (taskData.status !== undefined && !TASK_STATUSES.includes(taskData.status)) {
        return res.status(400).json({ error: 'Invalid status value' });
    }
    const unsetData = {};
    if (taskData.status === 'done') {
        taskData.completedDate = new Date();
    } else if (taskData.status) {
        unsetData.completedDate = '';
    }

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
        { _id: req.params.id, deleted: false, ...ownerFilter(req) },
        Object.keys(unsetData).length ? { $set: taskData, $unset: unsetData } : { $set: taskData }
    );
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: "no Data Found." })
    }
    res.status(200).json(result);
}

const view = async (req, res) => {
    let response = await Task.findOne({ _id: req.params.id, deleted: false, ...ownerFilter(req) })
    if (!response) return res.status(404).json({ message: "no Data Found." })
    let result = await Task.aggregate([
        { $match: { _id: response._id } },
        { $lookup: { from: 'contacts', localField: 'assignmentTo', foreignField: '_id', as: 'contact' } },
        { $lookup: { from: 'leads', localField: 'assignmentToLead', foreignField: '_id', as: 'Lead' } },
        { $lookup: { from: 'users', localField: 'createBy', foreignField: '_id', as: 'users' } },
        { $unwind: { path: '$contact', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$Lead', preserveNullAndEmptyArrays: true } },
        {
            $addFields: {
                assignmentToName: {
                    $cond: {
                        if: '$contact',
                        then: nameExpr('$contact'),
                        else: { $ifNull: ['$Lead.leadName', ''] }
                    }
                },
                createByName: nameExpr('$users'),
            }
        },
        { $project: { contact: 0, users: 0, Lead: 0 } },
    ])
    res.status(200).json(result[0]);
}

const deleteData = async (req, res) => {
    const result = await Task.findOneAndUpdate({ _id: req.params.id, ...ownerFilter(req) }, { deleted: true, updatedDate: new Date() });
    if (!result) {
        return res.status(404).json({ message: "no Data Found." })
    }
    res.status(200).json({ message: "done", result })
}

const deleteMany = async (req, res) => {
    if (!Array.isArray(req.body)) {
        return res.status(400).json({ message: 'An array of ids is expected' })
    }
    const result = await Task.updateMany({ _id: { $in: req.body }, ...ownerFilter(req) }, { $set: { deleted: true, updatedDate: new Date() } });
    res.status(200).json({ message: "done", result })
}

module.exports = { index, add, edit, view, deleteData, deleteMany }