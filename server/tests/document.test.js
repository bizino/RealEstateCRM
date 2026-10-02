const fs = require('fs');
const os = require('os');
const path = require('path');

// Uploads are written relative to the working directory, keep them out of the repository
const originalCwd = process.cwd();
const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-document-'));
process.chdir(uploadRoot);

const { connect, disconnect, clearDatabase, createUserWithToken, api, objectId } = require('./helpers');
const DocumentSchema = require('../model/schema/document');
const Contact = require('../model/schema/contact');
const Lead = require('../model/schema/lead');

beforeAll(connect);
afterAll(async () => {
    await disconnect();
    process.chdir(originalCwd);
    fs.rmSync(uploadRoot, { recursive: true, force: true });
});
afterEach(clearDatabase);

const upload = (token, { folderName, createBy, filename = '', files = [['content', 'file.txt']] }) => {
    let req = api().post('/api/document/add').set('Authorization', token);
    if (folderName !== undefined) req = req.field('folderName', folderName);
    if (createBy !== undefined) req = req.field('createBy', String(createBy));
    req = req.field('filename', filename);
    files.forEach(([content, name]) => { req = req.attach('files', Buffer.from(content), name); });
    return req;
};

describe('POST /api/document/add', () => {
    test('creates a folder with the uploaded files', async () => {
        const { user, token } = await createUserWithToken();
        const res = await upload(token, { folderName: 'Contracts', createBy: user._id, files: [['a', 'a.pdf'], ['b', 'b.pdf']] });
        expect(res.status).toBe(200);
        const folder = await DocumentSchema.findOne({ folderName: 'Contracts' });
        expect(folder.file.map((f) => f.fileName).sort()).toEqual([expect.stringMatching(/^a(-\d+)?\.pdf$/), expect.stringMatching(/^b(-\d+)?\.pdf$/)]);
        expect(folder.createBy.toString()).toBe(user._id.toString());

        // Documents are only served through the authenticated download endpoint
        const img = new URL(folder.file[0].img);
        expect(img.pathname).toBe(`/api/document/download/${folder.file[0]._id}`);
        expect((await api().get(img.pathname)).status).toBe(401);
        expect((await api().get(img.pathname).set('Authorization', token)).status).toBe(200);
    });

    test('appends files to an existing folder of the same user', async () => {
        const { user, token } = await createUserWithToken();
        await upload(token, { folderName: 'Contracts', createBy: user._id, files: [['a', 'a.pdf']] });
        await upload(token, { folderName: 'Contracts', createBy: user._id, files: [['b', 'b.pdf']] });
        const folders = await DocumentSchema.find({ folderName: 'Contracts' });
        expect(folders).toHaveLength(1);
        expect(folders[0].file).toHaveLength(2);
    });

    test("does not put a user's files into another user's folder with the same name", async () => {
        const a = await createUserWithToken();
        const b = await createUserWithToken();
        await upload(a.token, { folderName: 'Contracts', createBy: a.user._id, files: [['a', 'a.pdf']] });
        const res = await upload(b.token, { folderName: 'Contracts', createBy: b.user._id, files: [['b', 'b.pdf']] });
        expect(res.status).toBe(200);

        const listB = await api().get(`/api/document?createBy=${b.user._id}`).set('Authorization', b.token);
        expect(listB.body).toHaveLength(1);
        // a file with the same name may already exist on disk and get a timestamp
        expect(listB.body[0].files.map((f) => f.fileName)).toEqual([expect.stringMatching(/^b(-\d+)?\.pdf$/)]);

        const listA = await api().get(`/api/document?createBy=${a.user._id}`).set('Authorization', a.token);
        expect(listA.body[0].files.map((f) => f.fileName)).toEqual([expect.stringMatching(/^a(-\d+)?\.pdf$/)]);
    });

    test('uses the custom file name when provided', async () => {
        const { user, token } = await createUserWithToken();
        await upload(token, { folderName: 'F', createBy: user._id, filename: 'Signed contract', files: [['a', 'a.pdf']] });
        const folder = await DocumentSchema.findOne({ folderName: 'F' });
        expect(folder.file[0].fileName).toBe('Signed contract');
    });

    test('returns 400 without folder name (and keeps the server alive)', async () => {
        const { user, token } = await createUserWithToken();
        const res = await upload(token, { createBy: user._id });
        expect(res.status).toBe(400);
        expect((await api().get('/api/document').set('Authorization', token)).status).toBe(200);
    });

    test('returns 400 when no file is uploaded', async () => {
        const { user, token } = await createUserWithToken();
        const res = await upload(token, { folderName: 'Empty', createBy: user._id, files: [] });
        expect(res.status).toBe(400);
        expect(await DocumentSchema.countDocuments()).toBe(0);
    });

    test('requires authentication', async () => {
        const res = await api().post('/api/document/add').field('folderName', 'X').attach('files', Buffer.from('x'), 'x.txt');
        expect(res.status).toBe(401);
    });
});

describe('GET /api/document', () => {
    test('lists folders with non deleted files and creator name, scoped for regular users', async () => {
        const admin = await createUserWithToken({ role: 'admin' });
        const a = await createUserWithToken({ firstName: 'Ann', lastName: 'Lee' });
        const b = await createUserWithToken();
        await upload(a.token, { folderName: 'A1', createBy: a.user._id, files: [['1', '1.txt'], ['2', '2.txt']] });
        await upload(b.token, { folderName: 'B1', createBy: b.user._id });
        const folder = await DocumentSchema.findOne({ folderName: 'A1' });
        folder.file[0].deleted = true;
        await folder.save();

        const listA = await api().get('/api/document').set('Authorization', a.token);
        expect(listA.status).toBe(200);
        expect(listA.body).toHaveLength(1);
        expect(listA.body[0].folderName).toBe('A1');
        expect(listA.body[0].createByName).toBe('Ann Lee');
        expect(listA.body[0].files).toHaveLength(1);

        expect((await api().get('/api/document').set('Authorization', admin.token)).body).toHaveLength(2);
    });

    test('returns 400 (instead of hanging) for an invalid createBy filter', async () => {
        const admin = await createUserWithToken({ role: 'admin' });
        const res = await api().get('/api/document?createBy=invalid').set('Authorization', admin.token);
        expect(res.status).toBe(400);
    });
});

describe('document download, link and delete', () => {
    const uploadOne = async () => {
        const owner = await createUserWithToken();
        await upload(owner.token, { folderName: 'Docs', createBy: owner.user._id, files: [['hello world', 'hello.txt']] });
        const folder = await DocumentSchema.findOne({ folderName: 'Docs' });
        return { ...owner, folder, file: folder.file[0] };
    };

    test('downloads a file as an attachment', async () => {
        const { file, token } = await uploadOne();
        const res = await api().get(`/api/document/download/${file._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
        expect(res.headers['content-disposition']).toMatch(/^attachment; filename="hello(-\d+)?\.txt"$/);
        expect(res.text).toBe('hello world');
    });

    test('download returns 404 for an unknown file, a missing file on disk and 400 for an invalid id', async () => {
        const { file, token } = await uploadOne();
        expect((await api().get(`/api/document/download/${objectId()}`).set('Authorization', token)).status).toBe(404);
        expect((await api().get('/api/document/download/abc').set('Authorization', token)).status).toBe(400);
        fs.unlinkSync(path.resolve(file.path));
        expect((await api().get(`/api/document/download/${file._id}`).set('Authorization', token)).status).toBe(404);
    });

    test('only the uploader, the employee in charge of the linked customer and admins may download', async () => {
        const { file, token } = await uploadOne();
        const other = await createUserWithToken();
        const admin = await createUserWithToken({ role: 'admin' });
        expect((await api().get(`/api/document/download/${file._id}`)).status).toBe(401);
        expect((await api().get(`/api/document/download/${file._id}`).set('Authorization', other.token)).status).toBe(404);
        expect((await api().get(`/api/document/download/${file._id}`).set('Authorization', admin.token)).status).toBe(200);

        // a file linked to a customer of another employee is readable by that employee
        const contact = await Contact.create({ fullName: 'Khách của người khác', createBy: other.user._id });
        await api().post(`/api/document/link-document/${file._id}`).set('Authorization', token).send({ linkContact: contact._id });
        expect((await api().get(`/api/document/download/${file._id}`).set('Authorization', other.token)).status).toBe(200);
    });

    test('links a file to a contact and then to a lead', async () => {
        const { user, token, file } = await uploadOne();
        const contact = await Contact.create({ firstName: 'John', createBy: user._id });
        const lead = await Lead.create({ leadName: 'Lead', createBy: user._id });

        let res = await api().post(`/api/document/link-document/${file._id}`).set('Authorization', token).send({ linkContact: contact._id });
        expect(res.status).toBe(200);
        let view = await api().get(`/api/contact/view/${contact._id}`).set('Authorization', token);
        expect(view.body.Document).toHaveLength(1);
        expect(view.body.Document[0].files[0]._id).toBe(file._id.toString());

        res = await api().post(`/api/document/link-document/${file._id}`).set('Authorization', token).send({ linkLead: lead._id });
        expect(res.status).toBe(200);
        const saved = (await DocumentSchema.findOne({ 'file._id': file._id })).file.id(file._id);
        expect(saved.linkLead.toString()).toBe(lead._id.toString());
        expect(saved.linkContact).toBeNull();
        view = await api().get(`/api/lead/view/${lead._id}`).set('Authorization', token);
        expect(view.body.Document).toHaveLength(1);
    });

    test('link requires a contact or a lead, and authentication', async () => {
        const { token, file } = await uploadOne();
        expect((await api().post(`/api/document/link-document/${file._id}`).set('Authorization', token).send({})).status).toBe(400);
        expect((await api().post(`/api/document/link-document/${file._id}`).send({ linkContact: objectId() })).status).toBe(401);
    });

    test('soft deletes a file', async () => {
        const { token, file } = await uploadOne();
        const res = await api().delete(`/api/document/delete/${file._id}`).set('Authorization', token);
        expect(res.status).toBe(200);
        const saved = (await DocumentSchema.findOne({ 'file._id': file._id })).file.id(file._id);
        expect(saved.deleted).toBe(true);
        expect((await api().get('/api/document').set('Authorization', token)).body).toHaveLength(0);
    });

    test('delete requires authentication and returns 404 for unknown files', async () => {
        const { token, file } = await uploadOne();
        expect((await api().delete(`/api/document/delete/${file._id}`)).status).toBe(401);
        expect((await api().delete(`/api/document/delete/${objectId()}`).set('Authorization', token)).status).toBe(404);
    });
});

describe('Vietnamese file names', () => {
    test('are kept readable on upload', async () => {
        const { user, token } = await createUserWithToken();
        const res = await upload(token, { folderName: 'Hợp đồng', createBy: user._id, files: [['pdf', 'Sổ hồng căn 1508.pdf']] });
        expect(res.status).toBe(200);
        const folder = await DocumentSchema.findOne({ folderName: 'Hợp đồng' });
        expect(folder.file[0].fileName).toMatch(/^Sổ hồng căn 1508(-\d+)?\.pdf$/);
        expect(path.basename(folder.file[0].path)).toMatch(/^Sổ hồng căn 1508(-\d+)?\.pdf$/);
    });
});
