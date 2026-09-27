const { connect, disconnect, clearDatabase, createUserWithToken, api } = require('./helpers');
const Deal = require('../model/schema/deal');
const Contact = require('../model/schema/contact');
const Lead = require('../model/schema/lead');
const Property = require('../model/schema/property');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

const period = '?from=2026-09-01T00:00:00%2B07:00&to=2026-09-30T23:59:59%2B07:00';

const seed = async () => {
    const a = await createUserWithToken({ firstName: 'An', lastName: 'Nguyễn' });
    const b = await createUserWithToken({ firstName: 'Bình', lastName: 'Trần' });
    const admin = await createUserWithToken({ role: 'admin' });
    const inSeptember = new Date('2026-09-10T03:00:00Z');
    const inAugust = new Date('2026-08-10T03:00:00Z');
    const [contactA] = await Contact.create([
        { fullName: 'Khách A', leadSource: 'facebook', leadStatus: 'consulting', createBy: a.user._id, createdDate: inSeptember },
        { fullName: 'Khách A2', leadSource: 'zalo', leadStatus: 'newLead', createBy: a.user._id, createdDate: inAugust },
        { fullName: 'Khách B', leadSource: 'facebook', createBy: b.user._id, createdDate: inSeptember },
    ]);
    await Lead.create([
        { leadName: 'Lead A', leadSource: 'facebook', leadStatus: 'new', createBy: a.user._id, createdDate: inSeptember },
        { leadName: 'Lead A2', leadStatus: 'converted', leadConversionDate: inSeptember, createBy: a.user._id, createdDate: inAugust },
    ]);
    await Property.create([
        { listingStatus: 'available', createBy: a.user._id },
        { listingStatus: 'active', createBy: a.user._id },
        { listingStatus: 'sold', createBy: a.user._id },
        { listingStatus: 'deposited', createBy: b.user._id },
        { listingStatus: 'available', createBy: b.user._id, deleted: true },
    ]);
    await Deal.create([
        // closed in September, split between A (60%) and B (40%)
        {
            contact: contactA._id, status: 'contract', price: 3000000000, commissionAmount: 30000000, commissionStatus: 'received',
            contractDate: new Date('2026-09-15T03:00:00Z'), depositDate: inAugust, depositAmount: 100000000,
            commissionSplits: [{ user: a.user._id, percent: 60, amount: 18000000 }, { user: b.user._id, percent: 40, amount: 12000000 }],
            createBy: a.user._id,
        },
        // closed in August by B, not split
        { contact: contactA._id, status: 'completed', price: 2000000000, commissionAmount: 20000000, contractDate: inAugust, createBy: b.user._id },
        // deposit in September by B
        { contact: contactA._id, status: 'deposit', price: 1000000000, depositAmount: 50000000, depositDate: inSeptember, createBy: b.user._id },
        { contact: contactA._id, status: 'cancelled', price: 5000000000, depositDate: inSeptember, depositAmount: 1, createBy: a.user._id },
        { contact: contactA._id, status: 'contract', price: 9, commissionAmount: 9, createBy: a.user._id, deleted: true },
    ]);
    return { a, b, admin };
};

describe('GET /api/dashboard/summary', () => {
    test('gives admins the figures of the whole company', async () => {
        const { admin, a } = await seed();
        const res = await api().get(`/api/dashboard/summary${period}`).set('Authorization', admin.token);
        expect(res.status).toBe(200);
        const body = res.body;
        expect(body.contacts).toEqual({ total: 3, new: 2 });
        expect(body.leads).toEqual({ open: 1, new: 1, converted: 1 });
        expect(body.properties).toEqual({ total: 4, byStatus: { available: 2, deposited: 1, sold: 1, rented: 0, paused: 0 } });
        expect(body.deals).toMatchObject({
            byStatus: { negotiating: 0, deposit: 1, contract: 1, completed: 1, cancelled: 1 },
            closed: 1, salesValue: 3000000000, commission: 30000000, commissionReceived: 30000000,
            depositCount: 1, depositAmount: 50000000,
        });
        expect(body.commissionBySale).toEqual([
            { userId: a.user._id.toString(), name: 'An Nguyễn', deals: 1, commission: 18000000 },
            expect.objectContaining({ name: 'Bình Trần', commission: 12000000 }),
        ]);
        expect(body.leadSources).toEqual([{ source: 'facebook', count: 3 }]);
        // codes of older versions are counted with their current equivalent
        expect(body.contactStatuses).toEqual(expect.arrayContaining([{ status: 'consulting', count: 1 }, { status: 'new', count: 2 }]));
        expect(body.contactStatuses).toHaveLength(2);

        expect(body.monthly).toHaveLength(12);
        expect(body.monthly[11]).toEqual({ month: '2026-09', deals: 1, salesValue: 3000000000, commission: 30000000 });
        expect(body.monthly[10]).toEqual({ month: '2026-08', deals: 1, salesValue: 2000000000, commission: 20000000 });
        expect(body.monthly[0].month).toBe('2025-10');
    });

    test('gives employees their own figures and commission only', async () => {
        const { b } = await seed();
        const res = await api().get(`/api/dashboard/summary${period}`).set('Authorization', b.token);
        expect(res.status).toBe(200);
        expect(res.body.contacts).toEqual({ total: 1, new: 1 });
        expect(res.body.properties.total).toBe(1);
        // B sees the deal shared with A, their own deals, and only their own commission
        expect(res.body.deals.byStatus).toMatchObject({ contract: 1, completed: 1, deposit: 1, cancelled: 0 });
        expect(res.body.commissionBySale).toEqual([expect.objectContaining({ name: 'Bình Trần', commission: 12000000 })]);
    });

    test('defaults to the current month and rejects invalid periods', async () => {
        const { admin } = await seed();
        expect((await api().get('/api/dashboard/summary').set('Authorization', admin.token)).status).toBe(200);
        expect((await api().get('/api/dashboard/summary?from=soon').set('Authorization', admin.token)).status).toBe(400);
        expect((await api().get('/api/dashboard/summary?from=2026-09-30&to=2026-09-01').set('Authorization', admin.token)).status).toBe(400);
        expect((await api().get('/api/dashboard/summary')).status).toBe(401);
    });
});
