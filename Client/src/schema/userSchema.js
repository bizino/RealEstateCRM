import { isValidPhone } from 'utils/format';
import * as yup from 'yup';

// Profile of an employee (edit)
export const userSchema = yup.object({
    fullName: yup.string().trim().required('Vui lòng nhập họ và tên').max(100, 'Họ và tên tối đa 100 ký tự'),
    username: yup.string().trim().required('Vui lòng nhập email đăng nhập').email('Email không hợp lệ'),
    phoneNumber: yup.string().nullable().test('phone', 'Số điện thoại không hợp lệ', (value) => !value || isValidPhone(value)),
    position: yup.string().nullable().max(100, 'Chức danh tối đa 100 ký tự'),
    brokerCertificate: yup.string().nullable().max(50, 'Số chứng chỉ tối đa 50 ký tự'),
});

// New account: the profile, a password and the role
export const newUserSchema = userSchema.shape({
    password: yup.string().required('Vui lòng nhập mật khẩu').min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
    role: yup.string().oneOf(['user', 'admin'], 'Vai trò không hợp lệ').required('Vui lòng chọn vai trò'),
});
