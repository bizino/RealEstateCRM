const { connect, disconnect, clearDatabase, createUserWithToken, api, objectId } = require('./helpers');
const Lead = require('../model/schema/lead');
const MeetingHistory = require('../model/schema/meeting');
const Task = require('../model/schema/task');
const EmailHistory = require('../model/schema/email');
const PhoneCall = require('../model/schema/phoneCall');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

const leadPayload = (createBy, overrides = {}) => ({
    leadName: 'Alice Buyer',
    leadEmail: 'alice@example.com',
    leadPhoneNumber: '0900000000',
    leadStatus: 'active',
    leadScore: 50,
    createBy,
    ...overrides,
});

describe('POST /api/lead/add', () => {
    test('creates a lead with createdDate', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().post('/api/lead/add').set('Authorization', token).send(leadPayload(user._id));
        expect(res.status).toBe(200);
        expect(res.body.leadName).toBe('Alice Buyer');
        expect(res.body.createdDate).toBeDefined();
    });

    test('returns 400 for invalid data', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().post('/api/lead/add').set('Authorization', token).send(leadPayload(user._id, { leadScore: 'high' }));
        expect(res.status).toBe(400);
    });
});

describe('POST /api/lead/addMany', () => {
    test('imports several leads, setting createdDate and the owner', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().post('/api/lead/addMany').set('Authorization', token)
            .send([leadPayload(undefined, { leadName: 'A' }), leadPayload(undefined, { leadName: 'B' })]);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        const leads = await Lead.find().sort({ leadName: 1 });
        expect(leads.map((l) => l.leadName)).toEqual(['A', 'B']);
        leads.forEach((lead) => {
            expect(lead.createdDate).toBeInstanceOf(Date);
            expect(lead.createBy.toString()).toBe(user._id.toString());
        });
    });

    test('rejects a body that is not an array', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().post('/api/lead/addMany').set('Authorization', token).send(leadPayload(user._id));
        expect(res.status).toBe(400);
    });
});

describe('GET /api/lead', () => {
    test('admin sees all leads, regular users only their own', async () => {
        const admin = await createUserWithToken({ role: 'admin' });
        const u1 = await createUserWithToken();
        const u2 = await createUserWithToken();
        await Lead.create([leadPayload(u1.user._id), leadPayload(u2.user._id), leadPayload(u2.user._id, { deleted: true })]);

        expect((await api().get('/api/lead').set('Authorization', admin.token)).body).toHaveLength(2);
        expect((await api().get(`/api/lead/?createBy=${u1.user._id}`).set('Authorization', u1.token)).body).toHaveLength(1);
        expect((await api().get('/api/lead').set('Authorization', u2.token)).body).toHaveLength(1);
    });

    test('returns 400 for an invalid filter value', async () => {
        const admin = await createUserWithToken({ role: 'admin' });
        const res = await api().get('/api/lead/?createBy=xyz').set('Authorization', admin.token);
        expect(res.status).toBe(400);
    });
});

describe('GET /api/lead/view/:id', () => {
    test('returns the lead with emails, calls, tasks and meetings', async () => {
        const { token, user } = await createUserWithToken();
        const lead = await Lead.create(leadPayload(user._id));
        await EmailHistory.create({ sender: user._id, recipient: lead.leadEmail, subject: 'Hi', createByLead: lead._id });
        await PhoneCall.create({ sender: user._id, recipient: lead.leadPhoneNumber, callDuration: '5', createByLead: lead._id });
        await Task.create({ title: 'Call back', assignmentToLead: lead._id, createBy: user._id });
        await MeetingHistory.create({ agenda: 'Site visit', attendesLead: [lead._id], related: 'lead', createdBy: user._id });

        const res = await api().get(`/api/lead/view/${lead._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
        expect(res.body.lead._id).toBe(lead._id.toString());
        expect(res.body.Email).toHaveLength(1);
        expect(res.body.Email[0].createByName).toBe('Alice Buyer');
        expect(res.body.phoneCall).toHaveLength(1);
        expect(res.body.phoneCall[0].createByName).toBe('Alice Buyer');
        expect(res.body.task).toHaveLength(1);
        expect(res.body.task[0].assignmentToName).toBe('Alice Buyer');
        expect(res.body.meeting).toHaveLength(1);
        expect(res.body.meeting[0].attendesArray).toEqual(['Alice Buyer']);
        expect(res.body.meeting[0].createdByName).toBe(`${user.firstName} ${user.lastName}`);
    });

    test('accepts a sender filter in the query string', async () => {
        const { token, user } = await createUserWithToken();
        const lead = await Lead.create(leadPayload(user._id));
        const res = await api().get(`/api/lead/view/${lead._id}?sender=${user._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
    });

    test('returns 404 for an unknown id and 400 for an invalid id', async () => {
        const { token } = await createUserWithToken();
        expect((await api().get(`/api/lead/view/${objectId()}`).set('Authorization', token)).status).toBe(404);
        expect((await api().get('/api/lead/view/invalid').set('Authorization', token)).status).toBe(400);
    });

    test("a regular user cannot view another user's lead", async () => {
        const u1 = await createUserWithToken();
        const u2 = await createUserWithToken();
        const lead = await Lead.create(leadPayload(u1.user._id));
        expect((await api().get(`/api/lead/view/${lead._id}`).set('Authorization', u2.token)).status).toBe(404);
    });
});

describe('PUT /api/lead/edit/:id', () => {
    test('updates the lead', async () => {
        const { token, user } = await createUserWithToken();
        const lead = await Lead.create(leadPayload(user._id));
        const res = await api().put(`/api/lead/edit/${lead._id}`).set('Authorization', token).send({ leadStatus: 'converted' });
        expect(res.status).toBe(200);
        const saved = await Lead.findById(lead._id);
        expect(saved.leadStatus).toBe('converted');
        expect(saved.updatedDate.getTime()).toBeGreaterThan(lead.updatedDate.getTime());
    });

    test('keeps the original owner when an admin edits the lead', async () => {
        const owner = await createUserWithToken();
        const admin = await createUserWithToken({ role: 'admin' });
        const lead = await Lead.create(leadPayload(owner.user._id));
        const res = await api().put(`/api/lead/edit/${lead._id}`).set('Authorization', admin.token)
            .send(leadPayload(admin.user._id, { leadStatus: 'hot' }));
        expect(res.status).toBe(200);
        const saved = await Lead.findById(lead._id);
        expect(saved.leadStatus).toBe('hot');
        expect(saved.createBy.toString()).toBe(owner.user._id.toString());
    });

    test("a regular user cannot edit or delete another user's lead", async () => {
        const u1 = await createUserWithToken();
        const u2 = await createUserWithToken();
        const lead = await Lead.create(leadPayload(u1.user._id));
        expect((await api().put(`/api/lead/edit/${lead._id}`).set('Authorization', u2.token).send({ leadStatus: 'x' })).status).toBe(404);
        expect((await api().delete(`/api/lead/delete/${lead._id}`).set('Authorization', u2.token)).status).toBe(404);
        await api().post('/api/lead/deleteMany').set('Authorization', u2.token).send([lead._id]);
        const saved = await Lead.findById(lead._id);
        expect(saved.leadStatus).toBe('active');
        expect(saved.deleted).toBe(false);
    });

    test('returns 404 for an unknown id and 400 for an invalid id', async () => {
        const { token } = await createUserWithToken();
        expect((await api().put(`/api/lead/edit/${objectId()}`).set('Authorization', token).send({})).status).toBe(404);
        expect((await api().put('/api/lead/edit/invalid').set('Authorization', token).send({})).status).toBe(400);
    });
});

describe('DELETE /api/lead/delete/:id and POST /api/lead/deleteMany', () => {
    test('soft deletes leads', async () => {
        const { token, user } = await createUserWithToken();
        const [l1, l2, l3] = await Lead.create([leadPayload(user._id), leadPayload(user._id), leadPayload(user._id)]);
        expect((await api().delete(`/api/lead/delete/${l1._id}`).set('Authorization', token)).status).toBe(200);
        expect((await api().post('/api/lead/deleteMany').set('Authorization', token).send([l2._id])).status).toBe(200);
        expect((await Lead.findById(l1._id)).deleted).toBe(true);
        expect((await Lead.findById(l2._id)).deleted).toBe(true);
        expect((await Lead.findById(l3._id)).deleted).toBe(false);
    });

    test('returns 404 for an unknown lead', async () => {
        const { token } = await createUserWithToken();
        expect((await api().delete(`/api/lead/delete/${objectId()}`).set('Authorization', token)).status).toBe(404);
    });
});
