const fs = require('fs');
const path = require('path');

// Keep the original file name, adding a timestamp when a file with the same name
// already exists. The whole extension is kept ("a.v2.pdf" -> "a.v2-<ts>.pdf").
const uniqueFileName = (uploadDir, originalName) => {
    if (!fs.existsSync(path.join(uploadDir, originalName))) {
        return originalName;
    }
    const { name, ext } = path.parse(originalName);
    const timestamp = Date.now() + Math.floor(Math.random() * 90);
    return `${name}-${timestamp}${ext}`;
};

// multer reads the file names of multipart forms as latin1: Vietnamese names
// sent in UTF-8 by browsers ("Sổ hồng.pdf") arrive garbled ("Sá» há»ng.pdf")
const decodeFileName = (name) => {
    const decoded = Buffer.from(String(name), 'latin1').toString('utf8');
    return decoded.includes('\uFFFD') ? String(name) : decoded;
};

// Remove files stored by multer for a request that was rejected afterwards
const removeUploadedFiles = (files = []) => Promise.all(
    files.map((file) => fs.promises.rm(file.path, { force: true }))
);

module.exports = { uniqueFileName, removeUploadedFiles, decodeFileName };
