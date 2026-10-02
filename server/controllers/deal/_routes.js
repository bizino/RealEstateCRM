const express = require('express');
const { wrapController } = require('../../middelwares/errorHandler');
const deal = wrapController(require('./deal'));
const auth = require('../../middelwares/auth');

const router = express.Router();

router.get('/', auth, deal.index)
router.get('/view/:id', auth, deal.view)
router.post('/add', auth, deal.add)
router.put('/edit/:id', auth, deal.edit)
router.delete('/delete/:id', auth, deal.deleteData)
router.post('/deleteMany', auth, deal.deleteMany)

module.exports = router
