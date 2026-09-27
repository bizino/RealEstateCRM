const Property = require('../../model/schema/property')
const multer = require('multer')
const fs = require('fs');
const Contact = require('../../model/schema/contact');
const { ownerFilter, resolveOwner, scopedQuery } = require('../../utils/access');
const { uniqueFileName, removeUploadedFiles } = require('../../utils/upload');


const index = async (req, res) => {
    const query = scopedQuery(req)
    query.deleted = false;
    // let result = await Property.find(query)
    let allData = await Property.find(query).populate({
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
        const user = new Property(req.body);
        await user.save();
        res.status(200).json(user);
    } catch (err) {
        console.error('Failed to create Property:', err);
        res.status(400).json({ error: 'Failed to create Property' });
    }
}

const edit = async (req, res) => {
    try {
        // The owner never changes through edit (the web client sends the id of
        // whoever is editing as createBy)
        const { createBy, ...data } = req.body;
        let result = await Property.updateOne(
            { _id: req.params.id, ...ownerFilter(req) },
            { $set: { ...data, updatedDate: new Date() } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "no Data Found." })
        }
        res.status(200).json(result);
    } catch (err) {
        console.error('Failed to Update Property:', err);
        res.status(400).json({ error: 'Failed to Update Property' });
    }
}

const view = async (req, res) => {
    const { id } = req.params
    let property = await Property.findOne({ _id: id, ...ownerFilter(req) })
    if (!property) return res.status(404).json({ message: "no Data Found." })

    let filteredContacts = await Contact.find({ deleted: false, interestProperty: property._id })
    res.status(200).json({ property, filteredContacts })
}

const deleteData = async (req, res) => {
    try {
        const property = await Property.findOneAndUpdate({ _id: req.params.id, ...ownerFilter(req) }, { deleted: true });
        if (!property) {
            return res.status(404).json({ message: "no Data Found." })
        }
        res.status(200).json({ message: "done", property })
    } catch (err) {
        res.status(404).json({ message: "error", err })
    }
}

const deleteMany = async (req, res) => {
    try {
        const property = await Property.updateMany({ _id: { $in: req.body }, ...ownerFilter(req) }, { $set: { deleted: true } });
        res.status(200).json({ message: "done", property })
    } catch (err) {
        res.status(404).json({ message: "error", err })
    }
}

const storage = (uploadDir) => multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            fs.mkdirSync(uploadDir, { recursive: true });
            cb(null, uploadDir);
        },
        filename: function (req, file, cb) {
            cb(null, uniqueFileName(uploadDir, file.originalname));
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

        const result = await Property.updateOne({ _id: id, ...ownerFilter(req) }, { $push: { [field]: { $each: file } } });
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

const upload = storage('uploads/Property/PropertyPhotos');
const propertyPhoto = saveMedia('propertyPhotos', 'property-photos');

const virtualTours = storage('uploads/Property/virtual-tours-or-videos');
const VirtualToursorVideos = saveMedia('virtualToursOrVideos', 'virtual-tours-or-videos');

const FloorPlansStorage = storage('uploads/Property/floor-plans');
const FloorPlans = saveMedia('floorPlans', 'floor-plans');

const PropertyDocumentsStorage = storage('uploads/Property/property-documents');
const PropertyDocuments = saveMedia('propertyDocuments', 'property-documents', true);



module.exports = { index, add, view, edit, deleteData, deleteMany, upload, propertyPhoto, virtualTours, VirtualToursorVideos, FloorPlansStorage, FloorPlans, PropertyDocumentsStorage, PropertyDocuments }
