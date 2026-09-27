import * as yup from 'yup';

export const loginSchema = yup.object({
    username: yup.string().trim().required('Vui lòng nhập email').email('Email không hợp lệ'),
    password: yup.string().required('Vui lòng nhập mật khẩu'),
});
