const { connect, disconnect, clearDatabase, createUserWithToken, api, objectId } = require('./helpers');
const User = require('../model/schema/user');
const Contact = require('../model/schema/contact');
const Lead = require('../model/schema/lead');
const EmailHistory = require('../model/schema/email');
const PhoneCall = require('../model/schema/phoneCall');
const TextMsg = require('../model/schema/textMsg');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

const setup = async (role = 'user') => {
    const { user, token } = await createUserWithToken({ role, firstName: 'Agent', lastName: 'Smith' });
    const contact = await Contact.create({ title: 'Mr.', firstName: 'John', lastName: 'Doe', email: 'john@example.com', phoneNumber: 900111222, createBy: user._id });
    const lead = await Lead.create({ leadName: 'Lead One', leadEmail: 'lead@example.com', createBy: user._id });
    return { user, token, contact, lead };
};

describe('email history', () => {
    test('POST /api/email/add stores an email for a contact and increments the sender counter', async () => {
        const { user, token, contact } = await setup();
        const res = await api().post('/api/email/add').set('Authorization', token).send({
            sender: user._id, recipient: contact.email, subject: 'Offer', message: 'Hello', createBy: contact._id,
        });
        expect(res.status).toBe(200);
        expect(res.body.result.subject).toBe('Offer');
        expect((await User.findById(user._id)).emailsent).toBe(1);
    });

    test('POST /api/email/add stores an email for a lead', async () => {
        const { user, token, lead } = await setup();
        const res = await api().post('/api/email/add').set('Authorization', token).send({
            sender: user._id, recipient: lead.leadEmail, subject: 'Lead offer', createByLead: lead._id,
        });
        expect(res.status).toBe(200);
        expect(res.body.result.createByLead).toBe(lead._id.toString());
    });

    test('POST /api/email/add rejects an invalid contact id without saving or counting', async () => {
        const { user, token } = await setup();
        const res = await api().post('/api/email/add').set('Authorization', token).send({
            sender: user._id, recipient: 'x@example.com', subject: 'bad', createBy: 'not-an-id',
        });
        expect(res.status).toBe(400);
        expect(await EmailHistory.countDocuments()).toBe(0);
        expect((await User.findById(user._id)).emailsent).toBe(0);
        expect((await api().get('/api/email').set('Authorization', token)).status).toBe(200);
    });

    test('POST /api/email/add rejects an invalid lead id', async () => {
        const { user, token } = await setup();
        const res = await api().post('/api/email/add').set('Authorization', token).send({
            sender: user._id, recipient: 'x@example.com', createByLead: '42',
        });
        expect(res.status).toBe(400);
        expect(await EmailHistory.countDocuments()).toBe(0);
    });

    test('POST /api/email/add uses the authenticated user as sender by default', async () => {
        const { user, token, contact } = await setup();
        const res = await api().post('/api/email/add').set('Authorization', token).send({ recipient: contact.email, createBy: contact._id });
        expect(res.status).toBe(200);
        expect(res.body.result.sender).toBe(user._id.toString());
        expect((await User.findById(user._id)).emailsent).toBe(1);
    });

    test('GET /api/email lists emails with sender and recipient names, scoped for regular users', async () => {
        const a = await setup();
        const b = await setup();
        await EmailHistory.create([
            { sender: a.user._id, recipient: a.contact.email, subject: 'to contact', createBy: a.contact._id },
            { sender: a.user._id, recipient: a.lead.leadEmail, subject: 'to lead', createByLead: a.lead._id },
            { sender: b.user._id, recipient: b.contact.email, subject: 'from b', createBy: b.contact._id },
        ]);
        const res = await api().get(`/api/email/?sender=${a.user._id}`).set('Authorization', a.token);
        expect(res.status).toBe(200);
        const bySubject = Object.fromEntries(res.body.map((e) => [e.subject, e]));
        expect(Object.keys(bySubject).sort()).toEqual(['to contact', 'to lead']);
        expect(bySubject['to contact'].createByName).toBe('John Doe');
        expect(bySubject['to lead'].createByName).toBe('Lead One');
        expect(bySubject['to contact'].senderName).toBe('Agent Smith');

        expect((await api().get('/api/email').set('Authorization', b.token)).body.map((e) => e.subject)).toEqual(['from b']);
    });

    test('GET /api/email returns 400 for an invalid sender filter', async () => {
        const { token } = await setup('admin');
        expect((await api().get('/api/email/?sender=bad').set('Authorization', token)).status).toBe(400);
    });

    test('GET /api/email/view/:id', async () => {
        const { user, token, contact } = await setup();
        const email = await EmailHistory.create({ sender: user._id, recipient: contact.email, subject: 'S', createBy: contact._id });
        const res = await api().get(`/api/email/view/${email._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
        expect(res.body.senderEmail).toBe(user.username);
        expect(res.body.createByName).toBe('John Doe');
        expect((await api().get(`/api/email/view/${objectId()}`).set('Authorization', token)).status).toBe(404);
        expect((await api().get('/api/email/view/nope').set('Authorization', token)).status).toBe(400);
    });
});

describe('phone calls', () => {
    test('POST /api/phoneCall/add stores a call and increments the outbound counter', async () => {
        const { user, token, contact } = await setup();
        const res = await api().post('/api/phoneCall/add').set('Authorization', token).send({
            sender: user._id, recipient: String(contact.phoneNumber), callDuration: '10', callNotes: 'Interested', createBy: contact._id,
        });
        expect(res.status).toBe(200);
        expect(res.body.result.callNotes).toBe('Interested');
        expect((await User.findById(user._id)).outboundcall).toBe(1);
    });

    test('POST /api/phoneCall/add rejects invalid ids without saving or counting', async () => {
        const { user, token } = await setup();
        const res = await api().post('/api/phoneCall/add').set('Authorization', token).send({
            sender: user._id, recipient: '123', createByLead: 'bad-lead-id',
        });
        expect(res.status).toBe(400);
        expect(await PhoneCall.countDocuments()).toBe(0);
        expect((await User.findById(user._id)).outboundcall).toBe(0);
        expect((await api().get('/api/phoneCall').set('Authorization', token)).status).toBe(200);
    });

    test('GET /api/phoneCall lists calls for contacts and leads', async () => {
        const { user, token, contact, lead } = await setup();
        await PhoneCall.create([
            { sender: user._id, recipient: '1', callNotes: 'contact call', createBy: contact._id },
            { sender: user._id, recipient: '2', callNotes: 'lead call', createByLead: lead._id },
        ]);
        const res = await api().get(`/api/phoneCall?sender=${user._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
        const byNotes = Object.fromEntries(res.body.map((c) => [c.callNotes, c]));
        expect(byNotes['contact call'].createByName).toBe('John Doe');
        expect(byNotes['lead call'].createByName).toBe('Lead One');
    });

    test('GET /api/phoneCall/view/:id', async () => {
        const { user, token, lead } = await setup();
        const call = await PhoneCall.create({ sender: user._id, recipient: '2', createByLead: lead._id });
        const res = await api().get(`/api/phoneCall/view/${call._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
        expect(res.body.createByName).toBe('Lead One');
        expect((await api().get(`/api/phoneCall/view/${objectId()}`).set('Authorization', token)).status).toBe(404);
        expect((await api().get('/api/phoneCall/view/nope').set('Authorization', token)).status).toBe(400);
    });

    test('GET /api/phoneCall returns 400 for an invalid sender filter', async () => {
        const { token } = await setup('admin');
        expect((await api().get('/api/phoneCall?sender=bad').set('Authorization', token)).status).toBe(400);
    });
});

describe('text messages', () => {
    test('POST /api/text-msg/add stores a message and increments the counter', async () => {
        const { user, token, contact } = await setup();
        const res = await api().post('/api/text-msg/add').set('Authorization', token).send({
            sender: user._id, to: String(contact.phoneNumber), message: 'Hi there', createFor: contact._id,
        });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Hi there');
        expect((await User.findById(user._id)).textsent).toBe(1);
    });

    test('POST /api/text-msg/add rejects a message without contact and does not count it', async () => {
        const { user, token } = await setup();
        const res = await api().post('/api/text-msg/add').set('Authorization', token).send({ sender: user._id, to: '1', message: 'x' });
        expect(res.status).toBe(400);
        expect(await TextMsg.countDocuments()).toBe(0);
        expect((await User.findById(user._id)).textsent).toBe(0);
    });

    test('GET /api/text-msg lists and views messages', async () => {
        const { user, token, contact } = await setup();
        const msg = await TextMsg.create({ sender: user._id, to: '1', message: 'hello', createFor: contact._id });
        const list = await api().get(`/api/text-msg?sender=${user._id}`).set('Authorization', token);
        expect(list.status).toBe(200);
        expect(list.body).toHaveLength(1);
        expect(list.body[0].createByName).toBe('John Doe');

        const view = await api().get(`/api/text-msg/view/${msg._id}`).set('Authorization', token);
        expect(view.status).toBe(200);
        expect(view.body.senderName).toBe('Agent Smith');
        expect((await api().get(`/api/text-msg/view/${objectId()}`).set('Authorization', token)).status).toBe(404);
    });

    test('GET /api/text-msg returns 400 for an invalid sender filter', async () => {
        const { token } = await setup('admin');
        expect((await api().get('/api/text-msg?sender=bad').set('Authorization', token)).status).toBe(400);
    });
});

describe('privacy of the communication logs', () => {
    test('a regular user cannot open the calls, emails and texts of another user', async () => {
        const a = await createUserWithToken();
        const b = await createUserWithToken();
        const admin = await createUserWithToken({ role: 'admin' });
        const call = await api().post('/api/phoneCall/add').set('Authorization', a.token).send({ recipient: '0901234567', callNotes: 'Tư vấn', callResult: 'answered' });
        expect(call.status).toBe(200);
        expect(call.body.result.callResult).toBe('answered');
        const email = await api().post('/api/email/add').set('Authorization', a.token).send({ recipient: 'khach@example.com', subject: 'Báo giá' });
        expect(email.status).toBe(200);

        expect((await api().get(`/api/phoneCall/view/${call.body.result._id}`).set('Authorization', b.token)).status).toBe(404);
        expect((await api().get(`/api/email/view/${email.body.result._id}`).set('Authorization', b.token)).status).toBe(404);
        expect((await api().get(`/api/phoneCall/view/${call.body.result._id}`).set('Authorization', a.token)).status).toBe(200);
        expect((await api().get(`/api/email/view/${email.body.result._id}`).set('Authorization', admin.token)).status).toBe(200);
    });
});

describe('calls move new leads forward', () => {
    test('a lead who answered is "contacted", a lead further in the pipeline is not changed', async () => {
        const Lead = require('../model/schema/lead');
        const { user, token } = await createUserWithToken();
        const [fresh, other, busy] = await Lead.create([
            { leadName: 'Mới', leadStatus: 'new', createBy: user._id },
            { leadName: 'Đã hẹn', leadStatus: 'appointment', createBy: user._id },
            { leadName: 'Không nghe', leadStatus: 'new', createBy: user._id },
        ]);
        await api().post('/api/phoneCall/add').set('Authorization', token).send({ createByLead: fresh._id, callResult: 'answered' });
        await api().post('/api/phoneCall/add').set('Authorization', token).send({ createByLead: other._id, callResult: 'answered' });
        await api().post('/api/phoneCall/add').set('Authorization', token).send({ createByLead: busy._id, callResult: 'noAnswer' });
        expect((await Lead.findById(fresh._id)).leadStatus).toBe('contacted');
        expect((await Lead.findById(other._id)).leadStatus).toBe('appointment');
        expect((await Lead.findById(busy._id)).leadStatus).toBe('new');
    });
});
