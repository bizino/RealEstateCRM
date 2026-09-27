const { connect, disconnect, clearDatabase, createUserWithToken, api, objectId } = require('./helpers');
const Deal = require('../model/schema/deal');
const Contact = require('../model/schema/contact');
const Property = require('../model/schema/property');
const User = require('../model/schema/user');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

const setup = async () => {
    const seller = await createUserWithToken({ firstName: 'An', lastName: 'Nguyễn' });
    const lister = await createUserWithToken({ firstName: 'Bình', lastName: 'Trần' });
    const contact = await Contact.create({ fullName: 'Lê Văn Khách', phoneNumber: '0901234567', createBy: seller.user._id });
    const property = await Property.create({ code: 'BDS00007', title: 'Căn hộ 2PN', listingStatus: 'available', price: 3000000000, createBy: lister.user._id });
    return { seller, lister, contact, property };
};

describe('POST /api/deal/add', () => {
    test('creates a numbered deal, computes the commission and its shares', async () => {
        const { seller, lister, contact, property } = await setup();
        const res = await api().post('/api/deal/add').set('Authorization', seller.token).send({
            contact: contact._id, property: property._id, dealType: 'sale', status: 'deposit',
            price: 2950000000, depositAmount: 100000000, commissionRate: 1.5,
            commissionSplits: [
                { user: seller.user._id, role: 'selling', percent: 30 },
                { user: lister.user._id, role: 'listing', percent: 20 },
            ],
            payments: [{ name: 'Đợt 1', dueDate: '2026-11-01', amount: 900000000 }],
        });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            code: 'GD00001', title: 'Bán BDS00007 - Lê Văn Khách', status: 'deposit', commissionAmount: 44250000,
            commissionStatus: 'pending', createBy: seller.user._id.toString(),
        });
        expect(res.body.depositDate).toBeDefined();
        expect(res.body.commissionSplits.map((s) => s.amount)).toEqual([13275000, 8850000]);
        expect(res.body.payments[0]).toMatchObject({ name: 'Đợt 1', amount: 900000000 });

        // the property is now deposited, the customer too
        const savedProperty = await Property.findById(property._id);
        expect(savedProperty.listingStatus).toBe('deposited');
        expect(savedProperty.statusSetByDeal).toBe(true);
        expect((await Contact.findById(contact._id)).leadStatus).toBe('deposited');

        const second = await api().post('/api/deal/add').set('Authorization', seller.token).send({ contact: contact._id, commissionAmount: 20000000 });
        expect(second.body.code).toBe('GD00002');
        expect(second.body.status).toBe('negotiating');
        expect(second.body.commissionAmount).toBe(20000000);
    });

    test('validates the data', async () => {
        const { seller, contact, property } = await setup();
        const send = (body) => api().post('/api/deal/add').set('Authorization', seller.token).send(body);
        expect((await send({})).status).toBe(400);
        expect((await send({ contact: 'bad' })).status).toBe(400);
        expect((await send({ contact: contact._id, status: 'won' })).status).toBe(400);
        expect((await send({ contact: contact._id, dealType: 'swap' })).status).toBe(400);
        expect((await send({ contact: contact._id, price: -1 })).status).toBe(400);
        expect((await send({ contact: contact._id, price: 'much' })).status).toBe(400);
        expect((await send({ contact: contact._id, commissionRate: 120 })).status).toBe(400);
        expect((await send({ contact: contact._id, depositDate: 'yesterday' })).status).toBe(400);
        expect((await send({ contact: contact._id, payments: [{ amount: -5 }] })).status).toBe(400);
        expect((await send({ contact: contact._id, commissionSplits: [{ user: seller.user._id, percent: 60 }, { user: seller.user._id, percent: 50 }] })).status).toBe(400);
        expect((await send({ contact: contact._id, commissionSplits: [{ user: objectId(), percent: 10 }] })).status).toBe(400);
        expect((await send({ contact: contact._id, commissionSplits: [{ user: seller.user._id, percent: 10, role: 'boss' }] })).status).toBe(400);
        expect((await send({ contact: objectId() })).status).toBe(400);
        expect((await send({ contact: contact._id, property: objectId() })).status).toBe(400);
        expect(await Deal.countDocuments()).toBe(0);
        // nothing was numbered by the rejected deals
        expect((await send({ contact: contact._id, property: property._id })).body.code).toBe('GD00001');
    });

    test("a regular user cannot use another employee's customer", async () => {
        const { lister, contact } = await setup();
        const res = await api().post('/api/deal/add').set('Authorization', lister.token).send({ contact: contact._id });
        expect(res.status).toBe(403);
    });

    test('an admin may record a deal for an employee', async () => {
        const { seller, contact } = await setup();
        const admin = await createUserWithToken({ role: 'admin' });
        const res = await api().post('/api/deal/add').set('Authorization', admin.token).send({ contact: contact._id, createBy: seller.user._id });
        expect(res.status).toBe(200);
        expect(res.body.createBy).toBe(seller.user._id.toString());
    });
});

describe('deal lifecycle', () => {
    test('signing marks the property sold, cancelling makes it available again', async () => {
        const { seller, contact, property } = await setup();
        const created = await api().post('/api/deal/add').set('Authorization', seller.token)
            .send({ contact: contact._id, property: property._id, status: 'deposit', price: 3000000000, commissionRate: 1 });
        const id = created.body._id;

        const signed = await api().put(`/api/deal/edit/${id}`).set('Authorization', seller.token).send({ status: 'contract', contractNumber: 'HĐ-01/2026' });
        expect(signed.status).toBe(200);
        expect(signed.body.contractDate).toBeDefined();
        expect((await Property.findById(property._id)).listingStatus).toBe('sold');
        expect((await Contact.findById(contact._id)).leadStatus).toBe('closed');

        // a new price recomputes the commission from the rate
        const repriced = await api().put(`/api/deal/edit/${id}`).set('Authorization', seller.token).send({ price: 2800000000 });
        expect(repriced.body.commissionAmount).toBe(28000000);

        const cancelled = await api().put(`/api/deal/edit/${id}`).set('Authorization', seller.token).send({ status: 'cancelled', cancelReason: 'Khách không vay được ngân hàng' });
        expect(cancelled.status).toBe(200);
        const available = await Property.findById(property._id);
        expect(available.listingStatus).toBe('available');
        expect(available.statusSetByDeal).toBe(false);
    });

    test('rentals mark the property rented', async () => {
        const { seller, contact, property } = await setup();
        await api().post('/api/deal/add').set('Authorization', seller.token)
            .send({ contact: contact._id, property: property._id, dealType: 'rent', status: 'contract', price: 15000000, commissionAmount: 15000000 });
        expect((await Property.findById(property._id)).listingStatus).toBe('rented');
    });

    test('keeps a fixed commission when the price changes', async () => {
        const { seller, contact } = await setup();
        const created = await api().post('/api/deal/add').set('Authorization', seller.token).send({ contact: contact._id, price: 100, commissionAmount: 7 });
        const edited = await api().put(`/api/deal/edit/${created.body._id}`).set('Authorization', seller.token).send({ price: 200 });
        expect(edited.body.commissionAmount).toBe(7);
    });

    test('does not revert a status set by hand, and frees the old property when the deal moves', async () => {
        const { seller, contact, property } = await setup();
        const manual = await Property.create({ title: 'Sold by the owner', listingStatus: 'sold', createBy: seller.user._id });
        const created = await api().post('/api/deal/add').set('Authorization', seller.token)
            .send({ contact: contact._id, property: property._id, status: 'deposit' });
        await api().put(`/api/deal/edit/${created.body._id}`).set('Authorization', seller.token).send({ property: manual._id, status: 'negotiating' });
        expect((await Property.findById(property._id)).listingStatus).toBe('available');
        expect((await Property.findById(manual._id)).listingStatus).toBe('sold');
    });

    test('deleting a deal frees its property', async () => {
        const { seller, contact, property } = await setup();
        const created = await api().post('/api/deal/add').set('Authorization', seller.token)
            .send({ contact: contact._id, property: property._id, status: 'deposit' });
        expect((await api().delete(`/api/deal/delete/${created.body._id}`).set('Authorization', seller.token)).status).toBe(200);
        expect((await Property.findById(property._id)).listingStatus).toBe('available');
        expect((await api().delete(`/api/deal/delete/${created.body._id}`).set('Authorization', seller.token)).status).toBe(404);
        expect((await Deal.findById(created.body._id)).deleted).toBe(true);
    });

    test('deleteMany frees the properties of the deleted deals', async () => {
        const { seller, lister, contact, property } = await setup();
        const created = await api().post('/api/deal/add').set('Authorization', seller.token)
            .send({ contact: contact._id, property: property._id, status: 'deposit' });
        expect((await api().post('/api/deal/deleteMany').set('Authorization', lister.token).send([created.body._id])).body.deleted).toBe(0);
        expect((await api().post('/api/deal/deleteMany').set('Authorization', seller.token).send([created.body._id])).body.deleted).toBe(1);
        expect((await Property.findById(property._id)).listingStatus).toBe('available');
        expect((await api().post('/api/deal/deleteMany').set('Authorization', seller.token).send(['bad'])).status).toBe(400);
    });
});

describe('deal visibility', () => {
    test('employees see the deals they manage or share; only the manager edits', async () => {
        const { seller, lister, contact, property } = await setup();
        const outsider = await createUserWithToken();
        const admin = await createUserWithToken({ role: 'admin' });
        const created = await api().post('/api/deal/add').set('Authorization', seller.token).send({
            contact: contact._id, property: property._id, commissionAmount: 10000000,
            commissionSplits: [{ user: lister.user._id, role: 'listing', percent: 40 }],
        });
        const id = created.body._id;

        const sellerList = await api().get('/api/deal').set('Authorization', seller.token);
        expect(sellerList.body).toHaveLength(1);
        expect(sellerList.body[0]).toMatchObject({ canEdit: true, contact: { fullName: 'Lê Văn Khách' }, property: { code: 'BDS00007' } });
        expect(sellerList.body[0].commissionSplits[0].user.firstName).toBe('Bình');

        const listerView = await api().get(`/api/deal/view/${id}`).set('Authorization', lister.token);
        expect(listerView.status).toBe(200);
        expect(listerView.body.canEdit).toBe(false);
        expect((await api().put(`/api/deal/edit/${id}`).set('Authorization', lister.token).send({ price: 1 })).status).toBe(404);
        expect((await api().delete(`/api/deal/delete/${id}`).set('Authorization', lister.token)).status).toBe(404);

        expect((await api().get('/api/deal').set('Authorization', outsider.token)).body).toHaveLength(0);
        expect((await api().get(`/api/deal/view/${id}`).set('Authorization', outsider.token)).status).toBe(404);

        const adminList = await api().get(`/api/deal?createBy=${seller.user._id}&status=negotiating`).set('Authorization', admin.token);
        expect(adminList.body).toHaveLength(1);
        expect(adminList.body[0].canEdit).toBe(true);
        expect((await api().put(`/api/deal/edit/${id}`).set('Authorization', admin.token).send({ notes: 'ok' })).status).toBe(200);
    });

    test('unknown deals answer 404 and invalid ids 400', async () => {
        const { seller } = await setup();
        expect((await api().get(`/api/deal/view/${objectId()}`).set('Authorization', seller.token)).status).toBe(404);
        expect((await api().get('/api/deal/view/bad').set('Authorization', seller.token)).status).toBe(400);
        expect((await api().get('/api/deal?property=bad').set('Authorization', seller.token)).status).toBe(400);
    });

    test('a commission split needs an active employee', async () => {
        const { seller, lister, contact } = await setup();
        await User.updateOne({ _id: lister.user._id }, { deleted: true });
        const res = await api().post('/api/deal/add').set('Authorization', seller.token)
            .send({ contact: contact._id, commissionSplits: [{ user: lister.user._id, percent: 10 }] });
        expect(res.status).toBe(400);
    });
});
