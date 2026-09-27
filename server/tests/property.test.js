const fs = require('fs');
const os = require('os');
const path = require('path');

// Uploads are written relative to the working directory, keep them out of the repository
const originalCwd = process.cwd();
const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-property-'));
process.chdir(uploadRoot);

const { connect, disconnect, clearDatabase, createUserWithToken, api, objectId } = require('./helpers');
const Property = require('../model/schema/property');
const Contact = require('../model/schema/contact');

beforeAll(connect);
afterAll(async () => {
    await disconnect();
    process.chdir(originalCwd);
    fs.rmSync(uploadRoot, { recursive: true, force: true });
});
afterEach(clearDatabase);

const propertyPayload = (createBy, overrides = {}) => ({
    propertyType: 'Apartment',
    propertyAddress: '12 Nguyen Hue, HCMC',
    listingPrice: '250000',
    squareFootage: '80',
    numberofBedrooms: 2,
    numberofBathrooms: 2,
    yearBuilt: 2015,
    createBy,
    ...overrides,
});

describe('POST /api/property/add', () => {
    test('creates a property with createdDate', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().post('/api/property/add').set('Authorization', token).send(propertyPayload(user._id));
        expect(res.status).toBe(200);
        expect(res.body.createdDate).toBeDefined();
        expect(await Property.countDocuments()).toBe(1);
    });

    test('returns 400 for invalid data', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().post('/api/property/add').set('Authorization', token).send(propertyPayload(user._id, { yearBuilt: 'old' }));
        expect(res.status).toBe(400);
    });
});

describe('GET /api/property', () => {
    test('admin sees all properties, regular users only their own', async () => {
        const admin = await createUserWithToken({ role: 'admin' });
        const u1 = await createUserWithToken();
        const u2 = await createUserWithToken();
        await Property.create([propertyPayload(u1.user._id), propertyPayload(u2.user._id), propertyPayload(u2.user._id, { deleted: true })]);
        expect((await api().get('/api/property').set('Authorization', admin.token)).body).toHaveLength(2);
        expect((await api().get('/api/property').set('Authorization', u1.token)).body).toHaveLength(1);
    });

    test('returns 400 for an invalid filter value', async () => {
        const admin = await createUserWithToken({ role: 'admin' });
        expect((await api().get('/api/property/?createBy=1').set('Authorization', admin.token)).status).toBe(400);
    });
});

describe('GET /api/property/view/:id', () => {
    test('returns the property and the contacts interested in it', async () => {
        const { token, user } = await createUserWithToken();
        const property = await Property.create(propertyPayload(user._id));
        const other = await Property.create(propertyPayload(user._id));
        await Contact.create([
            { firstName: 'Interested', interestProperty: [property._id], createBy: user._id },
            { firstName: 'Deleted', interestProperty: [property._id], createBy: user._id, deleted: true },
            { firstName: 'Other', interestProperty: [other._id], createBy: user._id },
        ]);
        const res = await api().get(`/api/property/view/${property._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
        expect(res.body.property._id).toBe(property._id.toString());
        expect(res.body.filteredContacts.map((c) => c.firstName)).toEqual(['Interested']);
    });

    test('returns 404 for an unknown id and 400 for an invalid id', async () => {
        const { token } = await createUserWithToken();
        expect((await api().get(`/api/property/view/${objectId()}`).set('Authorization', token)).status).toBe(404);
        expect((await api().get('/api/property/view/bad').set('Authorization', token)).status).toBe(400);
    });
});

describe('PUT /api/property/edit/:id, DELETE and deleteMany', () => {
    test('updates a property', async () => {
        const { token, user } = await createUserWithToken();
        const property = await Property.create(propertyPayload(user._id));
        const res = await api().put(`/api/property/edit/${property._id}`).set('Authorization', token).send({ listingPrice: '300000' });
        expect(res.status).toBe(200);
        expect((await Property.findById(property._id)).listingPrice).toBe('300000');
    });

    test('keeps the original owner when an admin edits the property', async () => {
        const owner = await createUserWithToken();
        const admin = await createUserWithToken({ role: 'admin' });
        const property = await Property.create(propertyPayload(owner.user._id));
        const res = await api().put(`/api/property/edit/${property._id}`).set('Authorization', admin.token)
            .send(propertyPayload(admin.user._id, { listingPrice: '1' }));
        expect(res.status).toBe(200);
        const saved = await Property.findById(property._id);
        expect(saved.listingPrice).toBe('1');
        expect(saved.createBy.toString()).toBe(owner.user._id.toString());
    });

    test("a regular user cannot view, edit or delete another user's property", async () => {
        const u1 = await createUserWithToken();
        const u2 = await createUserWithToken();
        const property = await Property.create(propertyPayload(u1.user._id));
        expect((await api().get(`/api/property/view/${property._id}`).set('Authorization', u2.token)).status).toBe(404);
        expect((await api().put(`/api/property/edit/${property._id}`).set('Authorization', u2.token).send({ listingPrice: '0' })).status).toBe(404);
        expect((await api().delete(`/api/property/delete/${property._id}`).set('Authorization', u2.token)).status).toBe(404);
        const saved = await Property.findById(property._id);
        expect(saved.listingPrice).toBe('250000');
        expect(saved.deleted).toBe(false);
    });

    test('soft deletes properties', async () => {
        const { token, user } = await createUserWithToken();
        const [p1, p2] = await Property.create([propertyPayload(user._id), propertyPayload(user._id)]);
        expect((await api().delete(`/api/property/delete/${p1._id}`).set('Authorization', token)).status).toBe(200);
        expect((await api().post('/api/property/deleteMany').set('Authorization', token).send([p2._id])).status).toBe(200);
        expect((await Property.findById(p1._id)).deleted).toBe(true);
        expect((await Property.findById(p2._id)).deleted).toBe(true);
    });

    test('returns 404 for unknown ids', async () => {
        const { token } = await createUserWithToken();
        expect((await api().put(`/api/property/edit/${objectId()}`).set('Authorization', token).send({})).status).toBe(404);
        expect((await api().delete(`/api/property/delete/${objectId()}`).set('Authorization', token)).status).toBe(404);
    });
});

describe('property media uploads', () => {
    const endpoints = [
        { url: 'add-property-photos', field: 'propertyPhotos', publicPath: 'property-photos' },
        { url: 'add-virtual-tours-or-videos', field: 'virtualToursOrVideos', publicPath: 'virtual-tours-or-videos' },
        { url: 'add-floor-plans', field: 'floorPlans', publicPath: 'floor-plans' },
        { url: 'add-property-documents', field: 'propertyDocuments', publicPath: 'property-documents' },
    ];

    test.each(endpoints)('$url stores the files and serves them back', async ({ url, field, publicPath }) => {
        const { token, user } = await createUserWithToken();
        const property = await Property.create(propertyPayload(user._id));
        const res = await api().post(`/api/property/${url}/${property._id}`).set('Authorization', token)
            .attach('property', Buffer.from('fake image'), 'house.png');
        expect(res.status).toBe(200);

        const saved = await Property.findById(property._id);
        expect(saved[field]).toHaveLength(1);
        const fileUrl = new URL(saved[field][0].img);
        expect(fileUrl.pathname.startsWith(`/api/property/${publicPath}/`)).toBe(true);

        const served = await api().get(fileUrl.pathname);
        expect(served.status).toBe(200);
        expect(served.body.toString()).toBe('fake image');
    });

    test('requires authentication', async () => {
        const { user } = await createUserWithToken();
        const property = await Property.create(propertyPayload(user._id));
        const res = await api().post(`/api/property/add-property-photos/${property._id}`).attach('property', Buffer.from('x'), 'x.png');
        expect(res.status).toBe(401);
        expect((await Property.findById(property._id)).propertyPhotos).toHaveLength(0);
    });

    test('returns 400 when no file is sent', async () => {
        const { token, user } = await createUserWithToken();
        const property = await Property.create(propertyPayload(user._id));
        const res = await api().post(`/api/property/add-property-photos/${property._id}`).set('Authorization', token);
        expect(res.status).toBe(400);
    });

    test('returns 404 for an unknown property', async () => {
        const { token } = await createUserWithToken();
        const res = await api().post(`/api/property/add-floor-plans/${objectId()}`).set('Authorization', token)
            .attach('property', Buffer.from('x'), 'plan.png');
        expect(res.status).toBe(404);
    });

    test('keeps the full file extension when a file name is reused', async () => {
        const { token, user } = await createUserWithToken();
        const property = await Property.create(propertyPayload(user._id));
        for (let i = 0; i < 2; i += 1) {
            await api().post(`/api/property/add-property-documents/${property._id}`).set('Authorization', token)
                .attach('property', Buffer.from(`v${i}`), 'contract.v2.pdf');
            await api().post(`/api/property/add-property-documents/${property._id}`).set('Authorization', token)
                .attach('property', Buffer.from(`v${i}`), 'README');
        }
        const saved = await Property.findById(property._id);
        const names = saved.propertyDocuments.map((d) => d.filename);
        expect(names).toHaveLength(4);
        expect(new Set(names).size).toBe(4);
        names.filter((n) => n.startsWith('contract')).forEach((n) => expect(n.endsWith('.pdf')).toBe(true));
        names.forEach((n) => expect(n).not.toMatch(/undefined/));
    });
});
