import { isValidPhone } from 'utils/format';
import * as yup from 'yup';

const isDate = (value) => !value || !Number.isNaN(new Date(value).getTime());

// Time of a call or an email (value of an <input type="datetime-local">)
export const activityDateSchema = yup.string().required('Vui lòng chọn thời gian').test('date', 'Thời gian không hợp lệ', isDate);

// Calls and emails are logged for a customer (category "contact", field
// createBy) or a lead (category "lead", field createByLead)
export const requireCustomer = (schema) => schema.test('customer', 'Vui lòng chọn khách', function check(values) {
    const isLead = values?.category === 'lead';
    if (!values || (isLead ? values.createByLead : values.createBy)) return true;
    return this.createError({
        path: isLead ? 'createByLead' : 'createBy',
        message: isLead ? 'Vui lòng chọn khách tiềm năng' : 'Vui lòng chọn khách hàng',
    });
});

export const phoneCallSchema = requireCustomer(yup.object({
    category: yup.string().oneOf(['contact', 'lead']),
    createBy: yup.string().nullable(),
    createByLead: yup.string().nullable(),
    recipient: yup.string().trim()
        .required('Vui lòng nhập số điện thoại')
        .test('phone', 'Số điện thoại không hợp lệ', (value) => !value || isValidPhone(value)),
    callResult: yup.string().required('Vui lòng chọn kết quả cuộc gọi'),
    startDate: activityDateSchema,
    callDuration: yup.number().typeError('Thời lượng phải là số').nullable()
        .min(0, 'Thời lượng không được âm')
        .max(600, 'Thời lượng tối đa 600 phút'),
    callNotes: yup.string().nullable().max(5000, 'Nội dung tối đa 5000 ký tự'),
}));
