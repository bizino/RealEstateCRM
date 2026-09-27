const express = require('express');
const { wrapController } = require('../../middelwares/errorHandler');
const user = wrapController(require('./user'));
const auth = require('../../middelwares/auth');
const { requireAdmin } = auth;

const router = express.Router();

router.post('/admin-register', auth, requireAdmin, user.adminRegister)
router.get('/', auth, requireAdmin, user.index)
router.post('/register', auth, requireAdmin, user.register)
router.post('/login', user.login)
router.post('/deleteMany', auth, requireAdmin, user.deleteMany)
router.get('/view/:id', auth, user.view)
router.delete('/delete/:id', auth, requireAdmin, user.deleteData)
router.put('/edit/:id', auth, user.edit)



module.exports = router
