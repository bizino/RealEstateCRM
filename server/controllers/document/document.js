const multer = require('multer');
const DocumentSchema = require('../../model/schema/document')
const fs = require('fs');
const { castIds, isValidId, ownerFilter, resolveOwner, scopedQuery } = require('../../utils/access');
const { uniqueFileName, removeUploadedFiles } = require('../../utils/upload');


const index = async (req, res) => {
    // An invalid createBy throws here and is answered with a 400 by the error handler
    const query = castIds(scopedQuery(req), ['createBy'])

    try {
        const result = await DocumentSchema.aggregate([
            { $unwind: '$file' },
            { $match: { 'file.deleted': false } },
            { $match: query },
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

        res.send(result);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to load documents' });
    }
}


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const folderPath = 'uploads/document/';
        fs.mkdirSync(folderPath, { recursive: true }); // Create the directory if it doesn't exist
        cb(null, folderPath);
    },
    filename: function (req, file, cb) {
        // A timestamp is added when a file with the same name already exists
        cb(null, uniqueFileName('uploads/document/', file.originalname));
    },
});



const upload = multer({ storage: storage });

const file = async (req, res) => {
    try {
        const { filename, folderName } = req.body;
        const createBy = resolveOwner(req, req.body.createBy);

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded.' });
        }
        if (typeof folderName !== 'string' || folderName.trim() === '') {
            await removeUploadedFiles(req.files);
            return res.status(400).json({ message: 'Folder name is required.' });
        }

        const url = req.protocol + '://' + req.get('host');

        const files = req.files.map((file) => ({
            fileName: filename || file.filename,
            path: file.path,
            img: `${url}/api/document/images/${file.filename}`,
            createOn: new Date(),
        }));

        // Check if the folder exists in the database (folders belong to one user)
        let folder = await DocumentSchema.findOne({ folderName, createBy });

        if (!folder) {
            // DocumentSchema does not exist, create a new folder and add the file
            folder = new DocumentSchema({
                folderName,
                file: files, // Directly assign the files array
                createBy
            });
        } else {
            folder.file.push(...files); // Use spread operator to add elements of the files array
        }

        // Save the folder in the database
        await folder.save();

        res.json({ message: 'Folder and files added successfully' });
    } catch (err) {
        console.error(err);
        await removeUploadedFiles(req.files);
        res.status(500).json({ message: 'Failed to upload files' });
    }
}


const downloadFile = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) {
            return res.status(400).json({ message: 'Invalid file id' });
        }

        // Check if the folder exists in the database
        const folder = await DocumentSchema.findOne({ 'file._id': id });

        if (!folder) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Find the file with the specified fileName within the folder
        const file = folder.file.find((f) => f._id.toString() === id);


        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        res.download(file.path, (err) => {
            // The file was removed from the disk (e.g. uploads not persisted on redeploy)
            if (err && !res.headersSent) {
                res.status(404).json({ message: 'File not found' });
            }
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: error.message });
    }
}

const deleteFile = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) {
            return res.status(400).json({ message: 'Invalid file id' });
        }

        // Check if the folder exists in the database
        const folder = await DocumentSchema.findOne({ 'file._id': id, ...ownerFilter(req) });
        if (!folder) {
            return res.status(404).json({ message: 'File not found' });
        }
        // Find the file with the specified fileName within the folder
        const file = folder.file.find((f) => f._id.toString() === id);
        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Set the 'deleted' flag to true for the file to soft delete it
        file.deleted = true;

        // Save the updated document
        await folder.save();
        res.status(200).json({ message: "File deleted successfully.", document: folder });

    } catch (err) {
        res.status(500).json({ message: "Error deleting file.", error: err });
    }
};

const LinkDocument = async (req, res) => {
    try {
        const { id } = req.params;
        let { linkContact, linkLead } = req.body

        if (!linkContact && !linkLead) {
            return res.status(400).json({ message: 'Select valid contact or lead ' });
        }
        if (!isValidId(id) || (linkContact && !isValidId(linkContact)) || (linkLead && !isValidId(linkLead))) {
            return res.status(400).json({ message: 'Invalid id' });
        }

        // Check if the folder exists in the database
        const folder = await DocumentSchema.findOne({ 'file._id': id, ...ownerFilter(req) });
        if (!folder) {
            return res.status(404).json({ message: 'File not found' });
        }

        const file = folder.file.find((f) => f._id.toString() === id);
        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        if (linkContact) {
            file.linkContact = linkContact;
            file.linkLead = null;
        }
        if (linkLead) {
            file.linkLead = linkLead;
            file.linkContact = null;
        }

        // Save the updated document
        const savedFolder = await folder.save();

        res.status(200).json({ message: "File link successfully.", document: savedFolder });
    } catch (err) {
        res.status(500).json({ message: "Error Link file.", error: err });
    }
};

module.exports = { file, upload, index, downloadFile, deleteFile, LinkDocument }