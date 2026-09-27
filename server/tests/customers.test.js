// Vietnamese customer data: full names, phone numbers, duplicates between
// employees, bulk imports and conversion of leads into contacts
const { connect, disconnect, clearDatabase, createUserWithToken, api, objectId } = require('./helpers');
const Contact = require('../model/schema/contact');
const Lead = require('../model/schema/lead');
const Task = require('../model/schema/task');
const PhoneCall = require('../model/schema/phoneCall');
const MeetingHistory = require('../model/schema/meeting');

beforeAll(connect);
afterAll(disconnect);
afterEach(clearDatabase);

describe('contacts', () => {
    test('store the full name, the needs and a normalized phone number', async () => {
        const { token } = await createUserWithToken();
        const res = await api().post('/api/contact/add').set('Authorization', token).send({
            fullName: ' Nguyễn  Văn An ', title: 'Anh', phoneNumber: '+84 901 234 567', zalo: '0901 234 567',
            customerType: 'buyer', budgetFrom: 3000000000, budgetTo: '5000000000', interestedArea: 'Thủ Đức',
            interestedPropertyType: 'apartment', dataConsent: true,
        });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            fullName: 'Nguyễn Văn An', firstName: 'An', lastName: 'Nguyễn Văn', phoneNumber: '0901234567', zalo: '0901234567',
            budgetFrom: 3000000000, budgetTo: 5000000000,
        });
        expect(res.body.dataConsentDate).toBeDefined();
    });

    test('keep a Zalo id that is not a phone number', async () => {
        const { token } = await createUserWithToken();
        const res = await api().post('/api/contact/add').set('Authorization', token).send({ fullName: 'An', phoneNumber: '0901234567', zalo: 'zalo.me/anguyen' });
        expect(res.body.zalo).toBe('zalo.me/anguyen');
    });

    test('reject a phone number used by a contact of another employee without revealing the contact', async () => {
        const a = await createUserWithToken({ firstName: 'Bình', lastName: 'Trần' });
        const b = await createUserWithToken();
        await api().post('/api/contact/add').set('Authorization', a.token).send({ fullName: 'Nguyễn Văn An', phoneNumber: '0901234567' });

        const res = await api().post('/api/contact/add').set('Authorization', b.token).send({ fullName: 'Anh An', phoneNumber: '090.123.4567' });
        expect(res.status).toBe(409);
        expect(res.body.message).toContain('0901234567');
        expect(res.body.duplicate).toEqual({ type: 'contact', phone: '0901234567', ownerName: 'Bình Trần' });
        expect(await Contact.countDocuments()).toBe(1);
    });

    test('identify the duplicate for its owner and for admins', async () => {
        const a = await createUserWithToken();
        const admin = await createUserWithToken({ role: 'admin' });
        const first = await api().post('/api/contact/add').set('Authorization', a.token).send({ fullName: 'Nguyễn Văn An', phoneNumber: '0901234567' });

        const own = await api().post('/api/contact/add').set('Authorization', a.token).send({ fullName: 'An', mobileNumber: '0901234567' });
        expect(own.status).toBe(409);
        expect(own.body.duplicate).toMatchObject({ _id: first.body._id, name: 'Nguyễn Văn An' });
        expect(own.body.message).toContain('Nguyễn Văn An');

        const byAdmin = await api().post('/api/contact/add').set('Authorization', admin.token).send({ fullName: 'An', phoneNumber: '0901234567' });
        expect(byAdmin.status).toBe(409);
        expect(byAdmin.body.duplicate._id).toBe(first.body._id);
    });

    test('find numbers saved as numbers by older versions and the leads not converted yet', async () => {
        const { token, user } = await createUserWithToken();
        await Contact.collection.insertOne({ firstName: 'Old', phoneNumber: 901234567, createBy: user._id, deleted: false });
        expect((await api().post('/api/contact/add').set('Authorization', token).send({ fullName: 'A', phoneNumber: '0901234567' })).status).toBe(409);

        await Lead.create({ leadName: 'Lead', leadPhoneNumber: '0912345678', createBy: user._id });
        const res = await api().post('/api/contact/add').set('Authorization', token).send({ fullName: 'B', phoneNumber: '0912 345 678' });
        expect(res.status).toBe(409);
        expect(res.body.duplicate.type).toBe('lead');

        // deleted records are not duplicates
        await Contact.collection.updateMany({}, { $set: { deleted: true } });
        await Lead.updateMany({}, { deleted: true });
        expect((await api().post('/api/contact/add').set('Authorization', token).send({ fullName: 'A', phoneNumber: '0901234567' })).status).toBe(200);
    });

    test('admins may knowingly save a duplicate, regular users may not', async () => {
        const user = await createUserWithToken();
        const admin = await createUserWithToken({ role: 'admin' });
        await Contact.create({ fullName: 'Chồng', phoneNumber: '0901234567', createBy: user.user._id });
        const payload = { fullName: 'Vợ', phoneNumber: '0901234567', allowDuplicate: true };
        expect((await api().post('/api/contact/add').set('Authorization', user.token).send(payload)).status).toBe(409);
        const res = await api().post('/api/contact/add').set('Authorization', admin.token).send(payload);
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty('allowDuplicate');
    });

    test('an edit is only checked for new numbers', async () => {
        const a = await createUserWithToken();
        const b = await createUserWithToken();
        // duplicates saved before the check existed
        const [mine] = await Contact.create([
            { fullName: 'Mine', phoneNumber: '0901234567', createBy: a.user._id },
            { fullName: 'Theirs', phoneNumber: '0901234567', createBy: b.user._id },
            { fullName: 'Other', phoneNumber: '0987654321', createBy: b.user._id },
        ]);
        const unchanged = await api().put(`/api/contact/edit/${mine._id}`).set('Authorization', a.token).send({ fullName: 'Mine renamed', phoneNumber: '090 123 4567' });
        expect(unchanged.status).toBe(200);
        expect((await Contact.findById(mine._id)).fullName).toBe('Mine renamed');

        const taken = await api().put(`/api/contact/edit/${mine._id}`).set('Authorization', a.token).send({ mobileNumber: '0987654321' });
        expect(taken.status).toBe(409);
        expect((await Contact.findById(mine._id)).mobileNumber).toBeUndefined();
    });

    test('are not edited or viewed once deleted', async () => {
        const { token, user } = await createUserWithToken();
        const contact = await Contact.create({ fullName: 'Gone', createBy: user._id, deleted: true });
        expect((await api().get(`/api/contact/view/${contact._id}`).set('Authorization', token)).status).toBe(404);
        expect((await api().put(`/api/contact/edit/${contact._id}`).set('Authorization', token).send({ fullName: 'Back' })).status).toBe(404);
    });
});

describe('POST /api/contact/import', () => {
    test('imports valid rows and reports the skipped ones', async () => {
        const { token, user } = await createUserWithToken();
        await Contact.create({ fullName: 'Existing', phoneNumber: '0909999999', createBy: user._id });
        const res = await api().post('/api/contact/import').set('Authorization', token).send([
            { fullName: 'Nguyễn Văn An', phoneNumber: '0901 234 567', leadSource: 'facebook', _id: objectId(), deleted: true },
            { fullName: 'Trần Thị Bình', phoneNumber: '+84912345678', customerType: 'renter' },
            { fullName: 'Duplicate row', phoneNumber: '0912345678' },
            { fullName: 'Existing again', phoneNumber: '0909 999 999' },
            { fullName: 'No phone' },
            { phoneNumber: '0933333333' },
            { fullName: 'Bad phone', phoneNumber: '12345' },
            'not an object',
        ]);
        expect(res.status).toBe(200);
        expect(res.body.inserted).toBe(2);
        expect(res.body.skipped).toEqual([
            { row: 3, phone: '0912345678', reason: 'Trùng số điện thoại trong file', duplicateOfRow: 2 },
            { row: 4, phone: '0909999999', reason: 'Số điện thoại đã có trong hệ thống' },
            { row: 5, reason: 'Thiếu số điện thoại' },
            { row: 6, phone: '0933333333', reason: 'Thiếu họ tên' },
            { row: 7, phone: '12345', reason: 'Số điện thoại không hợp lệ' },
            { row: 8, reason: 'Dòng không hợp lệ' },
        ]);
        const imported = await Contact.find({ fullName: { $in: ['Nguyễn Văn An', 'Trần Thị Bình'] } });
        expect(imported).toHaveLength(2);
        imported.forEach((contact) => {
            expect(contact.createBy.toString()).toBe(user._id.toString());
            expect(contact.deleted).toBe(false);
            expect(contact.createdDate).toBeDefined();
        });
    });

    test('rejects a body that is not an array', async () => {
        const { token } = await createUserWithToken();
        expect((await api().post('/api/contact/import').set('Authorization', token).send({ fullName: 'x' })).status).toBe(400);
    });

    test('accepts files of a few thousand rows and refuses more than 5000', async () => {
        const { token } = await createUserWithToken();
        const rows = Array.from({ length: 3000 }, (_, i) => ({
            fullName: `Khách hàng số ${i + 1}`, phoneNumber: `09${String(10000000 + i)}`, interestedArea: 'Thủ Đức, TP. Hồ Chí Minh', notesandComments: 'Nhập từ file sự kiện mở bán',
        }));
        const res = await api().post('/api/contact/import').set('Authorization', token).send(rows);
        expect(res.status).toBe(200);
        expect(res.body.inserted).toBe(3000);
        expect(await Contact.countDocuments()).toBe(3000);
        const tooMany = Array.from({ length: 5001 }, () => ({ fullName: 'x' }));
        expect((await api().post('/api/contact/import').set('Authorization', token).send(tooMany)).status).toBe(400);
    });
});

describe('leads', () => {
    test('are checked against contacts and other leads', async () => {
        const a = await createUserWithToken();
        const b = await createUserWithToken();
        await Contact.create({ fullName: 'Customer', phoneNumber: '0901234567', createBy: a.user._id });
        expect((await api().post('/api/lead/add').set('Authorization', b.token).send({ leadName: 'X', leadPhoneNumber: '84901234567' })).status).toBe(409);

        const first = await api().post('/api/lead/add').set('Authorization', b.token).send({ leadName: 'Lead', leadPhoneNumber: '0912 345 678' });
        expect(first.status).toBe(200);
        expect(first.body.leadPhoneNumber).toBe('0912345678');
        expect((await api().post('/api/lead/add').set('Authorization', a.token).send({ leadName: 'Again', leadPhoneNumber: '0912345678' })).status).toBe(409);

        // changing another field of the lead is not a duplicate of itself
        expect((await api().put(`/api/lead/edit/${first.body._id}`).set('Authorization', b.token).send({ leadName: 'Lead 2', leadPhoneNumber: '0912345678' })).status).toBe(200);
        expect((await api().put(`/api/lead/edit/${first.body._id}`).set('Authorization', b.token).send({ leadPhoneNumber: '0901234567' })).status).toBe(409);
    });

    test('import skips duplicates and sets the status of new leads', async () => {
        const { token } = await createUserWithToken();
        const res = await api().post('/api/lead/import').set('Authorization', token).send([
            { leadName: 'Khách Facebook', leadPhoneNumber: '0901234567', leadSource: 'facebook' },
            { leadName: 'Khách Zalo', leadPhoneNumber: '0901234567' },
            { leadName: '', leadPhoneNumber: '0902222222' },
        ]);
        expect(res.status).toBe(200);
        expect(res.body.inserted).toBe(1);
        expect(res.body.skipped.map((s) => s.row)).toEqual([2, 3]);
        expect((await Lead.findOne()).leadStatus).toBe('new');
    });
});

describe('POST /api/lead/convert/:id', () => {
    test('creates the contact with the needs of the lead', async () => {
        const { token, user } = await createUserWithToken();
        const lead = await Lead.create({
            leadName: 'Phạm Minh Tuấn', leadPhoneNumber: '0901234567', leadEmail: 'tuan@example.com', leadSource: 'zalo',
            customerType: 'buyer', budgetFrom: 2000000000, budgetTo: 3000000000, interestedArea: 'Dĩ An', leadNotes: 'Cần nhà gần trường',
            leadStatus: 'appointment', createBy: user._id,
        });
        const res = await api().post(`/api/lead/convert/${lead._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
        expect(res.body.existing).toBe(false);
        expect(res.body.contact).toMatchObject({
            fullName: 'Phạm Minh Tuấn', firstName: 'Tuấn', lastName: 'Phạm Minh', phoneNumber: '0901234567', email: 'tuan@example.com',
            leadSource: 'zalo', leadStatus: 'consulting', customerType: 'buyer', budgetFrom: 2000000000, budgetTo: 3000000000,
            interestedArea: 'Dĩ An', notesandComments: 'Cần nhà gần trường', createBy: user._id.toString(),
        });
        const saved = await Lead.findById(lead._id);
        expect(saved.leadStatus).toBe('converted');
        expect(saved.convertedContact.toString()).toBe(res.body.contact._id);
        expect(saved.leadConversionDate).toBeDefined();

        // converting twice is refused
        const again = await api().post(`/api/lead/convert/${lead._id}`).set('Authorization', token);
        expect(again.status).toBe(400);
        expect(again.body.contactId).toBe(res.body.contact._id);
        expect(await Contact.countDocuments()).toBe(1);

        // the converted lead does not block its number any more (its contact does)
        const dup = await api().post('/api/lead/add').set('Authorization', token).send({ leadName: 'x', leadPhoneNumber: '0901234567' });
        expect(dup.body.duplicate.type).toBe('contact');
    });

    test('links the lead to an existing contact of the caller', async () => {
        const { token, user } = await createUserWithToken();
        const contact = await Contact.create({ fullName: 'Existing', phoneNumber: '0901234567', createBy: user._id });
        const lead = await Lead.create({ leadName: 'Same person', leadPhoneNumber: '0901234567', createBy: user._id });
        const res = await api().post(`/api/lead/convert/${lead._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
        expect(res.body.existing).toBe(true);
        expect(res.body.contact._id).toBe(contact._id.toString());
        expect(await Contact.countDocuments()).toBe(1);
    });

    test("refuses to merge into another employee's contact", async () => {
        const a = await createUserWithToken();
        const b = await createUserWithToken();
        await Contact.create({ fullName: 'Of A', phoneNumber: '0901234567', createBy: a.user._id });
        const lead = await Lead.create({ leadName: 'Of B', leadPhoneNumber: '0901234567', createBy: b.user._id });
        const res = await api().post(`/api/lead/convert/${lead._id}`).set('Authorization', b.token);
        expect(res.status).toBe(409);
        expect(res.body.duplicate).not.toHaveProperty('_id');
        expect((await Lead.findById(lead._id)).leadStatus).toBeUndefined();
    });

    test('is limited to the leads of the caller', async () => {
        const a = await createUserWithToken();
        const b = await createUserWithToken();
        const lead = await Lead.create({ leadName: 'Of A', leadPhoneNumber: '0901234567', createBy: a.user._id });
        expect((await api().post(`/api/lead/convert/${lead._id}`).set('Authorization', b.token)).status).toBe(404);
        expect((await api().post(`/api/lead/convert/${objectId()}`).set('Authorization', a.token)).status).toBe(404);
        expect((await api().post('/api/lead/convert/nope').set('Authorization', a.token)).status).toBe(400);
    });

    test('the contact page shows the history of the converted lead', async () => {
        const { token, user } = await createUserWithToken();
        const lead = await Lead.create({ leadName: 'Lead', leadPhoneNumber: '0901234567', createBy: user._id });
        await Task.create({ title: 'Gọi lại', assignmentToLead: lead._id, createBy: user._id });
        await PhoneCall.create({ sender: user._id, callNotes: 'Tư vấn lần đầu', createByLead: lead._id });
        await MeetingHistory.create({ agenda: 'Xem nhà', attendesLead: [lead._id], createdBy: user._id });
        const converted = await api().post(`/api/lead/convert/${lead._id}`).set('Authorization', token);

        const view = await api().get(`/api/contact/view/${converted.body.contact._id}`).set('Authorization', token);
        expect(view.status).toBe(200);
        expect(view.body.task.map((t) => t.title)).toEqual(['Gọi lại']);
        expect(view.body.phoneCallHistory.map((c) => c.callNotes)).toEqual(['Tư vấn lần đầu']);
        expect(view.body.meetingHistory.map((m) => m.agenda)).toEqual(['Xem nhà']);
        expect(view.body.deals).toEqual([]);
    });
});
