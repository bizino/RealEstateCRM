const express = require('express');
const { wrapController } = require('../../middelwares/errorHandler');
const reporting = wrapController(require('./reporting'));
const auth = require('../../middelwares/auth');

const router = express.Router();

router.get('/', auth, reporting.index)
router.post('/index', auth, reporting.data)


module.exports = router