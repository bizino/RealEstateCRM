import * as yup from 'yup';
import { activityDateSchema, requireCustomer } from './phoneCallSchema';

// Email sent to a customer, saved to the customer's history
export const emailSchema = requireCustomer(yup.object({
    category: yup.string().oneOf(['contact', 'lead']),
    createBy: yup.string().nullable(),
    createByLead: yup.string().nullable(),
    recipient: yup.string().trim().required('Vui lòng nhập email người nhận').email('Email không hợp lệ'),
    subject: yup.string().trim().required('Vui lòng nhập tiêu đề').max(300, 'Tiêu đề tối đa 300 ký tự'),
    message: yup.string().nullable().max(20000, 'Nội dung quá dài'),
    startDate: activityDateSchema,
}));
