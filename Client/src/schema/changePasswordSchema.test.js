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
        expect(await errors(changePasswordSchema(true), { newPassword: 'secret-1', confirmPassword: 'secret-1' })).toEqual(['Vui lòng nhập mật khẩu hiện tại']);
    });

    test('an admin resetting another user does not need it', async () => {
        expect(await errors(changePasswordSchema(false), { newPassword: 'secret-1', confirmPassword: 'secret-1' })).toEqual([]);
    });

    test('checks the length and the confirmation of the new password', async () => {
        expect(await errors(changePasswordSchema(false), { newPassword: '123', confirmPassword: '123' })).toEqual(['Mật khẩu mới phải có ít nhất 6 ký tự']);
        expect(await errors(changePasswordSchema(false), { newPassword: 'secret-1', confirmPassword: 'secret-2' })).toEqual(['Mật khẩu nhập lại không khớp']);
    });

    test('asks for all the fields', async () => {
        expect(await errors(changePasswordSchema(true), {})).toEqual([
            'Vui lòng nhập mật khẩu hiện tại',
            'Vui lòng nhập mật khẩu mới',
            'Vui lòng nhập lại mật khẩu mới',
        ]);
    });

    test('the new password must differ from the current one', async () => {
        expect(await errors(changePasswordSchema(true), { currentPassword: 'secret-1', newPassword: 'secret-1', confirmPassword: 'secret-1' }))
            .toEqual(['Mật khẩu mới phải khác mật khẩu hiện tại']);
        expect(await errors(changePasswordSchema(true), { currentPassword: 'secret-1', newPassword: 'secret-2', confirmPassword: 'secret-2' })).toEqual([]);
    });
});
