const mongoose = require('mongoose');
const MeetingHistory = require('../../model/schema/meeting')
const Contact = require('../../model/schema/contact')
const Lead = require('../../model/schema/lead')
const { castIds, isValidId, ownerFilter, resolveOwner, scopedQuery } = require('../../utils/access');
const { nameExpr } = require('../../utils/names');

const MEETING_STATUSES = ['scheduled', 'done', 'cancelled'];
const MEETING_FIELDS = ['agenda', 'attendes', 'attendesLead', 'property', 'meetingType', 'status', 'result', 'location', 'related', 'dateTime', 'notes'];

const pickMeetingFields = (body) => Object.fromEntries(MEETING_FIELDS.filter((field) => field in body).map((field) => [field, body[field]]));

// Ids of the attendees and of the property must be valid before saving: an
// invalid one would otherwise be stored as a cast error on update
const invalidReference = (data) => {
    const ids = [...(Array.isArray(data.attendes) ? data.attendes : []), ...(Array.isArray(data.attendesLead) ? data.attendesLead : [])];
    if (ids.some((id) => !isValidId(id))) return 'Invalid attendee id';
    if (data.property && !isValidId(data.property)) return 'Invalid property id';
    if (data.status !== undefined && !MEETING_STATUSES.includes(data.status)) return 'Invalid status value';
    return null;
};

// Names of the attendees (contacts and leads), of the creator and of the property
const detailsStages = [
    { $lookup: { from: 'contacts', localField: 'attendes', foreignField: '_id', as: 'contactRefs' } },
    { $lookup: { from: 'leads', localField: 'attendesLead', foreignField: '_id', as: 'leadRefs' } },
    { $lookup: { from: 'users', localField: 'createdBy', foreignField: '_id', as: 'users' } },
    { $lookup: { from: 'properties', localField: 'property', foreignField: '_id', as: 'propertyRef' } },
    { $unwind: { path: '$users', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$propertyRef', preserveNullAndEmptyArrays: true } },
    {
        $addFields: {
            attendesArray: {
                $concatArrays: [
                    { $map: { input: '$contactRefs', as: 'c', in: nameExpr('$$c') } },
                    { $map: { input: '$leadRefs', as: 'l', in: { $ifNull: ['$$l.leadName', ''] } } },
                ],
            },
            createdByName: nameExpr('$users'),
            propertyName: { $ifNull: ['$propertyRef.title', '$propertyRef.propertyAddress'] },
            propertyCode: '$propertyRef.code',
        }
    },
];

// Statuses the pipeline moves forward from (codes of older versions included)
const EARLY_CONTACT_STATUSES = [null, '', 'new', 'consulting', 'newLead', 'qualifiedLead'];
const EARLY_LEAD_STATUSES = [null, '', 'new', 'contacted', 'consulting', 'pending', 'active'];

// A meeting booked with a lead makes it "appointment"; a site visit done makes
// the customers "viewing". Customers further in the pipeline are not changed.
const advancePipeline = async (meeting) => {
    const now = new Date();
    const leads = meeting.attendesLead || [];
    if (leads.length && meeting.status !== 'cancelled') {
        await Lead.updateMany(
            { _id: { $in: leads }, leadStatus: { $in: EARLY_LEAD_STATUSES } },
            { $set: { leadStatus: 'appointment', updatedDate: now } }
        );
    }
    const contacts = meeting.attendes || [];
    if (contacts.length && meeting.status === 'done' && meeting.meetingType === 'viewing') {
        await Contact.updateMany(
            { _id: { $in: contacts }, leadStatus: { $in: EARLY_CONTACT_STATUSES } },
            { $set: { leadStatus: 'viewing', updatedDate: now } }
        );
    }
};

const add = async (req, res) => {
    const data = pickMeetingFields(req.body);
    const invalid = invalidReference(data);
    if (invalid) {
        return res.status(400).json({ error: invalid });
    }
    const result = new MeetingHistory({ ...data, createdBy: resolveOwner(req, req.body.createdBy) });
    await result.save();
    await advancePipeline(result);
    res.status(200).json(result);
}

const index = async (req, res) => {
    const query = castIds(scopedQuery(req, 'createdBy'), ['createdBy'])
    query.deleted = { $ne: true };

    const meetings = await MeetingHistory.aggregate([
        { $match: query },
        ...detailsStages,
        { $match: { 'users.deleted': false } },
        { $project: { contactRefs: 0, leadRefs: 0, users: 0, propertyRef: 0 } },
        { $sort: { dateTime: -1 } },
    ]);

    res.status(200).json(meetings);
}

const view = async (req, res) => {
    let result = await MeetingHistory.findOne({ _id: req.params.id, deleted: { $ne: true }, ...ownerFilter(req, 'createdBy') })

    if (!result) return res.status(404).json({ message: "no Data Found." })

    let response = await MeetingHistory.aggregate([
        { $match: { _id: result._id } },
        ...detailsStages,
        {
            $addFields: {
                // Full records of the attendees for the detail page
                attendes: '$contactRefs',
                attendesLead: '$leadRefs',
                property: '$propertyRef',
            }
        },
        { $project: { contactRefs: 0, leadRefs: 0, users: 0, propertyRef: 0 } },
    ])
    res.status(200).json(response[0])
}

const edit = async (req, res) => {
    const data = pickMeetingFields(req.body);
    const invalid = invalidReference(data);
    if (invalid) {
        return res.status(400).json({ error: invalid });
    }
    const unset = {};
    if ('property' in data && !data.property) {
        delete data.property;
        unset.property = '';
    }
    const result = await MeetingHistory.updateOne(
        { _id: req.params.id, deleted: { $ne: true }, ...ownerFilter(req, 'createdBy') },
        { $set: { ...data, updatedDate: new Date() }, ...(Object.keys(unset).length && { $unset: unset }) },
        { runValidators: true }
    );
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: "no Data Found." })
    }
    await advancePipeline(await MeetingHistory.findById(req.params.id));
    res.status(200).json(result);
}

const deleteData = async (req, res) => {
    const result = await MeetingHistory.findOneAndUpdate(
        { _id: req.params.id, deleted: { $ne: true }, ...ownerFilter(req, 'createdBy') },
        { deleted: true, updatedDate: new Date() }
    );
    if (!result) {
        return res.status(404).json({ message: "no Data Found." })
    }
    res.status(200).json({ message: "done" })
}

const deleteMany = async (req, res) => {
    if (!Array.isArray(req.body) || !req.body.every((id) => isValidId(id))) {
        return res.status(400).json({ message: 'An array of ids is expected' })
    }
    const ids = req.body.map((id) => new mongoose.Types.ObjectId(id));
    const result = await MeetingHistory.updateMany({ _id: { $in: ids }, ...ownerFilter(req, 'createdBy') }, { $set: { deleted: true, updatedDate: new Date() } });
    res.status(200).json({ message: "done", result })
}

module.exports = { add, index, view, edit, deleteData, deleteMany }
