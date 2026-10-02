const express = require('express');
const auth = require('../../middelwares/auth');
const { wrapController } = require('../../middelwares/errorHandler');
const meeting = wrapController(require('./meeting'))

const router = express.Router();

router.get('/', auth, meeting.index)
router.get('/view/:id', auth, meeting.view)
router.post('/add', auth, meeting.add)
router.put('/edit/:id', auth, meeting.edit)
router.delete('/delete/:id', auth, meeting.deleteData)
router.post('/deleteMany', auth, meeting.deleteMany)

module.exports = router
