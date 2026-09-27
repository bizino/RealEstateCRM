const { connect, disconnect, clearDatabase, createUserWithToken, api, objectId } = require('./helpers');
const Contact = require('../model/schema/contact');
const Property = require('../model/schema/property');
const User = require('../model/schema/user');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

const contactPayload = (createBy, overrides = {}) => ({
    firstName: 'John',
    lastName: 'Doe',
    title: 'Mr.',
    email: 'john@example.com',
    phoneNumber: 9876543210,
    mobileNumber: 9876543211,
    physicalAddress: '1 Main St',
    leadSource: 'Website',
    createBy,
    ...overrides,
});

describe('POST /api/contact/add', () => {
    test('creates a contact and sets createdDate', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().post('/api/contact/add').set('Authorization', token).send(contactPayload(user._id));
        expect(res.status).toBe(200);
        expect(res.body._id).toBeDefined();
        expect(res.body.createdDate).toBeDefined();
        expect(res.body.deleted).toBe(false);
        expect(await Contact.countDocuments()).toBe(1);
    });

    test('defaults createBy to the authenticated user', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().post('/api/contact/add').set('Authorization', token).send(contactPayload(undefined));
        expect(res.status).toBe(200);
        expect(res.body.createBy).toBe(user._id.toString());
    });

    test('a regular user cannot create a contact on behalf of another user', async () => {
        const { token, user } = await createUserWithToken();
        const { user: other } = await createUserWithToken();
        const res = await api().post('/api/contact/add').set('Authorization', token).send(contactPayload(other._id));
        expect(res.status).toBe(200);
        expect(res.body.createBy).toBe(user._id.toString());
    });

    test('returns 400 for invalid data', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().post('/api/contact/add').set('Authorization', token).send(contactPayload(user._id, { phoneNumber: 'not-a-number' }));
        expect(res.status).toBe(400);
    });
});

describe('GET /api/contact', () => {
    test('admin sees all contacts, regular users only their own', async () => {
        const admin = await createUserWithToken({ role: 'admin' });
        const u1 = await createUserWithToken();
        const u2 = await createUserWithToken();
        await Contact.create([contactPayload(u1.user._id), contactPayload(u1.user._id), contactPayload(u2.user._id)]);

        const adminRes = await api().get('/api/contact').set('Authorization', admin.token);
        expect(adminRes.status).toBe(200);
        expect(adminRes.body).toHaveLength(3);

        // the web client sends ?createBy=<own id>
        const ownRes = await api().get(`/api/contact/?createBy=${u1.user._id}`).set('Authorization', u1.token);
        expect(ownRes.body).toHaveLength(2);

        // omitting the filter must not leak other users' contacts
        const noFilterRes = await api().get('/api/contact').set('Authorization', u2.token);
        expect(noFilterRes.body).toHaveLength(1);

        // asking for another user's contacts must not leak them either
        const otherRes = await api().get(`/api/contact/?createBy=${u1.user._id}`).set('Authorization', u2.token);
        expect(otherRes.body.every((c) => c.createBy._id === u2.user._id.toString())).toBe(true);
    });

    test('does not leak password hashes of the populated creator', async () => {
        const { token, user } = await createUserWithToken();
        await Contact.create(contactPayload(user._id));
        const res = await api().get('/api/contact').set('Authorization', token);
        expect(res.body[0].createBy.username).toBe(user.username);
        expect(res.body[0].createBy).not.toHaveProperty('password');
    });

    test('ignores query operators sent by a regular user', async () => {
        const u1 = await createUserWithToken();
        const u2 = await createUserWithToken();
        await Contact.create([contactPayload(u1.user._id), contactPayload(u2.user._id)]);
        const res = await api().get(`/api/contact/?createBy[$ne]=${u2.user._id}&$where=1`).set('Authorization', u2.token);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].createBy._id).toBe(u2.user._id.toString());
    });

    test('excludes soft deleted contacts and contacts of deleted users', async () => {
        const admin = await createUserWithToken({ role: 'admin' });
        const u1 = await createUserWithToken();
        const u2 = await createUserWithToken();
        await Contact.create([contactPayload(u1.user._id), contactPayload(u1.user._id, { deleted: true }), contactPayload(u2.user._id)]);
        await User.updateOne({ _id: u2.user._id }, { deleted: true });

        const res = await api().get('/api/contact').set('Authorization', admin.token);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
    });

    test('returns 400 (and keeps the server alive) for an invalid filter value', async () => {
        const admin = await createUserWithToken({ role: 'admin' });
        const res = await api().get('/api/contact/?createBy=not-an-id').set('Authorization', admin.token);
        expect(res.status).toBe(400);
    });
});

describe('GET /api/contact/view/:id', () => {
    test('returns the contact with its related history', async () => {
        const { token, user } = await createUserWithToken();
        const contact = await Contact.create(contactPayload(user._id));
        const res = await api().get(`/api/contact/view/${contact._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
        expect(res.body.contact._id).toBe(contact._id.toString());
        ['EmailHistory', 'phoneCallHistory', 'meetingHistory', 'textMsg', 'task', 'Document'].forEach((key) => {
            expect(Array.isArray(res.body[key])).toBe(true);
        });
    });

    test('returns 404 for an unknown id and 400 for an invalid id', async () => {
        const { token } = await createUserWithToken();
        expect((await api().get(`/api/contact/view/${objectId()}`).set('Authorization', token)).status).toBe(404);
        expect((await api().get('/api/contact/view/abc').set('Authorization', token)).status).toBe(400);
    });

    test("a regular user cannot view another user's contact", async () => {
        const u1 = await createUserWithToken();
        const u2 = await createUserWithToken();
        const contact = await Contact.create(contactPayload(u1.user._id));
        const res = await api().get(`/api/contact/view/${contact._id}`).set('Authorization', u2.token);
        expect(res.status).toBe(404);
    });
});

describe('PUT /api/contact/edit/:id', () => {
    test('updates the contact and its updatedDate', async () => {
        const { token, user } = await createUserWithToken();
        const contact = await Contact.create(contactPayload(user._id));
        const res = await api().put(`/api/contact/edit/${contact._id}`).set('Authorization', token).send({ firstName: 'Jane' });
        expect(res.status).toBe(200);
        const saved = await Contact.findById(contact._id);
        expect(saved.firstName).toBe('Jane');
        expect(saved.updatedDate.getTime()).toBeGreaterThan(contact.updatedDate.getTime());
    });

    test('returns 404 for an unknown id and 400 for an invalid id', async () => {
        const { token } = await createUserWithToken();
        expect((await api().put(`/api/contact/edit/${objectId()}`).set('Authorization', token).send({ firstName: 'x' })).status).toBe(404);
        expect((await api().put('/api/contact/edit/abc').set('Authorization', token).send({ firstName: 'x' })).status).toBe(400);
    });

    test('keeps the original owner when an admin edits the contact', async () => {
        const owner = await createUserWithToken();
        const admin = await createUserWithToken({ role: 'admin' });
        const contact = await Contact.create(contactPayload(owner.user._id));
        // the web client always sends the id of the logged in user as createBy
        const res = await api().put(`/api/contact/edit/${contact._id}`).set('Authorization', admin.token)
            .send({ ...contactPayload(admin.user._id), firstName: 'Edited' });
        expect(res.status).toBe(200);
        const saved = await Contact.findById(contact._id);
        expect(saved.firstName).toBe('Edited');
        expect(saved.createBy.toString()).toBe(owner.user._id.toString());
        expect((await api().get('/api/contact').set('Authorization', owner.token)).body).toHaveLength(1);
    });

    test("a regular user cannot edit another user's contact", async () => {
        const u1 = await createUserWithToken();
        const u2 = await createUserWithToken();
        const contact = await Contact.create(contactPayload(u1.user._id));
        const res = await api().put(`/api/contact/edit/${contact._id}`).set('Authorization', u2.token).send({ firstName: 'Hacked' });
        expect(res.status).toBe(404);
        expect((await Contact.findById(contact._id)).firstName).toBe('John');
    });
});

describe('POST /api/contact/add-property-interest/:id', () => {
    test('stores the interested properties', async () => {
        const { token, user } = await createUserWithToken();
        const contact = await Contact.create(contactPayload(user._id));
        const property = await Property.create({ propertyType: 'House', createBy: user._id });
        const res = await api().post(`/api/contact/add-property-interest/${contact._id}`).set('Authorization', token).send([property._id]);
        expect(res.status).toBe(200);
        const saved = await Contact.findById(contact._id);
        expect(saved.interestProperty.map(String)).toEqual([property._id.toString()]);

        const view = await api().get(`/api/contact/view/${contact._id}`).set('Authorization', token);
        expect(view.body.interestProperty.interestProperty[0].propertyType).toBe('House');
    });

    test('returns 404 for an unknown contact', async () => {
        const { token } = await createUserWithToken();
        const res = await api().post(`/api/contact/add-property-interest/${objectId()}`).set('Authorization', token).send([]);
        expect(res.status).toBe(404);
    });
});

describe('DELETE /api/contact/delete/:id and POST /api/contact/deleteMany', () => {
    test('soft deletes one contact', async () => {
        const { token, user } = await createUserWithToken();
        const contact = await Contact.create(contactPayload(user._id));
        const res = await api().delete(`/api/contact/delete/${contact._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
        expect((await Contact.findById(contact._id)).deleted).toBe(true);
    });

    test('returns 404 for an unknown contact', async () => {
        const { token } = await createUserWithToken();
        const res = await api().delete(`/api/contact/delete/${objectId()}`).set('Authorization', token);
        expect(res.status).toBe(404);
    });

    test('soft deletes many contacts', async () => {
        const { token, user } = await createUserWithToken();
        const [c1, c2, c3] = await Contact.create([contactPayload(user._id), contactPayload(user._id), contactPayload(user._id)]);
        const res = await api().post('/api/contact/deleteMany').set('Authorization', token).send([c1._id, c2._id]);
        expect(res.status).toBe(200);
        expect((await Contact.findById(c1._id)).deleted).toBe(true);
        expect((await Contact.findById(c2._id)).deleted).toBe(true);
        expect((await Contact.findById(c3._id)).deleted).toBe(false);
    });

    test("a regular user cannot delete another user's contacts", async () => {
        const u1 = await createUserWithToken();
        const u2 = await createUserWithToken();
        const contact = await Contact.create(contactPayload(u1.user._id));
        expect((await api().delete(`/api/contact/delete/${contact._id}`).set('Authorization', u2.token)).status).toBe(404);
        await api().post('/api/contact/deleteMany').set('Authorization', u2.token).send([contact._id]);
        expect((await Contact.findById(contact._id)).deleted).toBe(false);
    });
});
