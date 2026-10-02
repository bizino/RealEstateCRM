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
    test('every employee sees the whole inventory, owner details only for the manager and admins', async () => {
        const admin = await createUserWithToken({ role: 'admin' });
        const u1 = await createUserWithToken();
        const u2 = await createUserWithToken();
        await Property.create([
            propertyPayload(u1.user._id, { ownerName: 'Chủ nhà A', ownerPhone: '0901111111', internalNotesOrComments: 'Chủ cần bán gấp' }),
            propertyPayload(u2.user._id),
            propertyPayload(u2.user._id, { deleted: true }),
        ]);
        expect((await api().get('/api/property').set('Authorization', admin.token)).body).toHaveLength(2);

        const own = (await api().get('/api/property').set('Authorization', u1.token)).body;
        expect(own).toHaveLength(2);
        const mine = own.find((p) => p.createBy._id === u1.user._id.toString());
        expect(mine).toMatchObject({ ownerName: 'Chủ nhà A', ownerPhone: '0901111111', canEdit: true });

        const other = (await api().get('/api/property').set('Authorization', u2.token)).body.find((p) => p.createBy._id === u1.user._id.toString());
        expect(other.canEdit).toBe(false);
        expect(other).not.toHaveProperty('ownerName');
        expect(other).not.toHaveProperty('ownerPhone');
        expect(other).not.toHaveProperty('internalNotesOrComments');
        expect(other.createBy).not.toHaveProperty('password');

        // "my listings" filter of the web client
        expect((await api().get(`/api/property?createBy=${u2.user._id}`).set('Authorization', u1.token)).body).toHaveLength(1);
    });

    test('PROPERTY_VISIBILITY=own limits employees to their own listings', async () => {
        const u1 = await createUserWithToken();
        const u2 = await createUserWithToken();
        const property = await Property.create(propertyPayload(u1.user._id));
        await Property.create(propertyPayload(u2.user._id));
        process.env.PROPERTY_VISIBILITY = 'own';
        try {
            expect((await api().get('/api/property').set('Authorization', u2.token)).body).toHaveLength(1);
            expect((await api().get(`/api/property/view/${property._id}`).set('Authorization', u2.token)).status).toBe(404);
        } finally {
            delete process.env.PROPERTY_VISIBILITY;
        }
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

    test("a regular user can view but not edit or delete another user's property", async () => {
        const u1 = await createUserWithToken();
        const u2 = await createUserWithToken();
        const property = await Property.create(propertyPayload(u1.user._id, { ownerPhone: '0901111111', propertyDocuments: [{ img: 'so-hong.pdf' }] }));
        const view = await api().get(`/api/property/view/${property._id}`).set('Authorization', u2.token);
        expect(view.status).toBe(200);
        expect(view.body.property.canEdit).toBe(false);
        expect(view.body.property).not.toHaveProperty('ownerPhone');
        expect(view.body.property).not.toHaveProperty('propertyDocuments');
        expect((await api().put(`/api/property/edit/${property._id}`).set('Authorization', u2.token).send({ listingPrice: '0' })).status).toBe(404);
        expect((await api().delete(`/api/property/delete/${property._id}`).set('Authorization', u2.token)).status).toBe(404);
        expect((await api().post(`/api/property/remove-media/${property._id}/propertyDocuments`).set('Authorization', u2.token).send({ img: 'so-hong.pdf' })).status).toBe(404);
        const saved = await Property.findById(property._id);
        expect(saved.listingPrice).toBe('250000');
        expect(saved.deleted).toBe(false);
        expect(saved.propertyDocuments).toHaveLength(1);
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

        // Legal papers need the session of the employee managing the listing
        const served = await api().get(fileUrl.pathname).set('Authorization', token);
        expect(served.status).toBe(200);
        expect(served.body.toString()).toBe('fake image');
    });

    test('legal papers are not public, unlike photos', async () => {
        const { token, user } = await createUserWithToken();
        const colleague = await createUserWithToken();
        const admin = await createUserWithToken({ role: 'admin' });
        const property = await Property.create(propertyPayload(user._id));
        await api().post(`/api/property/add-property-documents/${property._id}`).set('Authorization', token).attach('property', Buffer.from('so hong'), 'so-hong.pdf');
        await api().post(`/api/property/add-property-photos/${property._id}`).set('Authorization', token).attach('property', Buffer.from('photo'), 'front.png');
        const saved = await Property.findById(property._id);
        const papers = new URL(saved.propertyDocuments[0].img).pathname;
        const photo = new URL(saved.propertyPhotos[0].img).pathname;

        expect((await api().get(photo)).status).toBe(200);
        expect((await api().get(papers)).status).toBe(401);
        expect((await api().get(papers).set('Authorization', colleague.token)).status).toBe(404);
        expect((await api().get(papers).set('Authorization', admin.token)).status).toBe(200);
        expect((await api().get('/api/property/property-documents/..%2F..%2Fpackage.json').set('Authorization', admin.token)).status).toBe(400);
        expect((await api().get('/api/property/property-documents/unknown.pdf').set('Authorization', admin.token)).status).toBe(404);
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

describe('Vietnamese listing fields', () => {
    const Deal = require('../model/schema/deal');

    test('numbers new listings BDS00001, BDS00002... and marks them available', async () => {
        const { token } = await createUserWithToken();
        const first = await api().post('/api/property/add').set('Authorization', token).send({ title: 'Nhà phố Q7' });
        const second = await api().post('/api/property/add').set('Authorization', token).send({ title: 'Căn hộ Thủ Đức' });
        expect(first.body.code).toBe('BDS00001');
        expect(second.body.code).toBe('BDS00002');
        expect(first.body.listingStatus).toBe('available');
        // a rejected listing does not use a number
        expect((await api().post('/api/property/add').set('Authorization', token).send({ area: 'rộng' })).status).toBe(400);
        const third = await api().post('/api/property/add').set('Authorization', token).send({ title: 'Đất nền' });
        expect(third.body.code).toBe('BDS00003');
    });

    test('stores the Vietnamese fields and composes the address', async () => {
        const { token } = await createUserWithToken();
        const res = await api().post('/api/property/add').set('Authorization', token).send({
            transactionType: 'sale', propertyType: 'townhouse', street: '12 Nguyễn Thị Thập', ward: 'Phường Tân Hưng',
            province: 'Hồ Chí Minh', oldAddress: 'Quận 7', price: 8500000000, area: 60, width: 4, length: 15, floors: 3,
            direction: 'southEast', legalStatus: 'pinkBook', furniture: 'basic', sourceType: 'exclusive', commissionRate: 1.5,
            ownerName: 'Chị Lan', ownerPhone: '+84 903 456 789', code: 'HACK', propertyPhotos: [{ img: 'x' }],
        });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            propertyAddress: '12 Nguyễn Thị Thập, Phường Tân Hưng, Hồ Chí Minh', price: 8500000000, area: 60,
            ownerPhone: '0903456789', code: 'BDS00001', propertyPhotos: [],
        });

        await api().put(`/api/property/edit/${res.body._id}`).set('Authorization', token).send({ street: '15 Nguyễn Thị Thập', ward: 'Phường Tân Hưng', province: 'Hồ Chí Minh' });
        const saved = await Property.findById(res.body._id);
        expect(saved.propertyAddress).toBe('15 Nguyễn Thị Thập, Phường Tân Hưng, Hồ Chí Minh');
        expect(saved.code).toBe('BDS00001');
    });

    test('lists the deals of the property visible to the caller', async () => {
        const { token, user } = await createUserWithToken();
        const other = await createUserWithToken();
        const property = await Property.create(propertyPayload(user._id));
        const contact = await Contact.create({ fullName: 'Nguyễn Văn An', createBy: user._id });
        await Deal.create([
            { contact: contact._id, property: property._id, status: 'deposit', createBy: user._id },
            { contact: contact._id, property: property._id, status: 'negotiating', createBy: other.user._id },
        ]);
        const res = await api().get(`/api/property/view/${property._id}`).set('Authorization', token);
        expect(res.body.deals).toHaveLength(1);
        expect(res.body.deals[0].contact.fullName).toBe('Nguyễn Văn An');
    });

    test('removes one photo of a property', async () => {
        const { token, user } = await createUserWithToken();
        const property = await Property.create(propertyPayload(user._id, { propertyPhotos: [{ img: 'a.jpg' }, { img: 'b.jpg' }] }));
        const res = await api().post(`/api/property/remove-media/${property._id}/propertyPhotos`).set('Authorization', token).send({ img: 'a.jpg' });
        expect(res.status).toBe(200);
        expect((await Property.findById(property._id)).propertyPhotos.map((p) => p.img)).toEqual(['b.jpg']);
        expect((await api().post(`/api/property/remove-media/${property._id}/password`).set('Authorization', token).send({ img: 'b.jpg' })).status).toBe(400);
        expect((await api().post(`/api/property/remove-media/${property._id}/propertyPhotos`).set('Authorization', token).send({})).status).toBe(400);
    });

    test('a status set by hand is not reverted by deals', async () => {
        const { token, user } = await createUserWithToken();
        const property = await Property.create(propertyPayload(user._id, { listingStatus: 'deposited', statusSetByDeal: true }));
        await api().put(`/api/property/edit/${property._id}`).set('Authorization', token).send({ listingStatus: 'paused' });
        const saved = await Property.findById(property._id);
        expect(saved.listingStatus).toBe('paused');
        expect(saved.statusSetByDeal).toBe(false);
    });
});
