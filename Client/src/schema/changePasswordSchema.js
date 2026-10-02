import * as yup from 'yup';

// Users confirm their current password, admins resetting another user's password do not
export const changePasswordSchema = (requireCurrentPassword) => yup.object({
    currentPassword: requireCurrentPassword ? yup.string().required('Vui lòng nhập mật khẩu hiện tại') : yup.string(),
    newPassword: requireCurrentPassword
        ? yup.string()
            .min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự')
            .test('different', 'Mật khẩu mới phải khác mật khẩu hiện tại', function isDifferent(value) {
                return !value || value !== this.parent.currentPassword;
            })
            .required('Vui lòng nhập mật khẩu mới')
        : yup.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự').required('Vui lòng nhập mật khẩu mới'),
    confirmPassword: yup.string()
        .oneOf([yup.ref('newPassword')], 'Mật khẩu nhập lại không khớp')
        .required('Vui lòng nhập lại mật khẩu mới'),
});
