const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const connectDB = require('../db/config');
const User = require('../model/schema/user');

afterEach(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
});

const silence = () => jest.spyOn(console, 'log').mockImplementation(() => { });

test('seeds the default admin on an empty database', async () => {
    const log = silence();
    await connectDB(process.env.TEST_MONGO_URI, `seed_${randomUUID()}`);
    log.mockRestore();
    const admins = await User.find({ role: 'admin' });
    expect(admins).toHaveLength(1);
    expect(admins[0].username).toBe('admin@gmail.com');
    expect(await bcrypt.compare('admin123', admins[0].password)).toBe(true);
});

test('does not create a second admin when the database is re-connected', async () => {
    const dbName = `seed_${randomUUID()}`;
    const log = silence();
    await connectDB(process.env.TEST_MONGO_URI, dbName);
    await mongoose.disconnect();
    await connectDB(process.env.TEST_MONGO_URI, dbName);
    log.mockRestore();
    expect(await User.countDocuments({ role: 'admin' })).toBe(1);
});

test('restores a soft deleted admin', async () => {
    const dbName = `seed_${randomUUID()}`;
    const log = silence();
    await connectDB(process.env.TEST_MONGO_URI, dbName);
    await User.updateMany({ role: 'admin' }, { deleted: true });
    await mongoose.disconnect();
    await connectDB(process.env.TEST_MONGO_URI, dbName);
    log.mockRestore();
    const admins = await User.find({ role: 'admin' });
    expect(admins).toHaveLength(1);
    expect(admins[0].deleted).toBe(false);
});
