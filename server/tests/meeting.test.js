const { connect, disconnect, clearDatabase, createUserWithToken, api, objectId } = require('./helpers');
const MeetingHistory = require('../model/schema/meeting');
const Contact = require('../model/schema/contact');
const Lead = require('../model/schema/lead');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

describe('meetings', () => {
    test('POST /api/meeting/add creates a meeting with contact attendees', async () => {
        const { user, token } = await createUserWithToken();
        const contact = await Contact.create({ firstName: 'John', email: 'john@example.com', createBy: user._id });
        const res = await api().post('/api/meeting/add').set('Authorization', token).send({
            agenda: 'Contract signing', attendes: [contact._id], attendesLead: [], location: 'Office',
            related: 'contact', dateTime: '2026-10-01T10:00', notes: '', createdBy: user._id,
        });
        expect(res.status).toBe(200);
        expect(res.body.agenda).toBe('Contract signing');
        expect(res.body.attendes).toEqual([contact._id.toString()]);
    });

    test('POST /api/meeting/add requires an agenda', async () => {
        const { user, token } = await createUserWithToken();
        const res = await api().post('/api/meeting/add').set('Authorization', token).send({ createdBy: user._id });
        expect(res.status).toBe(400);
        expect(await MeetingHistory.countDocuments()).toBe(0);
    });

    test('POST /api/meeting/add defaults createdBy to the authenticated user', async () => {
        const { user, token } = await createUserWithToken();
        const res = await api().post('/api/meeting/add').set('Authorization', token).send({ agenda: 'No owner sent' });
        expect(res.status).toBe(200);
        expect(res.body.createdBy).toBe(user._id.toString());
    });

    test('GET /api/meeting lists meetings with attendee emails, scoped for regular users', async () => {
        const a = await createUserWithToken();
        const b = await createUserWithToken();
        const contact = await Contact.create({ firstName: 'John', email: 'john@example.com', createBy: a.user._id });
        const lead = await Lead.create({ leadName: 'Lead', leadEmail: 'lead@example.com', createBy: a.user._id });
        await MeetingHistory.create([
            { agenda: 'contact meeting', attendes: [contact._id], related: 'contact', createdBy: a.user._id },
            { agenda: 'lead meeting', attendesLead: [lead._id], related: 'lead', createdBy: a.user._id },
            { agenda: 'b meeting', createdBy: b.user._id },
        ]);

        const res = await api().get(`/api/meeting?createdBy=${a.user._id}`).set('Authorization', a.token);
        expect(res.status).toBe(200);
        const byAgenda = Object.fromEntries(res.body.map((m) => [m.agenda, m]));
        expect(Object.keys(byAgenda).sort()).toEqual(['contact meeting', 'lead meeting']);
        expect(byAgenda['contact meeting'].attendesArray).toEqual(['john@example.com']);
        expect(byAgenda['contact meeting'].createdByName).toBe(a.user.username);

        expect((await api().get('/api/meeting').set('Authorization', b.token)).body.map((m) => m.agenda)).toEqual(['b meeting']);
    });

    test('GET /api/meeting returns 400 for an invalid createdBy filter', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        expect((await api().get('/api/meeting?createdBy=123').set('Authorization', token)).status).toBe(400);
    });

    test('GET /api/meeting/view/:id returns attendees details', async () => {
        const { user, token } = await createUserWithToken();
        const lead = await Lead.create({ leadName: 'Lead', leadEmail: 'lead@example.com', createBy: user._id });
        const meeting = await MeetingHistory.create({ agenda: 'Visit', attendesLead: [lead._id], related: 'lead', createdBy: user._id });
        const res = await api().get(`/api/meeting/view/${meeting._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
        expect(res.body.attendesLead[0].leadName).toBe('Lead');
        expect(res.body.createdByName).toBe(user.username);
        expect((await api().get(`/api/meeting/view/${objectId()}`).set('Authorization', token)).status).toBe(404);
        expect((await api().get('/api/meeting/view/bad').set('Authorization', token)).status).toBe(400);
    });
});
