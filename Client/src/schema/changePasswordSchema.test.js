import { changePasswordSchema } from './changePasswordSchema';

const errors = async (schema, values) => {
    try {
        await schema.validate(values, { abortEarly: false });
        return [];
    } catch (error) {
        return error.errors;
    }
};

describe('changePasswordSchema', () => {
    test('a user must give the current password', async () => {
        expect(await errors(changePasswordSchema(true), { newPassword: 'secret-1', confirmPassword: 'secret-1' })).toEqual(['Current Password Is required']);
    });

    test('an admin resetting another user does not need it', async () => {
        expect(await errors(changePasswordSchema(false), { newPassword: 'secret-1', confirmPassword: 'secret-1' })).toEqual([]);
    });

    test('checks the length and the confirmation of the new password', async () => {
        expect(await errors(changePasswordSchema(false), { newPassword: '123', confirmPassword: '123' })).toEqual(['Password must have at least 6 characters']);
        expect(await errors(changePasswordSchema(false), { newPassword: 'secret-1', confirmPassword: 'secret-2' })).toEqual(['Passwords do not match']);
    });
});
