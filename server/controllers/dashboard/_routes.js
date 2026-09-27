const express = require('express');
const { wrapController } = require('../../middelwares/errorHandler');
const dashboard = wrapController(require('./dashboard'));
const auth = require('../../middelwares/auth');

const router = express.Router();

router.get('/summary', auth, dashboard.summary)

module.exports = router
