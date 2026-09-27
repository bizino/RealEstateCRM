import { contactSchema } from './contactSchema';

const validContact = {
    firstName: 'John',
    lastName: 'Doe',
    title: 'Mr.',
    email: 'john@example.com',
    phoneNumber: '0901234567',
    physicalAddress: '1 Main St',
    preferredContactMethod: 'Email',
};

const errorAt = async (path, value) => {
    try {
        await contactSchema.validateAt(path, { ...validContact, [path]: value });
        return null;
    } catch (error) {
        return error.message;
    }
};

describe('contactSchema phone numbers', () => {
    test('accepts a complete contact with a local number', async () => {
        await expect(contactSchema.isValid(validContact)).resolves.toBe(true);
    });

    test.each(['0901234567', '9876543210', '84901234567'])('accepts the phone number %s', async (phone) => {
        expect(await errorAt('phoneNumber', phone)).toBeNull();
    });

    test.each(['090123456', '0901-234-567', 'phone'])('rejects the phone number %s', async (phone) => {
        expect(await errorAt('phoneNumber', phone)).toBe('Phone number is invalid');
    });

    test('requires the phone number but not the mobile number', async () => {
        expect(await errorAt('phoneNumber', '')).toBe('Phonenumber is Required');
        expect(await errorAt('mobileNumber', '')).toBeNull();
        expect(await errorAt('mobileNumber', undefined)).toBeNull();
        expect(await errorAt('mobileNumber', '0987654321')).toBeNull();
        expect(await errorAt('mobileNumber', '123')).toBe('Phone number is invalid');
    });
});
