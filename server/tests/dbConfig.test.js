const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const connectDB = require('../db/config');
const User = require('../model/schema/user');

afterEach(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
});

const silence = () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => { });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => { });
    return { mockRestore: () => { log.mockRestore(); warn.mockRestore(); }, warn };
};

test('seeds the default admin on an empty database', async () => {
    const log = silence();
    await connectDB(process.env.TEST_MONGO_URI, `seed_${randomUUID()}`);
    log.mockRestore();
    const admins = await User.find({ role: 'admin' });
    expect(admins).toHaveLength(1);
    expect(admins[0].username).toBe('admin@gmail.com');
    expect(await bcrypt.compare('admin123', admins[0].password)).toBe(true);
});

test('warns when the default demo password is used', async () => {
    const log = silence();
    await connectDB(process.env.TEST_MONGO_URI, `seed_${randomUUID()}`);
    expect(log.warn).toHaveBeenCalledWith(expect.stringMatching(/ADMIN_PASSWORD/));
    log.mockRestore();
});

test('uses ADMIN_EMAIL and ADMIN_PASSWORD for a new installation', async () => {
    process.env.ADMIN_EMAIL = 'owner@company.vn';
    process.env.ADMIN_PASSWORD = 'S3cure-Pass';
    const log = silence();
    try {
        await connectDB(process.env.TEST_MONGO_URI, `seed_${randomUUID()}`);
        expect(log.warn).not.toHaveBeenCalled();
    } finally {
        log.mockRestore();
        delete process.env.ADMIN_EMAIL;
        delete process.env.ADMIN_PASSWORD;
    }
    const admin = await User.findOne({ role: 'admin' });
    expect(admin.username).toBe('owner@company.vn');
    expect(await bcrypt.compare('S3cure-Pass', admin.password)).toBe(true);
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
