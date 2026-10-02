const bcrypt = require('bcrypt');
const { connect, disconnect, clearDatabase, createUser, createUserWithToken, login, api, objectId, DEFAULT_PASSWORD } = require('./helpers');
const User = require('../model/schema/user');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

const newUserPayload = (overrides = {}) => ({
    username: `new.${Date.now()}.${Math.random()}@test.com`,
    password: 'password1',
    firstName: 'New',
    lastName: 'User',
    phoneNumber: 9876543210,
    ...overrides,
});

describe('POST /api/user/login', () => {
    test('returns a token and the user without the password hash', async () => {
        const user = await createUser();
        const res = await login(user.username);
        expect(res.status).toBe(200);
        expect(typeof res.body.token).toBe('string');
        expect(res.body.user._id).toBe(user._id.toString());
        expect(res.body.user.role).toBe('user');
        expect(res.body.user).not.toHaveProperty('password');
        expect(res.headers.authorization).toBe(`Bearer ${res.body.token}`);
    });

    test('rejects a wrong password', async () => {
        const user = await createUser();
        const res = await login(user.username, 'wrong-password');
        expect(res.status).toBe(401);
        expect(res.body.error).toBeDefined();
    });

    test('rejects an unknown username', async () => {
        const res = await login('nobody@test.com');
        expect(res.status).toBe(401);
        expect(res.body.error).toBeDefined();
    });

    test('rejects a deleted user', async () => {
        const user = await createUser({ deleted: true });
        const res = await login(user.username);
        expect(res.status).toBe(401);
    });

    test('returns 400 when username or password is missing', async () => {
        const user = await createUser();
        const res = await api().post('/api/user/login').send({ username: user.username });
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    test('does not allow query operator injection in username', async () => {
        await createUser();
        const res = await api().post('/api/user/login').send({ username: { $ne: null }, password: DEFAULT_PASSWORD });
        expect(res.status).toBe(400);
    });
});

describe('POST /api/user/register', () => {
    test('admin can create a user with a hashed password', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const payload = newUserPayload();
        const res = await api().post('/api/user/register').set('Authorization', token).send(payload);
        expect(res.status).toBe(200);

        const saved = await User.findOne({ username: payload.username });
        expect(saved.role).toBe('user');
        expect(saved.createdDate).toBeInstanceOf(Date);
        expect(saved.password).not.toBe(payload.password);
        expect(await bcrypt.compare(payload.password, saved.password)).toBe(true);
    });

    test('keeps the leading 0 of the phone number', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const payload = newUserPayload({ phoneNumber: '0987654321' });
        await api().post('/api/user/register').set('Authorization', token).send(payload);
        expect((await User.findOne({ username: payload.username })).phoneNumber).toBe('0987654321');
    });

    test('rejects a duplicate username', async () => {
        const { token, user } = await createUserWithToken({ role: 'admin' });
        const res = await api().post('/api/user/register').set('Authorization', token).send(newUserPayload({ username: user.username }));
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/already exist/i);
    });

    test('requires authentication', async () => {
        const res = await api().post('/api/user/register').send(newUserPayload());
        expect(res.status).toBe(401);
        expect(await User.countDocuments()).toBe(0);
    });

    test('a regular user cannot create users', async () => {
        const { token } = await createUserWithToken();
        const res = await api().post('/api/user/register').set('Authorization', token).send(newUserPayload());
        expect(res.status).toBe(403);
    });

    test('returns 400 when username or password is missing', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const res = await api().post('/api/user/register').set('Authorization', token).send({ firstName: 'x' });
        expect(res.status).toBe(400);
    });
});

describe('POST /api/user/admin-register', () => {
    test('anonymous callers cannot create an admin account', async () => {
        const res = await api().post('/api/user/admin-register').send(newUserPayload());
        expect(res.status).toBe(401);
        expect(await User.countDocuments({ role: 'admin' })).toBe(0);
    });

    test('a regular user cannot create an admin account', async () => {
        const { token } = await createUserWithToken();
        const res = await api().post('/api/user/admin-register').set('Authorization', token).send(newUserPayload());
        expect(res.status).toBe(403);
        expect(await User.countDocuments({ role: 'admin' })).toBe(0);
    });

    test('an admin can create another admin', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const payload = newUserPayload();
        const res = await api().post('/api/user/admin-register').set('Authorization', token).send(payload);
        expect(res.status).toBe(200);
        const saved = await User.findOne({ username: payload.username });
        expect(saved.role).toBe('admin');
        expect(saved.createdDate).toBeInstanceOf(Date);
    });
});

describe('GET /api/user', () => {
    test('admin gets the non-deleted users without password hashes', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        await createUser();
        await createUser({ deleted: true });
        const res = await api().get('/api/user').set('Authorization', token);
        expect(res.status).toBe(200);
        expect(res.body.user).toHaveLength(2);
        res.body.user.forEach((u) => expect(u).not.toHaveProperty('password'));
    });

    test('a regular user cannot list all users', async () => {
        const { token } = await createUserWithToken();
        const res = await api().get('/api/user').set('Authorization', token);
        expect(res.status).toBe(403);
    });
});

describe('GET /api/user/options', () => {
    test('lists the names of the active employees for every user', async () => {
        const { token, user } = await createUserWithToken({ firstName: 'An', lastName: 'Nguyễn' });
        await createUser({ deleted: true });
        const res = await api().get('/api/user/options').set('Authorization', token);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toEqual({ _id: user._id.toString(), firstName: 'An', lastName: 'Nguyễn', username: user.username, role: 'user' });
        expect((await api().get('/api/user/options')).status).toBe(401);
    });
});

describe('GET /api/user/view/:id', () => {
    test('a user can view their own profile without the password hash', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().get(`/api/user/view/${user._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
        expect(res.body.username).toBe(user.username);
        expect(res.body).not.toHaveProperty('password');
    });

    test("a regular user cannot view another user's profile", async () => {
        const { token } = await createUserWithToken();
        const other = await createUser();
        const res = await api().get(`/api/user/view/${other._id}`).set('Authorization', token);
        expect(res.status).toBe(403);
    });

    test('admin can view any user', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const other = await createUser();
        const res = await api().get(`/api/user/view/${other._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
        expect(res.body._id).toBe(other._id.toString());
    });

    test('returns 404 for an unknown id and 400 for an invalid id', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        expect((await api().get(`/api/user/view/${objectId()}`).set('Authorization', token)).status).toBe(404);
        expect((await api().get('/api/user/view/not-an-id').set('Authorization', token)).status).toBe(400);
    });
});

describe('PUT /api/user/edit/:id', () => {
    test('a user can update their own profile', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().put(`/api/user/edit/${user._id}`).set('Authorization', token)
            .send({ username: user.username, firstName: 'Changed', lastName: 'Name', phoneNumber: '0912345678' });
        expect(res.status).toBe(200);
        const saved = await User.findById(user._id);
        expect(saved.firstName).toBe('Changed');
        // the leading 0 of Vietnamese numbers must be kept
        expect(saved.phoneNumber).toBe('0912345678');
        expect(saved.updatedDate.getTime()).toBeGreaterThan(user.updatedDate.getTime());
    });

    test('cannot escalate role or overwrite password through edit', async () => {
        const { token, user } = await createUserWithToken();
        await api().put(`/api/user/edit/${user._id}`).set('Authorization', token)
            .send({ username: user.username, firstName: 'A', role: 'admin', password: 'plain' });
        const saved = await User.findById(user._id);
        expect(saved.role).toBe('user');
        expect(saved.password).toBe(user.password);
    });

    test("a regular user cannot edit another user's profile", async () => {
        const { token } = await createUserWithToken();
        const other = await createUser();
        const res = await api().put(`/api/user/edit/${other._id}`).set('Authorization', token).send({ firstName: 'Hacked' });
        expect(res.status).toBe(403);
        expect((await User.findById(other._id)).firstName).toBe(other.firstName);
    });

    test('admin can edit any user', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const other = await createUser();
        const res = await api().put(`/api/user/edit/${other._id}`).set('Authorization', token).send({ firstName: 'ByAdmin' });
        expect(res.status).toBe(200);
        expect((await User.findById(other._id)).firstName).toBe('ByAdmin');
    });

    test('stores the Vietnamese full name, the position and the broker certificate', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().put(`/api/user/edit/${user._id}`).set('Authorization', token)
            .send({ fullName: 'Trần  Thị Bích Ngọc', position: 'Chuyên viên tư vấn', brokerCertificate: '123/CCHN-BĐS', phoneNumber: '+84 912 345 678' });
        expect(res.status).toBe(200);
        const saved = await User.findById(user._id);
        expect(saved).toMatchObject({
            fullName: 'Trần Thị Bích Ngọc', firstName: 'Ngọc', lastName: 'Trần Thị Bích', position: 'Chuyên viên tư vấn',
            brokerCertificate: '123/CCHN-BĐS', phoneNumber: '0912345678', username: user.username,
        });
    });

    test('an admin creates an employee with a full name', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const res = await api().post('/api/user/register').set('Authorization', token)
            .send({ username: 'sale1@congty.vn', password: 'secret123', fullName: 'Lê Văn Sale', position: 'Trưởng nhóm' });
        expect(res.status).toBe(200);
        const saved = await User.findOne({ username: 'sale1@congty.vn' });
        expect(saved).toMatchObject({ fullName: 'Lê Văn Sale', firstName: 'Sale', lastName: 'Lê Văn', position: 'Trưởng nhóm', role: 'user' });
    });

    test('rejects changing the username to one that is already taken', async () => {
        const { token, user } = await createUserWithToken();
        const other = await createUser();
        const res = await api().put(`/api/user/edit/${user._id}`).set('Authorization', token).send({ username: other.username });
        expect(res.status).toBe(400);
    });
});

describe('DELETE /api/user/delete/:id and POST /api/user/deleteMany', () => {
    test('admin soft deletes a user', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const other = await createUser();
        const res = await api().delete(`/api/user/delete/${other._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
        expect((await User.findById(other._id)).deleted).toBe(true);
    });

    test('an admin account cannot be deleted', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const otherAdmin = await createUser({ role: 'admin' });
        const res = await api().delete(`/api/user/delete/${otherAdmin._id}`).set('Authorization', token);
        expect(res.status).toBe(400);
        expect((await User.findById(otherAdmin._id)).deleted).toBe(false);
    });

    test('a regular user cannot delete users', async () => {
        const { token } = await createUserWithToken();
        const other = await createUser();
        expect((await api().delete(`/api/user/delete/${other._id}`).set('Authorization', token)).status).toBe(403);
        expect((await api().post('/api/user/deleteMany').set('Authorization', token).send([other._id])).status).toBe(403);
        expect((await User.findById(other._id)).deleted).toBe(false);
    });

    test('deleteMany soft deletes regular users but never admins', async () => {
        const { token, user: admin } = await createUserWithToken({ role: 'admin' });
        const u1 = await createUser();
        const u2 = await createUser();
        const res = await api().post('/api/user/deleteMany').set('Authorization', token).send([u1._id, u2._id, admin._id]);
        expect(res.status).toBe(200);
        expect((await User.findById(u1._id)).deleted).toBe(true);
        expect((await User.findById(u2._id)).deleted).toBe(true);
        expect((await User.findById(admin._id)).deleted).toBe(false);
    });

    test('returns 404 when deleting an unknown user', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const res = await api().delete(`/api/user/delete/${objectId()}`).set('Authorization', token);
        expect(res.status).toBe(404);
    });
});

describe('PUT /api/user/change-password/:id', () => {
    const changePassword = (token, id, body) => api().put(`/api/user/change-password/${id}`).set('Authorization', token).send(body);

    test('a user changes their own password with the current one', async () => {
        const { token, user } = await createUserWithToken();
        const res = await changePassword(token, user._id, { currentPassword: DEFAULT_PASSWORD, newPassword: 'new-secret-1' });
        expect(res.status).toBe(200);
        expect((await login(user.username, 'new-secret-1')).status).toBe(200);
        expect((await login(user.username, DEFAULT_PASSWORD)).status).toBe(401);
    });

    test('a wrong current password is refused without logging the user out', async () => {
        const { token, user } = await createUserWithToken();
        const res = await changePassword(token, user._id, { currentPassword: 'wrong', newPassword: 'new-secret-1' });
        // 400, not 401: the web client treats 401 as an expired session
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/current password/i);
        expect((await login(user.username, DEFAULT_PASSWORD)).status).toBe(200);
    });

    test('the new password needs at least 6 characters', async () => {
        const { token, user } = await createUserWithToken();
        const res = await changePassword(token, user._id, { currentPassword: DEFAULT_PASSWORD, newPassword: '123' });
        expect(res.status).toBe(400);
        expect((await login(user.username, DEFAULT_PASSWORD)).status).toBe(200);
    });

    test("a regular user cannot change another user's password", async () => {
        const { token } = await createUserWithToken();
        const other = await createUser();
        const res = await changePassword(token, other._id, { currentPassword: DEFAULT_PASSWORD, newPassword: 'hacked-123' });
        expect(res.status).toBe(403);
        expect((await login(other.username, DEFAULT_PASSWORD)).status).toBe(200);
    });

    test("an admin resets another user's password without knowing it", async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        const other = await createUser();
        const res = await changePassword(token, other._id, { newPassword: 'reset-by-admin' });
        expect(res.status).toBe(200);
        expect((await login(other.username, 'reset-by-admin')).status).toBe(200);
    });

    test('an admin changing their own password confirms the current one', async () => {
        const { token, user } = await createUserWithToken({ role: 'admin' });
        expect((await changePassword(token, user._id, { newPassword: 'no-current-1' })).status).toBe(400);
        expect((await changePassword(token, user._id, { currentPassword: DEFAULT_PASSWORD, newPassword: 'admin-new-1' })).status).toBe(200);
    });

    test('returns 404 for an unknown user and 401 without token', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        expect((await changePassword(token, objectId(), { newPassword: 'whatever-1' })).status).toBe(404);
        expect((await api().put(`/api/user/change-password/${objectId()}`).send({ newPassword: 'whatever-1' })).status).toBe(401);
    });
});
