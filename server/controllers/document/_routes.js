const express = require('express');
const { wrapController } = require('../../middelwares/errorHandler');
const document = wrapController(require('./document'));
const auth = require('../../middelwares/auth');

const router = express.Router();

router.get('/', auth, document.index)
router.post('/add', auth, document.upload.array('files'), document.file)
router.get('/download/:id', auth, document.downloadFile)
router.post('/link-document/:id', auth, document.LinkDocument)
router.delete('/delete/:id', auth, document.deleteFile)


module.exports = router