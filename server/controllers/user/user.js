const User = require('../../model/schema/user')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../../middelwares/auth');
const { isAdmin } = require('../../utils/access');

const hasCredentials = (username, password) => typeof username === 'string' && username.trim() !== '' && typeof password === 'string' && password !== '';

const createUser = async (req, res, role) => {
    const { username, password, firstName, lastName, phoneNumber } = req.body;
    if (!hasCredentials(username, password)) {
        return res.status(400).json({ message: 'Username and password are required' });
    }
    const user = await User.findOne({ username: username })
    if (user) {
        return res.status(400).json({ message: `${role === 'admin' ? 'Admin' : 'user'} already exist please try another email` })
    }
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create a new user
    const newUser = new User({ username, password: hashedPassword, firstName, lastName, phoneNumber, role, createdDate: new Date() });
    // Save the user to the database
    await newUser.save();
    res.status(200).json({ message: `${role === 'admin' ? 'Admin' : 'User'} created successfully` });
}

// Admin register
const adminRegister = async (req, res) => {
    try {
        await createUser(req, res, 'admin');
    } catch (error) {
        console.error('Failed to create admin:', error);
        res.status(500).json({ error: 'Failed to create admin' });
    }
}

// User Registration
const register = async (req, res) => {
    try {
        await createUser(req, res, 'user');
    } catch (error) {
        console.error('Failed to create user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
}

const index = async (req, res) => {
    try {
        let user = await User.find({ deleted: false })
        res.status(200).json({ user });
    } catch (error) {
        res.status(500).json({ error });
    }
}

const view = async (req, res) => {
    if (!isAdmin(req) && req.params.id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied.' })
    }
    let user = await User.findOne({ _id: req.params.id })
    if (!user) return res.status(404).json({ message: "no Data Found." })
    res.status(200).json(user)
}

let deleteData = async (req, res) => {
    const userId = req.params.id;

    // Assuming you have retrieved the user document using userId
    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found', });
    }
    if (user.role !== 'admin') {
        // Update the user's 'deleted' field to true
        await User.updateOne({ _id: userId }, { $set: { deleted: true } });
        res.send({ message: 'Record deleted Successfully', });
    } else {
        res.status(400).json({ message: 'admin can not delete', });
    }
}

const deleteMany = async (req, res) => {
    if (!Array.isArray(req.body)) {
        return res.status(400).json({ message: 'An array of ids is expected' })
    }
    const updatedUsers = await User.updateMany({ _id: { $in: req.body }, role: { $ne: 'admin' } }, { $set: { deleted: true } });
    res.status(200).json({ message: "done", updatedUsers })
}

const edit = async (req, res) => {
    if (!isAdmin(req) && req.params.id !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied.' })
    }
    try {
        let { username, firstName, lastName, phoneNumber } = req.body

        if (username && await User.exists({ username, _id: { $ne: req.params.id } })) {
            return res.status(400).json({ message: 'user already exist please try another email' });
        }
        let result = await User.updateOne(
            { _id: req.params.id },
            {
                $set: {
                    username, firstName, lastName, phoneNumber, updatedDate: new Date()
                }
            }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(result);
    } catch (err) {
        console.error('Failed to Update User:', err);
        res.status(400).json({ error: 'Failed to Update User' });
    }
}


// Users change their own password by confirming the current one, admins may
// also reset the password of another user
const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const isSelf = req.params.id === req.user.userId;
    if (!isSelf && !isAdmin(req)) {
        return res.status(403).json({ message: 'Access denied.' })
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ message: 'The new password must have at least 6 characters' })
    }
    const user = await User.findOne({ _id: req.params.id, deleted: false })
    if (!user) {
        return res.status(404).json({ message: 'User not found' })
    }
    // 400 and not 401: the web client treats 401 as an expired session
    if (isSelf && !(typeof currentPassword === 'string' && await bcrypt.compare(currentPassword, user.password))) {
        return res.status(400).json({ message: 'Current password is incorrect' })
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.updatedDate = new Date();
    await user.save();
    res.status(200).json({ message: 'Password changed successfully' })
}

const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!hasCredentials(username, password)) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        // Find the user by username
        const user = await User.findOne({ username, deleted: false });
        if (!user) {
            res.status(401).json({ error: 'Authentication failed, invalid username' });
            return;
        }
        // Compare the provided password with the hashed password stored in the database
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            res.status(401).json({ error: 'Authentication failed,password does not match' });
            return;
        }
        // Create a JWT token
        const token = jwt.sign({ userId: user._id }, getJwtSecret(), { expiresIn: '1d' });

        res.status(200).setHeader('Authorization', `Bearer ${token}`).json({ token: token, user });
    } catch (error) {
        res.status(500).json({ error: 'An error occurred' });
    }
}

module.exports = { register, login, adminRegister, index, deleteMany, view, deleteData, edit, changePassword }
