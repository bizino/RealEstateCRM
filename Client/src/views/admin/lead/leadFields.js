import { CUSTOMER_TYPES, LEAD_SOURCES, LEAD_STATUSES, PROPERTY_TYPES } from 'constants/realEstate';
import { isValidPhone, normalizePhone, parseMoneyText, parseDate, toDateInput } from 'utils/format';
import { matchOption } from 'utils/options';
import * as yup from 'yup';

const FIELD_NAMES = [
    'leadName', 'leadPhoneNumber', 'leadEmail', 'leadAddress', 'leadSource', 'leadCampaign', 'leadStatus',
    'customerType', 'interestedPropertyType', 'budgetFrom', 'budgetTo', 'interestedArea',
    'leadFollowUpDate', 'leadNextAction', 'leadNotes',
];
const NUMBER_FIELDS = ['budgetFrom', 'budgetTo'];

// "converted" is set by the conversion into a customer, not by hand: it is
// only shown (like the codes of older versions)
const STATUS_OPTIONS = LEAD_STATUSES.map((option) => (option.value === 'converted' ? { ...option, legacy: true } : option));

export const leadFields = [
    { section: 'Thông tin khách' },
    { name: 'leadName', label: 'Họ và tên', required: true, placeholder: 'VD: Trần Thị Bình' },
    { name: 'leadPhoneNumber', label: 'Số điện thoại', type: 'phone', required: true, placeholder: 'VD: 0901 234 567' },
    { name: 'leadEmail', label: 'Email', type: 'email' },
    { name: 'leadAddress', label: 'Địa chỉ' },
    { name: 'leadSource', label: 'Nguồn', type: 'select', options: LEAD_SOURCES },
    { name: 'leadCampaign', label: 'Chiến dịch / dự án quảng cáo', placeholder: 'VD: Quảng cáo Facebook dự án ABC' },
    { name: 'leadStatus', label: 'Tình trạng', type: 'select', options: STATUS_OPTIONS, placeholder: false },

    { section: 'Nhu cầu' },
    { name: 'customerType', label: 'Nhu cầu', type: 'select', options: CUSTOMER_TYPES },
    { name: 'interestedPropertyType', label: 'Loại BĐS quan tâm', type: 'select', options: PROPERTY_TYPES },
    { name: 'budgetFrom', label: 'Ngân sách từ', type: 'money' },
    { name: 'budgetTo', label: 'Ngân sách đến', type: 'money' },
    { name: 'interestedArea', label: 'Khu vực quan tâm', span: 2 },

    { section: 'Chăm sóc tiếp theo' },
    { name: 'leadFollowUpDate', label: 'Ngày hẹn liên hệ lại', type: 'date' },
    { name: 'leadNextAction', label: 'Việc cần làm tiếp', placeholder: 'VD: Gửi bảng giá, hẹn đi xem nhà' },
    { name: 'leadNotes', label: 'Ghi chú', type: 'textarea', span: 2, rows: 3 },
];

export const leadSchema = yup.object({
    leadName: yup.string().trim().required('Vui lòng nhập họ và tên'),
    leadPhoneNumber: yup.string().nullable()
        .test('required', 'Vui lòng nhập số điện thoại', (value) => Boolean(value && value.trim()))
        .test('phone', 'Số điện thoại không hợp lệ', (value) => !value || isValidPhone(value)),
    leadEmail: yup.string().nullable().email('Email không hợp lệ'),
    budgetTo: yup.number().nullable()
        .test('range', 'Phải lớn hơn hoặc bằng "Ngân sách từ"', function check(value) {
            const { budgetFrom } = this.parent;
            return !value || !budgetFrom || value >= budgetFrom;
        }),
});

export const leadInitialValues = (lead = {}) => {
    const values = Object.fromEntries(FIELD_NAMES.map((name) => [name, lead[name] ?? (NUMBER_FIELDS.includes(name) ? null : '')]));
    values.leadPhoneNumber = normalizePhone(lead.leadPhoneNumber);
    values.leadFollowUpDate = toDateInput(lead.leadFollowUpDate);
    values.leadStatus = lead.leadStatus || 'new';
    return values;
};

export const leadPayload = (values) => ({
    ...values,
    leadPhoneNumber: normalizePhone(values.leadPhoneNumber),
    leadFollowUpDate: values.leadFollowUpDate || null,
});

// Follow-up of a lead: overdue, today, upcoming or none
export const followUpState = (lead) => {
    if (['converted', 'lost'].includes(lead.leadStatus)) return 'none';
    const date = parseDate(lead.leadFollowUpDate);
    if (!date) return 'none';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    if (day < today) return 'overdue';
    return day.getTime() === today.getTime() ? 'today' : 'upcoming';
};

export const leadImportFields = [
    { key: 'leadName', label: 'Họ và tên', aliases: ['Họ tên', 'Tên khách hàng', 'Tên khách', 'Tên', 'Name', 'Full name'], example: 'Trần Thị Bình' },
    { key: 'leadPhoneNumber', label: 'Số điện thoại', aliases: ['SĐT', 'Điện thoại', 'Di động', 'Phone', 'Phone number', 'Mobile'], example: '0912345678' },
    { key: 'leadEmail', label: 'Email', aliases: ['E-mail'] },
    { key: 'leadAddress', label: 'Địa chỉ', aliases: ['Address'] },
    { key: 'leadSource', label: 'Nguồn', aliases: ['Nguồn khách', 'Source'], example: 'Facebook', transform: (text) => matchOption(LEAD_SOURCES, text) },
    { key: 'leadCampaign', label: 'Chiến dịch', aliases: ['Campaign', 'Dự án'] },
    { key: 'customerType', label: 'Nhu cầu', example: 'Mua', transform: (text) => matchOption(CUSTOMER_TYPES, text) },
    { key: 'interestedPropertyType', label: 'Loại BĐS quan tâm', aliases: ['Loại BĐS'], transform: (text) => matchOption(PROPERTY_TYPES, text) },
    { key: 'budgetFrom', label: 'Ngân sách từ', aliases: ['Ngân sách', 'Tài chính'], example: '2 tỷ', transform: parseMoneyText },
    { key: 'budgetTo', label: 'Ngân sách đến', transform: parseMoneyText },
    { key: 'interestedArea', label: 'Khu vực quan tâm', aliases: ['Khu vực'] },
    { key: 'leadNotes', label: 'Ghi chú', aliases: ['Note', 'Notes', 'Nội dung'] },
];
