jest.mock('stripe');
const stripeModule = require('stripe');
const { connect, disconnect, clearDatabase, createUserWithToken, api } = require('./helpers');

const stripe = {
    checkout: { sessions: { create: jest.fn() } },
    paymentIntents: { list: jest.fn() },
    paymentMethods: { retrieve: jest.fn() },
};
stripeModule.mockImplementation(() => stripe);

beforeAll(connect);
afterAll(disconnect);
afterEach(async () => {
    await clearDatabase();
    jest.clearAllMocks();
});

describe('POST /api/payment/add', () => {
    test('creates a checkout session with integer amounts', async () => {
        stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.test/session' });
        const res = await api().post('/api/payment/add').send({
            items: [{ quantity: 1, price: 19.99, name: 'Deposit', description: 'send to Prolink' }],
            customer_email: 'buyer@example.com',
        });
        expect(res.status).toBe(200);
        expect(res.body.url).toBe('https://checkout.stripe.test/session');
        const params = stripe.checkout.sessions.create.mock.calls[0][0];
        expect(params.customer_email).toBe('buyer@example.com');
        expect(params.line_items[0].price_data.unit_amount).toBe(1999);
        expect(params.line_items[0].quantity).toBe(1);
    });

    test('sends the customer back to CLIENT_URL', async () => {
        stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.test/session' });
        process.env.CLIENT_URL = 'https://crm.example.vn/';
        try {
            await api().post('/api/payment/add').send({ items: [{ quantity: 1, price: 10, name: 'x' }] });
        } finally {
            delete process.env.CLIENT_URL;
        }
        const params = stripe.checkout.sessions.create.mock.calls[0][0];
        expect(params.success_url).toBe('https://crm.example.vn/payments');
        expect(params.cancel_url).toBe('https://crm.example.vn/payments');
    });

    test('falls back to the demo site when CLIENT_URL is not set', async () => {
        stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.test/session' });
        await api().post('/api/payment/add').send({ items: [{ quantity: 1, price: 10, name: 'x' }] });
        expect(stripe.checkout.sessions.create.mock.calls[0][0].success_url).toBe('https://real-estate-crm-jet.vercel.app/payments');
    });

    test('rejects a request without items or with an invalid price', async () => {
        expect((await api().post('/api/payment/add').send({ customer_email: 'a@b.c' })).status).toBe(400);
        expect((await api().post('/api/payment/add').send({ items: [{ quantity: 1, price: 'abc' }] })).status).toBe(400);
        expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    test('returns 500 when Stripe fails', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => { });
        stripe.checkout.sessions.create.mockRejectedValue(new Error('Invalid API Key provided'));
        const res = await api().post('/api/payment/add').send({ items: [{ quantity: 1, price: 10, name: 'x' }] });
        log.mockRestore();
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Invalid API Key provided');
    });
});

describe('GET /api/payment', () => {
    test('is restricted to admins', async () => {
        expect((await api().get('/api/payment')).status).toBe(401);
        const { token } = await createUserWithToken();
        expect((await api().get('/api/payment').set('Authorization', token)).status).toBe(403);
        expect(stripe.paymentIntents.list).not.toHaveBeenCalled();
    });

    test('lists card payments and skips unfinished ones', async () => {
        const { token } = await createUserWithToken({ role: 'admin' });
        stripe.paymentIntents.list.mockResolvedValue({
            data: [
                { id: 'pi_1', amount: 199900, payment_method: 'pm_1' },
                { id: 'pi_2', amount: 5000, payment_method: null },
            ],
        });
        stripe.paymentMethods.retrieve.mockResolvedValue({
            card: { exp_month: 4, exp_year: 2030, brand: 'visa', last4: '4242' },
            billing_details: { name: 'Buyer', email: 'buyer@example.com' },
        });
        const res = await api().get('/api/payment').set('Authorization', token);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([{
            id: 'pi_1', amount: 199900, cardholderName: 'Buyer', cardholderEmail: 'buyer@example.com',
            cardExp: '04/30', cardBrand: 'visa', cardNumber: '**** **** **** 4242',
        }]);
    });
});
