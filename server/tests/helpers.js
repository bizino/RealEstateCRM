const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../app');
const User = require('../model/schema/user');

const DEFAULT_PASSWORD = 'secret123';

// Each test file gets its own database on the shared in-memory server
const connect = async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: `test_${randomUUID()}` });
};

const disconnect = async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
};

const clearDatabase = async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

let counter = 0;
const createUser = async ({ role = 'user', password = DEFAULT_PASSWORD, deleted = false, ...rest } = {}) => {
    counter += 1;
    return User.create({
        username: rest.username || `user${counter}.${Date.now()}@test.com`,
        password: await bcrypt.hash(password, 4),
        firstName: rest.firstName || `First${counter}`,
        lastName: rest.lastName || `Last${counter}`,
        phoneNumber: rest.phoneNumber || 9000000000 + counter,
        role,
        deleted,
    });
};

const login = (username, password = DEFAULT_PASSWORD) => request(app).post('/api/user/login').send({ username, password });

// Creates a user and logs in through the real endpoint, returning { user, token }
const createUserWithToken = async (options = {}) => {
    const user = await createUser(options);
    const res = await login(user.username, options.password || DEFAULT_PASSWORD);
    if (res.status !== 200) {
        throw new Error(`Login failed for ${user.username}: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return { user, token: res.body.token };
};

const api = () => request(app);

const objectId = () => new mongoose.Types.ObjectId().toString();

module.exports = {
    DEFAULT_PASSWORD,
    connect,
    disconnect,
    clearDatabase,
    createUser,
    createUserWithToken,
    login,
    api,
    objectId,
};
