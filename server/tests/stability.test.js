// Starts the real server process (index.js) and sends requests that used to
// terminate it with an unhandled promise rejection.
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const request = require('supertest');
const User = require('../model/schema/user');

const serverDir = path.join(__dirname, '..');
const dbName = `stability_${randomUUID()}`;
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-stability-'));
let child;
let baseUrl;
let output = '';
let exitCode = null;

const freePort = () => new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
        const { port } = srv.address();
        srv.close(() => resolve(port));
    });
});

const waitFor = async (predicate, timeoutMs = 20000) => {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) throw new Error(`Timed out, server output:\n${output}`);
        await new Promise((r) => setTimeout(r, 50));
    }
};

beforeAll(async () => {
    const port = await freePort();
    baseUrl = `http://127.0.0.1:${port}`;
    // run from a temporary working directory so uploads do not end up in the repository
    child = spawn(process.execPath, [path.join(serverDir, 'index.js')], {
        cwd: workDir,
        env: { ...process.env, PORT: String(port), DB_URL: process.env.TEST_MONGO_URI, DB: dbName, NODE_ENV: 'test' },
    });
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    child.on('exit', (code, signal) => { exitCode = code === null ? signal : code; });
    await waitFor(() => output.includes('Server listening') && output.includes('Database Connected'));

    await mongoose.connect(process.env.TEST_MONGO_URI, { dbName });
    await User.create({ username: 'stability@test.com', password: await bcrypt.hash('secret123', 4), role: 'admin' });
});

afterAll(async () => {
    if (child && exitCode === null) {
        child.kill();
        await waitFor(() => exitCode !== null).catch(() => { });
    }
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    fs.rmSync(workDir, { recursive: true, force: true });
});

const expectAlive = async () => {
    expect(exitCode).toBeNull();
    const res = await request(baseUrl).get('/');
    expect(res.status).toBe(200);
};

test('the server survives malformed requests', async () => {
    const loginRes = await request(baseUrl).post('/api/user/login').send({ username: 'stability@test.com', password: 'secret123' });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token;

    const attacks = [
        () => request(baseUrl).get('/api/lead/view/not-an-id').set('Authorization', token),
        () => request(baseUrl).get('/api/property/view/not-an-id').set('Authorization', token),
        () => request(baseUrl).get('/api/contact?createBy=not-an-id').set('Authorization', token),
        () => request(baseUrl).get('/api/task?createBy=not-an-id').set('Authorization', token),
        () => request(baseUrl).get('/api/text-msg?sender=not-an-id').set('Authorization', token),
        () => request(baseUrl).get('/api/reporting?_id=not-an-id').set('Authorization', token),
        () => request(baseUrl).post('/api/email/add').set('Authorization', token).send({ recipient: 'a@b.c', createBy: 'not-an-id' }),
        () => request(baseUrl).post('/api/phoneCall/add').set('Authorization', token).send({ recipient: '1', createBy: 'not-an-id' }),
        () => request(baseUrl).post('/api/task/add').set('Authorization', token).send({ title: 't', assignmentTo: 'not-an-id' }),
        () => request(baseUrl).post('/api/document/add').set('Authorization', token).field('createBy', 'x'),
        () => request(baseUrl).get('/api/contact'),
    ];

    for (const attack of attacks) {
        await attack().timeout(5000).catch(() => { });
        await new Promise((r) => setTimeout(r, 100));
        await expectAlive();
    }
});
