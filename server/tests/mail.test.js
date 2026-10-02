jest.mock('nodemailer');
const nodemailer = require('nodemailer');
const { sendEmail } = require('../middelwares/mail');

const sendMail = jest.fn().mockResolvedValue({ response: '250 OK' });
nodemailer.createTransport.mockReturnValue({ sendMail });

const ENV_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];

afterEach(() => {
    ENV_KEYS.forEach((key) => delete process.env[key]);
    jest.clearAllMocks();
});

beforeAll(() => jest.spyOn(console, 'log').mockImplementation(() => { }));

test('uses the SMTP settings from the environment', async () => {
    Object.assign(process.env, { SMTP_HOST: 'smtp.example.vn', SMTP_PORT: '465', SMTP_USER: 'crm@example.vn', SMTP_PASS: 'app-password', SMTP_FROM: 'CRM <no-reply@example.vn>' });
    await expect(sendEmail('client@example.com', 'Hello', 'Body')).resolves.toBe('250 OK');
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.vn', port: 465, auth: { user: 'crm@example.vn', pass: 'app-password' },
    });
    expect(sendMail).toHaveBeenCalledWith({ from: 'CRM <no-reply@example.vn>', to: 'client@example.com', subject: 'Hello', text: 'Body' });
});

test('sends from the SMTP user when SMTP_FROM is not set', async () => {
    Object.assign(process.env, { SMTP_USER: 'crm@example.vn', SMTP_PASS: 'x' });
    await sendEmail('client@example.com', 'Hi', 'Body');
    expect(nodemailer.createTransport.mock.calls[0][0]).toMatchObject({ host: 'smtp.office365.com', port: 587 });
    expect(sendMail.mock.calls[0][0].from).toBe('crm@example.vn');
});

test('does nothing without a recipient', async () => {
    await expect(sendEmail('', 'Hi', 'Body')).resolves.toBeUndefined();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
});
