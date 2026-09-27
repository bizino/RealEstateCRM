const { connect, disconnect, clearDatabase, createUserWithToken, api, objectId } = require('./helpers');
const Task = require('../model/schema/task');
const Contact = require('../model/schema/contact');
const Lead = require('../model/schema/lead');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

const taskPayload = (createBy, overrides = {}) => ({
    title: 'Follow up',
    category: 'None',
    description: 'Call the client',
    start: '2026-09-27T09:00',
    end: '2026-09-27T10:00',
    backgroundColor: '#ffffff',
    createBy,
    ...overrides,
});

describe('POST /api/task/add', () => {
    test('creates a task assigned to a contact', async () => {
        const { token, user } = await createUserWithToken();
        const contact = await Contact.create({ title: 'Mr.', firstName: 'John', lastName: 'Doe', createBy: user._id });
        const res = await api().post('/api/task/add').set('Authorization', token)
            .send(taskPayload(user._id, { category: 'contact', assignmentTo: contact._id }));
        expect(res.status).toBe(200);
        expect(res.body.assignmentTo).toBe(contact._id.toString());
        expect(res.body.createdDate).toBeDefined();
    });

    test('ignores empty assignment values', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().post('/api/task/add').set('Authorization', token)
            .send(taskPayload(user._id, { assignmentTo: '', assignmentToLead: null }));
        expect(res.status).toBe(200);
        expect(res.body.assignmentTo).toBeUndefined();
        expect(res.body.assignmentToLead).toBeUndefined();
    });

    test('rejects an invalid assignmentTo with a single 400 response and saves nothing', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().post('/api/task/add').set('Authorization', token)
            .send(taskPayload(user._id, { assignmentTo: 'not-an-id' }));
        expect(res.status).toBe(400);
        expect(await Task.countDocuments()).toBe(0);
        // the server must still be able to serve requests
        expect((await api().get('/api/task').set('Authorization', token)).status).toBe(200);
    });

    test('rejects an invalid assignmentToLead with 400', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().post('/api/task/add').set('Authorization', token)
            .send(taskPayload(user._id, { assignmentToLead: '123' }));
        expect(res.status).toBe(400);
        expect(await Task.countDocuments()).toBe(0);
    });

    test('defaults createBy to the authenticated user', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().post('/api/task/add').set('Authorization', token).send(taskPayload(undefined));
        expect(res.status).toBe(200);
        expect(res.body.createBy).toBe(user._id.toString());
    });
});

describe('GET /api/task', () => {
    test('lists tasks with the assignee name, scoped to the owner for regular users', async () => {
        const admin = await createUserWithToken({ role: 'admin' });
        const u1 = await createUserWithToken();
        const u2 = await createUserWithToken();
        const contact = await Contact.create({ title: 'Ms.', firstName: 'Jane', lastName: 'Roe', createBy: u1.user._id });
        const lead = await Lead.create({ leadName: 'Big Lead', createBy: u1.user._id });
        await Task.create([
            taskPayload(u1.user._id, { title: 'c', category: 'contact', assignmentTo: contact._id }),
            taskPayload(u1.user._id, { title: 'l', category: 'lead', assignmentToLead: lead._id }),
            taskPayload(u2.user._id, { title: 'other' }),
            taskPayload(u1.user._id, { title: 'deleted', deleted: true }),
        ]);

        const own = await api().get(`/api/task/?createBy=${u1.user._id}`).set('Authorization', u1.token);
        expect(own.status).toBe(200);
        const byTitle = Object.fromEntries(own.body.map((t) => [t.title, t]));
        expect(Object.keys(byTitle).sort()).toEqual(['c', 'l']);
        expect(byTitle.c.assignmentToName).toBe('Ms. Jane Roe');
        expect(byTitle.l.assignmentToName).toBe('Big Lead');

        expect((await api().get('/api/task').set('Authorization', u2.token)).body.map((t) => t.title)).toEqual(['other']);
        expect((await api().get('/api/task').set('Authorization', admin.token)).body).toHaveLength(3);
    });

    test('returns 400 for an invalid createBy filter', async () => {
        const admin = await createUserWithToken({ role: 'admin' });
        const res = await api().get('/api/task/?createBy=oops').set('Authorization', admin.token);
        expect(res.status).toBe(400);
    });
});

describe('GET /api/task/view/:id', () => {
    test('returns the task with assignee and creator names', async () => {
        const { token, user } = await createUserWithToken();
        const lead = await Lead.create({ leadName: 'Lead Name', createBy: user._id });
        const task = await Task.create(taskPayload(user._id, { category: 'lead', assignmentToLead: lead._id }));
        const res = await api().get(`/api/task/view/${task._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
        expect(res.body.assignmentToName).toBe('Lead Name');
        expect(res.body.createByName).toBe(user.username);
    });

    test('returns 404 for an unknown id and 400 for an invalid id', async () => {
        const { token } = await createUserWithToken();
        expect((await api().get(`/api/task/view/${objectId()}`).set('Authorization', token)).status).toBe(404);
        expect((await api().get('/api/task/view/zzz').set('Authorization', token)).status).toBe(400);
    });
});

describe('PUT /api/task/edit/:id', () => {
    test('updates the task fields', async () => {
        const { token, user } = await createUserWithToken();
        const task = await Task.create(taskPayload(user._id));
        const res = await api().put(`/api/task/edit/${task._id}`).set('Authorization', token)
            .send(taskPayload(user._id, { title: 'Updated title' }));
        expect(res.status).toBe(200);
        expect((await Task.findById(task._id)).title).toBe('Updated title');
    });

    test('saves a changed lead assignment and clears the previous contact assignment', async () => {
        const { token, user } = await createUserWithToken();
        const contact = await Contact.create({ firstName: 'C', createBy: user._id });
        const lead = await Lead.create({ leadName: 'L', createBy: user._id });
        const task = await Task.create(taskPayload(user._id, { category: 'contact', assignmentTo: contact._id }));

        // the web client sends null for the assignment of the category that is not selected
        const res = await api().put(`/api/task/edit/${task._id}`).set('Authorization', token)
            .send(taskPayload(user._id, { category: 'lead', assignmentTo: null, assignmentToLead: lead._id }));
        expect(res.status).toBe(200);
        const saved = await Task.findById(task._id);
        expect(saved.assignmentToLead.toString()).toBe(lead._id.toString());
        expect(saved.assignmentTo).toBeUndefined();

        const view = await api().get(`/api/task/view/${task._id}`).set('Authorization', token);
        expect(view.body.assignmentToName).toBe('L');
    });

    test('keeps the original owner when an admin edits the task', async () => {
        const owner = await createUserWithToken();
        const admin = await createUserWithToken({ role: 'admin' });
        const task = await Task.create(taskPayload(owner.user._id));
        // the web client always sends the id of the logged in user as createBy
        const res = await api().put(`/api/task/edit/${task._id}`).set('Authorization', admin.token)
            .send(taskPayload(admin.user._id, { title: 'Edited by admin' }));
        expect(res.status).toBe(200);
        const saved = await Task.findById(task._id);
        expect(saved.title).toBe('Edited by admin');
        expect(saved.createBy.toString()).toBe(owner.user._id.toString());
    });

    test('rejects an invalid assignment with a single 400 response', async () => {
        const { token, user } = await createUserWithToken();
        const task = await Task.create(taskPayload(user._id));
        const res = await api().put(`/api/task/edit/${task._id}`).set('Authorization', token)
            .send(taskPayload(user._id, { title: 'should not be saved', assignmentTo: 'bad-id' }));
        expect(res.status).toBe(400);
        expect((await Task.findById(task._id)).title).toBe('Follow up');
    });

    test('returns 404 for an unknown id', async () => {
        const { token, user } = await createUserWithToken();
        const res = await api().put(`/api/task/edit/${objectId()}`).set('Authorization', token).send(taskPayload(user._id));
        expect(res.status).toBe(404);
    });
});

describe('DELETE /api/task/delete/:id', () => {
    test('soft deletes a task', async () => {
        const { token, user } = await createUserWithToken();
        const task = await Task.create(taskPayload(user._id));
        expect((await api().delete(`/api/task/delete/${task._id}`).set('Authorization', token)).status).toBe(200);
        expect((await Task.findById(task._id)).deleted).toBe(true);
        expect((await api().get('/api/task').set('Authorization', token)).body).toHaveLength(0);
    });

    test('returns 404 for an unknown task', async () => {
        const { token } = await createUserWithToken();
        expect((await api().delete(`/api/task/delete/${objectId()}`).set('Authorization', token)).status).toBe(404);
    });
});
