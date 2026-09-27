const { connect, disconnect, clearDatabase, createUserWithToken, api } = require('./helpers');
const Contact = require('../model/schema/contact');
const EmailHistory = require('../model/schema/email');
const PhoneCall = require('../model/schema/phoneCall');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

describe('GET /api/reporting', () => {
    test('admin gets the users statistics without password hashes', async () => {
        const admin = await createUserWithToken({ role: 'admin' });
        await createUserWithToken();
        const res = await api().get('/api/reporting').set('Authorization', admin.token);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        res.body.forEach((u) => {
            expect(u).not.toHaveProperty('password');
            expect(u).toHaveProperty('emailsent');
            expect(u).toHaveProperty('outboundcall');
        });
    });

    test('a regular user only gets their own statistics', async () => {
        const u1 = await createUserWithToken();
        await createUserWithToken();
        // the web client sends ?_id=<own id>, but the scope must not depend on it
        for (const url of [`/api/reporting?_id=${u1.user._id}`, '/api/reporting']) {
            const res = await api().get(url).set('Authorization', u1.token);
            expect(res.status).toBe(200);
            expect(res.body.map((u) => u._id)).toEqual([u1.user._id.toString()]);
        }
    });

    test('returns 400 for an invalid filter', async () => {
        const admin = await createUserWithToken({ role: 'admin' });
        expect((await api().get('/api/reporting?_id=bad').set('Authorization', admin.token)).status).toBe(400);
    });
});

describe('POST /api/reporting/index', () => {
    const seed = async () => {
        const { user, token } = await createUserWithToken({ role: 'admin' });
        const contact = await Contact.create({ firstName: 'John', createBy: user._id });
        const inRange = new Date('2026-09-10T10:00:00Z');
        const outOfRange = new Date('2026-07-01T10:00:00Z');
        await EmailHistory.create([
            { sender: user._id, createBy: contact._id, timestamp: inRange },
            { sender: user._id, createBy: contact._id, timestamp: inRange },
            { sender: user._id, createBy: contact._id, timestamp: outOfRange },
        ]);
        await PhoneCall.create({ sender: user._id, createBy: contact._id, timestamp: inRange });
        return { user, token };
    };

    test('aggregates emails and calls within the date range', async () => {
        const { token } = await seed();
        const res = await api().post('/api/reporting/index').set('Authorization', token)
            .send({ startDate: '2026-09-01', endDate: '2026-09-30', filter: 'day' });
        expect(res.status).toBe(200);
        expect(res.body.EmailDetails[0].totalEmails).toBe(2);
        expect(res.body.outboundcall[0].totalCall).toBe(1);
    });

    test('responds 400 with zero totals when there is no data', async () => {
        const { token } = await seed();
        const res = await api().post('/api/reporting/index').set('Authorization', token)
            .send({ startDate: '2025-01-01', endDate: '2025-01-31', filter: 'month' });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ totalEmails: 0, totalCall: 0, totalTextSent: 0 });
    });

    test('validates dates', async () => {
        const { token } = await seed();
        const res = await api().post('/api/reporting/index').set('Authorization', token).send({ startDate: 'x', endDate: 'y' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid date/);
    });

    test("a regular user's report only counts their own activity", async () => {
        await seed();
        const other = await createUserWithToken();
        const res = await api().post('/api/reporting/index').set('Authorization', other.token)
            .send({ startDate: '2026-09-01', endDate: '2026-09-30', filter: 'day' });
        expect(res.status).toBe(400);
        expect(res.body.totalEmails).toBe(0);
    });
});
