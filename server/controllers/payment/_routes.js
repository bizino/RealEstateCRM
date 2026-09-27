const express = require('express');
const { wrapController } = require('../../middelwares/errorHandler');
const payment = wrapController(require('./payment'))
const auth = require('../../middelwares/auth');

const router = express.Router();


router.post('/add', payment.add)
// Lists card holders and card details, admins only
router.get('/', auth, auth.requireAdmin, payment.index)

module.exports = router
