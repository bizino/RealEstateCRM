import { leadSchema } from './leadSchema';

const validLead = {
    leadName: 'Nguyen Van A',
    leadEmail: 'a@example.com',
    leadPhoneNumber: '0901234567',
    leadAddress: '12 Le Loi, HCMC',
    leadCreationDate: '2026-09-01',
    leadConversionDate: '2026-10-01',
    leadFollowUpDate: '2026-09-15',
    leadScore: 80,
    leadConversionRate: 30,
};

const phoneError = async (leadPhoneNumber) => {
    try {
        await leadSchema.validateAt('leadPhoneNumber', { ...validLead, leadPhoneNumber });
        return null;
    } catch (error) {
        return error.message;
    }
};

describe('leadSchema', () => {
    test('accepts a complete lead', async () => {
        await expect(leadSchema.isValid(validLead)).resolves.toBe(true);
    });

    test.each(['0901234567', '9876543210', '84901234567', '849012345678'])('accepts the phone number %s', async (phone) => {
        expect(await phoneError(phone)).toBeNull();
    });

    test.each(['12345', '0901 234 567', 'abcdefghij', '8490123456789'])('rejects the phone number %s', async (phone) => {
        expect(await phoneError(phone)).toBe('Phone number is invalid');
    });

    test('requires a phone number', async () => {
        expect(await phoneError('')).toBe('Lead Phone Number Is required');
    });
});
