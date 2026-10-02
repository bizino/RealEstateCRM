import { toDateInput, toNumber } from 'utils/format';
import * as yup from 'yup';

const DATE_FIELDS = ['depositDate', 'contractDueDate', 'contractDate', 'completedDate', 'commissionReceivedDate'];
const idOf = (value) => (value && typeof value === 'object' ? value._id : value) || '';

// Commission computed by the API when no fixed amount is given
export const computedCommission = (values) => {
    const price = toNumber(values.price);
    const rate = toNumber(values.commissionRate);
    return price && rate ? Math.round((price * rate) / 100) : null;
};

export const commissionTotal = (values) => toNumber(values.commissionAmount) ?? computedCommission(values) ?? 0;

export const dealInitialValues = (deal = {}, defaults = {}) => {
    const source = { ...defaults, ...deal };
    return {
        title: source.title || '',
        dealType: source.dealType || 'sale',
        status: source.status || 'negotiating',
        contact: idOf(source.contact),
        property: idOf(source.property),
        price: source.price ?? null,
        depositAmount: source.depositAmount ?? null,
        contractNumber: source.contractNumber || '',
        commissionRate: source.commissionRate ?? null,
        commissionAmount: source.commissionAmount ?? null,
        commissionStatus: source.commissionStatus || 'pending',
        cancelReason: source.cancelReason || '',
        notes: source.notes || '',
        ...Object.fromEntries(DATE_FIELDS.map((field) => [field, toDateInput(source[field])])),
        payments: (source.payments || []).map((payment) => ({
            name: payment.name || '',
            dueDate: toDateInput(payment.dueDate),
            amount: payment.amount ?? null,
            paidDate: toDateInput(payment.paidDate),
            note: payment.note || '',
        })),
        commissionSplits: (source.commissionSplits || []).map((split) => ({
            user: idOf(split.user),
            role: split.role || 'selling',
            percent: split.percent ?? null,
        })),
        createBy: '',
    };
};

// Body sent to the API: empty dates cleared, the commission left to the API
// when it only follows the rate
export const dealPayload = (values, { isAdmin, isEdit }) => {
    const { createBy, ...payload } = values;
    DATE_FIELDS.forEach((field) => { payload[field] = payload[field] || null; });
    payload.property = payload.property || null;
    payload.payments = values.payments
        .filter((payment) => payment.name || payment.amount || payment.dueDate)
        .map((payment) => ({ ...payment, dueDate: payment.dueDate || null, paidDate: payment.paidDate || null }));
    payload.commissionSplits = values.commissionSplits
        .filter((split) => split.user)
        .map((split) => ({ ...split, percent: split.percent ?? 0 }));
    if (payload.status !== 'cancelled') payload.cancelReason = '';
    if (isAdmin && !isEdit && createBy) payload.createBy = createBy;
    return payload;
};

const money = (label) => yup.number().typeError(`${label} phải là số`).nullable().min(0, `${label} không được âm`);

export const dealSchema = yup.object({
    dealType: yup.string().required('Chọn loại giao dịch'),
    status: yup.string().required('Chọn trạng thái'),
    contact: yup.string().required('Chọn khách hàng'),
    price: money('Giá chốt'),
    depositAmount: money('Tiền cọc'),
    commissionAmount: money('Hoa hồng'),
    commissionRate: yup.number().typeError('Tỷ lệ phải là số').nullable().min(0, 'Tỷ lệ không được âm').max(100, 'Tối đa 100%'),
    cancelReason: yup.string().when('status', { is: 'cancelled', then: (schema) => schema.required('Nhập lý do hủy') }),
    // Rows without an employee are dropped when saving
    commissionSplits: yup.array()
        .test('percent', 'Tỷ lệ chia phải từ 0 đến 100%', (splits = []) => splits.every((split) => split.percent === null || (split.percent >= 0 && split.percent <= 100)))
        .test('total', 'Tổng tỷ lệ chia vượt quá 100%', (splits = []) => splits.filter((split) => split.user).reduce((sum, split) => sum + Number(split.percent || 0), 0) <= 100),
});
