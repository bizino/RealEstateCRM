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
        expect(byAgenda['contact meeting'].attendesArray).toEqual(['John']);
        expect(byAgenda['lead meeting'].attendesArray).toEqual(['Lead']);
        expect(byAgenda['contact meeting'].createdByName).toBe(`${a.user.firstName} ${a.user.lastName}`);

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
        expect(res.body.createdByName).toBe(`${user.firstName} ${user.lastName}`);
        expect((await api().get(`/api/meeting/view/${objectId()}`).set('Authorization', token)).status).toBe(404);
        expect((await api().get('/api/meeting/view/bad').set('Authorization', token)).status).toBe(400);
    });
});

describe('meeting follow-up (site visits)', () => {
    const Property = require('../model/schema/property');

    test('links the property shown and records the result of the visit', async () => {
        const { user, token } = await createUserWithToken();
        const contact = await Contact.create({ fullName: 'Nguyễn Văn An', createBy: user._id });
        const property = await Property.create({ code: 'BDS00001', title: 'Căn hộ 2PN Quận 7', createBy: user._id });
        const created = await api().post('/api/meeting/add').set('Authorization', token).send({
            agenda: 'Dẫn khách xem nhà', meetingType: 'viewing', attendes: [contact._id], property: property._id, dateTime: '2026-10-01T09:00',
        });
        expect(created.status).toBe(200);
        expect(created.body.status).toBe('scheduled');

        const edited = await api().put(`/api/meeting/edit/${created.body._id}`).set('Authorization', token)
            .send({ status: 'done', result: 'Khách thích, hẹn xem lần 2' });
        expect(edited.status).toBe(200);

        const list = await api().get('/api/meeting').set('Authorization', token);
        expect(list.body[0]).toMatchObject({ status: 'done', result: 'Khách thích, hẹn xem lần 2', propertyName: 'Căn hộ 2PN Quận 7', propertyCode: 'BDS00001', attendesArray: ['Nguyễn Văn An'] });

        const view = await api().get(`/api/meeting/view/${created.body._id}`).set('Authorization', token);
        expect(view.body.property.code).toBe('BDS00001');
        expect(view.body.attendes[0].fullName).toBe('Nguyễn Văn An');
    });

    test('rejects invalid references and statuses', async () => {
        const { token } = await createUserWithToken();
        expect((await api().post('/api/meeting/add').set('Authorization', token).send({ agenda: 'x', property: 'bad' })).status).toBe(400);
        expect((await api().post('/api/meeting/add').set('Authorization', token).send({ agenda: 'x', attendes: ['bad'] })).status).toBe(400);
        expect((await api().post('/api/meeting/add').set('Authorization', token).send({ agenda: 'x', status: 'maybe' })).status).toBe(400);
    });

    test('clears the property when an empty value is sent', async () => {
        const { user, token } = await createUserWithToken();
        const meeting = await MeetingHistory.create({ agenda: 'Visit', property: objectId(), createdBy: user._id });
        expect((await api().put(`/api/meeting/edit/${meeting._id}`).set('Authorization', token).send({ property: '' })).status).toBe(200);
        expect((await MeetingHistory.findById(meeting._id)).property).toBeUndefined();
    });

    test('soft deletes meetings, only the owner or an admin may edit or delete them', async () => {
        const a = await createUserWithToken();
        const b = await createUserWithToken();
        const admin = await createUserWithToken({ role: 'admin' });
        const [m1, m2, m3] = await MeetingHistory.create([
            { agenda: 'one', createdBy: a.user._id },
            { agenda: 'two', createdBy: a.user._id },
            { agenda: 'three', createdBy: a.user._id },
        ]);
        expect((await api().put(`/api/meeting/edit/${m1._id}`).set('Authorization', b.token).send({ agenda: 'hijack' })).status).toBe(404);
        expect((await api().get(`/api/meeting/view/${m1._id}`).set('Authorization', b.token)).status).toBe(404);
        expect((await api().delete(`/api/meeting/delete/${m1._id}`).set('Authorization', b.token)).status).toBe(404);
        expect((await api().delete(`/api/meeting/delete/${m1._id}`).set('Authorization', a.token)).status).toBe(200);
        expect((await api().delete(`/api/meeting/delete/${m1._id}`).set('Authorization', a.token)).status).toBe(404);

        expect((await api().post('/api/meeting/deleteMany').set('Authorization', b.token).send([m2._id, m3._id])).status).toBe(200);
        expect(await MeetingHistory.countDocuments({ deleted: true })).toBe(1);
        expect((await api().post('/api/meeting/deleteMany').set('Authorization', admin.token).send([m2._id])).status).toBe(200);
        expect((await api().post('/api/meeting/deleteMany').set('Authorization', admin.token).send('x')).status).toBe(400);

        const list = await api().get('/api/meeting').set('Authorization', a.token);
        expect(list.body.map((m) => m.agenda)).toEqual(['three']);
    });
});

describe('meetings move the sales pipeline forward', () => {
    test('booking a meeting with a lead makes it an appointment', async () => {
        const { user, token } = await createUserWithToken();
        const [fresh, lost] = await Lead.create([
            { leadName: 'Mới', leadStatus: 'new', createBy: user._id },
            { leadName: 'Không tiềm năng', leadStatus: 'lost', createBy: user._id },
        ]);
        await api().post('/api/meeting/add').set('Authorization', token).send({ agenda: 'Gặp tư vấn', attendesLead: [fresh._id, lost._id] });
        expect((await Lead.findById(fresh._id)).leadStatus).toBe('appointment');
        expect((await Lead.findById(lost._id)).leadStatus).toBe('lost');
    });

    test('a site visit done makes the customers "viewing" unless they are further', async () => {
        const { user, token } = await createUserWithToken();
        const [consulting, deposited] = await Contact.create([
            { fullName: 'Đang tư vấn', leadStatus: 'consulting', createBy: user._id },
            { fullName: 'Đã cọc', leadStatus: 'deposited', createBy: user._id },
        ]);
        const meeting = await api().post('/api/meeting/add').set('Authorization', token)
            .send({ agenda: 'Dẫn xem', meetingType: 'viewing', attendes: [consulting._id, deposited._id] });
        expect((await Contact.findById(consulting._id)).leadStatus).toBe('consulting');
        await api().put(`/api/meeting/edit/${meeting.body._id}`).set('Authorization', token).send({ status: 'done', result: 'Khách ưng' });
        expect((await Contact.findById(consulting._id)).leadStatus).toBe('viewing');
        expect((await Contact.findById(deposited._id)).leadStatus).toBe('deposited');
    });
});
