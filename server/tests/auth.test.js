const jwt = require('jsonwebtoken');
const { connect, disconnect, clearDatabase, createUserWithToken, createUser, api } = require('./helpers');
const User = require('../model/schema/user');
const auth = require('../middelwares/auth');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

const mockResponse = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
};

describe('auth middleware', () => {
    test('responds exactly once with 401 when the token is missing', async () => {
        const res = mockResponse();
        const next = jest.fn();
        await auth({ headers: {} }, res, next);
        expect(res.status).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('rejects a request without token with 401', async () => {
        const res = await api().get('/api/contact');
        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/token missing/i);
    });

    test('rejects an invalid token with 401', async () => {
        const res = await api().get('/api/contact').set('Authorization', 'not-a-jwt');
        expect(res.status).toBe(401);
    });

    test('rejects a token signed with another secret with 401', async () => {
        const user = await createUser();
        const forged = jwt.sign({ userId: user._id }, 'some-other-secret', { expiresIn: '1d' });
        const res = await api().get('/api/contact').set('Authorization', forged);
        expect(res.status).toBe(401);
    });

    test('rejects an expired token with 401', async () => {
        const { token } = await createUserWithToken();
        const realNow = Date.now();
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(realNow + 2 * 24 * 60 * 60 * 1000);
        const res = await api().get('/api/contact').set('Authorization', token);
        nowSpy.mockRestore();
        expect(res.status).toBe(401);
    });

    test('accepts the raw token sent by the web client', async () => {
        const { token } = await createUserWithToken();
        const res = await api().get('/api/contact').set('Authorization', token);
        expect(res.status).toBe(200);
    });

    test('accepts a "Bearer <token>" authorization header', async () => {
        const { token } = await createUserWithToken();
        const res = await api().get('/api/contact').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });

    test('rejects the token of a user that was deleted after login', async () => {
        const { user, token } = await createUserWithToken();
        await User.updateOne({ _id: user._id }, { $set: { deleted: true } });
        const res = await api().get('/api/contact').set('Authorization', token);
        expect(res.status).toBe(401);
    });
});

describe('error handling', () => {
    test('malformed JSON body returns 400 instead of an HTML error page', async () => {
        const res = await api().post('/api/user/login').set('Content-Type', 'application/json').send('{"username": ');
        expect(res.status).toBe(400);
        expect(res.headers['content-type']).toMatch(/json/);
    });

    test('root endpoint responds', async () => {
        const res = await api().get('/');
        expect(res.status).toBe(200);
        expect(res.text).toBe('Welcome to my world...');
    });
});
