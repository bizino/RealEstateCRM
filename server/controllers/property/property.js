const Property = require('../../model/schema/property')
const Deal = require('../../model/schema/deal')
const multer = require('multer')
const fs = require('fs');
const path = require('path');
const Contact = require('../../model/schema/contact');
const { isAdmin, ownerFilter, resolveOwner, sanitizeQuery, scopedQuery, sharedInventory } = require('../../utils/access');
const { dealVisibility } = require('../../utils/deals');
const { normalizePhone } = require('../../utils/phone');
const { nextCode } = require('../../utils/sequence');
const { decodeFileName, uniqueFileName, removeUploadedFiles } = require('../../utils/upload');

// Only the employee who manages the listing and admins see who the owner is,
// the agreement with them and the legal documents: the other employees sell the
// property through the company.
const PRIVATE_FIELDS = ['ownerName', 'ownerPhone', 'commissionNote', 'internalNotesOrComments', 'propertyDocuments'];

const CREATOR_FIELDS = 'fullName firstName lastName username phoneNumber deleted';

const ownerId = (property) => String(property.createBy?._id ?? property.createBy);

const canManage = (req, property) => isAdmin(req) || ownerId(property) === String(req.user.userId);

// The property as sent to the client, without the private fields for the others
const present = (req, property) => {
    const data = property.toJSON();
    const manageable = canManage(req, property);
    if (!manageable) {
        PRIVATE_FIELDS.forEach((field) => delete data[field]);
    }
    data.canEdit = manageable;
    return data;
};

const composeAddress = (...parts) => parts.map((part) => (typeof part === 'string' ? part.trim() : '')).filter(Boolean).join(', ');

// Normalizes what the client sends; fields managed by the server (code, media
// lists, status set by deals...) are dropped
const prepareProperty = (body) => {
    const {
        _id, deleted, createdDate, updatedDate, code, statusSetByDeal, canEdit,
        propertyPhotos, virtualToursOrVideos, floorPlans, propertyDocuments,
        ...data
    } = body || {};
    if ('ownerPhone' in data) data.ownerPhone = normalizePhone(data.ownerPhone);
    // The full address follows the street / ward / province fields when they are sent
    if (['street', 'ward', 'province'].some((field) => field in data)) {
        const address = composeAddress(data.street, data.ward, data.province);
        if (address) data.propertyAddress = address;
    }
    return data;
};

const index = async (req, res) => {
    const query = sharedInventory() ? sanitizeQuery(req.query) : scopedQuery(req)
    query.deleted = false;
    let allData = await Property.find(query).populate({
        path: 'createBy',
        select: CREATOR_FIELDS,
        match: { deleted: false } // Populate only if createBy.deleted is false
    }).sort({ createdDate: -1 }).exec()

    const result = allData.filter(item => item.createBy !== null).map((item) => present(req, item));
    res.send(result)
}

const add = async (req, res) => {
    const data = prepareProperty(req.body);
    data.createdDate = new Date();
    data.createBy = resolveOwner(req, data.createBy);
    if (!data.listingStatus) data.listingStatus = 'available';
    const property = new Property(data);
    // Validate before taking a code, a rejected property must not use a number
    await property.validate();
    property.code = await nextCode('property', 'BDS');
    await property.save();
    res.status(200).json(property);
}

const edit = async (req, res) => {
    // The owner never changes through edit (the web client sends the id of
    // whoever is editing as createBy)
    const { createBy, ...data } = prepareProperty(req.body);
    if ('listingStatus' in data) {
        data.statusSetByDeal = false;
    }
    let result = await Property.updateOne(
        { _id: req.params.id, deleted: false, ...ownerFilter(req) },
        { $set: { ...data, updatedDate: new Date() } },
        { runValidators: true }
    );
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: "no Data Found." })
    }
    res.status(200).json(result);
}

const view = async (req, res) => {
    const { id } = req.params
    const filter = { _id: id, deleted: false, ...(sharedInventory() ? {} : ownerFilter(req)) };
    let property = await Property.findOne(filter).populate('createBy', CREATOR_FIELDS)
    if (!property) return res.status(404).json({ message: "no Data Found." })

    // Customers of the caller interested in the property (all of them for admins)
    let filteredContacts = await Contact.find({ deleted: false, interestProperty: property._id, ...ownerFilter(req) })
    const deals = await Deal.find({ property: property._id, deleted: false, ...dealVisibility(req) })
        .populate('contact', 'fullName firstName lastName phoneNumber')
        .populate('createBy', 'fullName firstName lastName username')
        .sort({ createdDate: -1 });
    res.status(200).json({ property: present(req, property), filteredContacts, deals })
}

const deleteData = async (req, res) => {
    const property = await Property.findOneAndUpdate({ _id: req.params.id, deleted: false, ...ownerFilter(req) }, { deleted: true, updatedDate: new Date() });
    if (!property) {
        return res.status(404).json({ message: "no Data Found." })
    }
    res.status(200).json({ message: "done", property })
}

const deleteMany = async (req, res) => {
    if (!Array.isArray(req.body)) {
        return res.status(400).json({ message: 'An array of ids is expected' })
    }
    const property = await Property.updateMany({ _id: { $in: req.body }, ...ownerFilter(req) }, { $set: { deleted: true, updatedDate: new Date() } });
    res.status(200).json({ message: "done", property })
}

const storage = (uploadDir) => multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            fs.mkdirSync(uploadDir, { recursive: true });
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            cb(null, uniqueFileName(uploadDir, decodeFileName(file.originalname)));
        },
    })
});

// Adds the uploaded files to one of the media arrays of the property
const saveMedia = (field, publicPath, withFileName = false) => async (req, res) => {
    try {
        const { id } = req.params

        if (!req.files || req.files.length === 0) {
            res.status(400).send('No files uploaded.');
            return;
        }
        const url = req.protocol + '://' + req.get('host');

        const file = req.files.map((file) => ({
            ...(withFileName && { filename: file.filename }),
            img: `${url}/api/property/${publicPath}/${file.filename}`,
            createOn: new Date(),
        }));

        const result = await Property.updateOne({ _id: id, deleted: false, ...ownerFilter(req) }, { $push: { [field]: { $each: file } } });
        if (result.matchedCount === 0) {
            await removeUploadedFiles(req.files);
            return res.status(404).json({ message: "no Data Found." })
        }
        res.send('File uploaded successfully.');
    } catch (err) {
        console.error('Failed to create Property:', err);
        await removeUploadedFiles(req.files);
        res.status(400).json({ error: 'Failed to create Property' });
    }
}

const MEDIA_FIELDS = ['propertyPhotos', 'virtualToursOrVideos', 'floorPlans', 'propertyDocuments'];

// Removes one photo / video / plan / document from a property (the file itself
// stays on disk, like soft deleted records)
const removeMedia = async (req, res) => {
    const { id, field } = req.params;
    const { img } = req.body || {};
    if (!MEDIA_FIELDS.includes(field) || typeof img !== 'string' || img === '') {
        return res.status(400).json({ message: 'Invalid media' });
    }
    const result = await Property.updateOne(
        { _id: id, deleted: false, ...ownerFilter(req) },
        { $pull: { [field]: { img } }, $set: { updatedDate: new Date() } }
    );
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: "no Data Found." })
    }
    res.status(200).json({ message: 'done', removed: result.modifiedCount });
}

const DOCUMENTS_DIR = 'uploads/Property/property-documents';

// Legal papers of a property, for the employee managing it and admins only
const downloadDocument = async (req, res) => {
    const { filename } = req.params;
    if (path.basename(filename) !== filename) {
        return res.status(400).json({ message: 'Invalid file name' });
    }
    const property = await Property.findOne({ deleted: false, 'propertyDocuments.filename': filename, ...ownerFilter(req) });
    if (!property) {
        return res.status(404).json({ message: 'File not found' });
    }
    res.download(path.join(DOCUMENTS_DIR, filename), (err) => {
        if (err && !res.headersSent) {
            res.status(404).json({ message: 'File not found' });
        }
    });
}

const upload = storage('uploads/Property/PropertyPhotos');
const propertyPhoto = saveMedia('propertyPhotos', 'property-photos');

const virtualTours = storage('uploads/Property/virtual-tours-or-videos');
const VirtualToursorVideos = saveMedia('virtualToursOrVideos', 'virtual-tours-or-videos');

const FloorPlansStorage = storage('uploads/Property/floor-plans');
const FloorPlans = saveMedia('floorPlans', 'floor-plans');

const PropertyDocumentsStorage = storage(DOCUMENTS_DIR);
const PropertyDocuments = saveMedia('propertyDocuments', 'property-documents', true);



module.exports = { index, add, view, edit, deleteData, deleteMany, removeMedia, downloadDocument, upload, propertyPhoto, virtualTours, VirtualToursorVideos, FloorPlansStorage, FloorPlans, PropertyDocumentsStorage, PropertyDocuments }
