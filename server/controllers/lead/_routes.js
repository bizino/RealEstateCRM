const express = require('express');
const { wrapController } = require('../../middelwares/errorHandler');
const lead = wrapController(require('./lead'));
const auth = require('../../middelwares/auth');

const router = express.Router();

router.get('/', auth, lead.index)
router.post('/add', auth, lead.add)
router.post('/addMany', auth, lead.addMany)
router.post('/import', auth, lead.importLeads)
router.post('/convert/:id', auth, lead.convert)
router.get('/view/:id', auth, lead.view)
router.put('/edit/:id', auth, lead.edit)
router.delete('/delete/:id', auth, lead.deleteData)
router.post('/deleteMany', auth, lead.deleteMany)


module.exports = router