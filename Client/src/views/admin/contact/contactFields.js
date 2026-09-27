import {
    CONTACT_STATUSES, CUSTOMER_TYPES, GENDERS, LEAD_SOURCES, PROPERTY_TYPES, TITLES,
} from 'constants/realEstate';
import { displayName, formatPriceShort, isValidPhone, normalizePhone, parseMoneyText, toDateInput } from 'utils/format';
import { matchOption } from 'utils/options';
import * as yup from 'yup';

// Codes of older versions
const LEGACY_STATUS = { newLead: 'new', qualifiedLead: 'consulting', negotiatingLead: 'negotiating' };
const LEGACY_TYPE = { homeBuyer: 'buyer', seller: 'seller', investor: 'investor' };
const LEGACY_GENDER = { Male: 'male', Female: 'female' };

export const contactStatusOf = (contact) => LEGACY_STATUS[contact?.leadStatus] || contact?.leadStatus || 'new';
export const customerTypeOf = (contact) => contact?.customerType || LEGACY_TYPE[contact?.tagsOrLabelsForcategorizingcontacts] || '';

// Budget of a customer or a lead: "3 tỷ – 4,5 tỷ"
export const budgetText = (person) => {
    const from = formatPriceShort(person?.budgetFrom, { empty: '' });
    const to = formatPriceShort(person?.budgetTo, { empty: '' });
    if (from && to) return `${from} – ${to}`;
    if (to) return `≤ ${to}`;
    if (from) return `≥ ${from}`;
    return '';
};

// Stored as a number, kept as text in the form (select values)
export const RATINGS = [
    { value: '5', label: '★★★★★ Rất tiềm năng' },
    { value: '4', label: '★★★★ Tiềm năng' },
    { value: '3', label: '★★★ Bình thường' },
    { value: '2', label: '★★ Ít tiềm năng' },
    { value: '1', label: '★ Chưa rõ' },
];

const FIELD_NAMES = [
    'title', 'fullName', 'phoneNumber', 'mobileNumber', 'zalo', 'email', 'gender', 'birthday', 'occupation', 'physicalAddress',
    'facebookProfile', 'idNumber', 'customerType', 'interestedPropertyType', 'budgetFrom', 'budgetTo', 'interestedArea',
    'preferences', 'leadSource', 'referralSource', 'campaignSource', 'leadStatus', 'leadRating', 'notesandComments', 'dataConsent',
];
const NUMBER_FIELDS = ['budgetFrom', 'budgetTo', 'leadRating'];

export const contactFields = [
    { section: 'Thông tin khách hàng' },
    { name: 'title', label: 'Danh xưng', type: 'select', options: TITLES },
    { name: 'fullName', label: 'Họ và tên', required: true, placeholder: 'VD: Nguyễn Văn An' },
    { name: 'phoneNumber', label: 'Số điện thoại', type: 'phone', required: true, placeholder: 'VD: 0901 234 567' },
    { name: 'mobileNumber', label: 'Số điện thoại khác', type: 'phone' },
    { name: 'zalo', label: 'Zalo', help: 'Để trống nếu Zalo trùng số điện thoại' },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'gender', label: 'Giới tính', type: 'select', options: GENDERS },
    { name: 'birthday', label: 'Ngày sinh', type: 'date' },
    { name: 'occupation', label: 'Nghề nghiệp' },
    { name: 'facebookProfile', label: 'Facebook', placeholder: 'Link trang cá nhân' },
    { name: 'physicalAddress', label: 'Địa chỉ liên hệ', span: 2 },
    { name: 'idNumber', label: 'Số CCCD', help: 'Chỉ cần khi làm hợp đồng đặt cọc, mua bán' },

    { section: 'Nhu cầu' },
    { name: 'customerType', label: 'Nhu cầu', type: 'select', options: CUSTOMER_TYPES },
    { name: 'interestedPropertyType', label: 'Loại BĐS quan tâm', type: 'select', options: PROPERTY_TYPES },
    { name: 'budgetFrom', label: 'Ngân sách từ', type: 'money' },
    { name: 'budgetTo', label: 'Ngân sách đến', type: 'money' },
    { name: 'interestedArea', label: 'Khu vực quan tâm', span: 2, placeholder: 'VD: Thủ Đức, Quận 7 cũ, gần Metro' },
    { name: 'preferences', label: 'Yêu cầu khác', type: 'textarea', span: 2, rows: 2, placeholder: 'Số phòng ngủ, hướng, pháp lý, hình thức thanh toán...' },

    { section: 'Chăm sóc' },
    { name: 'leadStatus', label: 'Tình trạng', type: 'select', options: CONTACT_STATUSES, placeholder: false },
    { name: 'leadRating', label: 'Mức độ tiềm năng', type: 'select', options: RATINGS },
    { name: 'leadSource', label: 'Nguồn khách', type: 'select', options: LEAD_SOURCES },
    { name: 'referralSource', label: 'Người giới thiệu', hidden: (values) => values.leadSource !== 'referral' },
    { name: 'campaignSource', label: 'Chiến dịch / dự án quảng cáo' },
    { name: 'notesandComments', label: 'Ghi chú', type: 'textarea', span: 2, rows: 3 },
    {
        name: 'dataConsent', type: 'checkbox', span: 2,
        checkboxLabel: 'Khách đồng ý cho công ty lưu trữ và sử dụng thông tin cá nhân để tư vấn (Luật Bảo vệ dữ liệu cá nhân)',
    },
];

const phone = (required) => yup.string().nullable()
    .test('phone', 'Số điện thoại không hợp lệ', (value) => !value || isValidPhone(value))
    .test('required', 'Vui lòng nhập số điện thoại', (value) => !required || Boolean(value && value.trim()));

export const contactSchema = yup.object({
    fullName: yup.string().trim().required('Vui lòng nhập họ và tên'),
    phoneNumber: phone(true),
    mobileNumber: phone(false),
    email: yup.string().nullable().email('Email không hợp lệ'),
    budgetFrom: yup.number().nullable().min(0, 'Ngân sách không được âm'),
    budgetTo: yup.number().nullable().min(0, 'Ngân sách không được âm')
        .test('range', 'Phải lớn hơn hoặc bằng "Ngân sách từ"', function check(value) {
            const { budgetFrom } = this.parent;
            return !value || !budgetFrom || value >= budgetFrom;
        }),
});

export const contactInitialValues = (contact = {}) => {
    const values = Object.fromEntries(FIELD_NAMES.map((name) => [name, contact[name] ?? (NUMBER_FIELDS.includes(name) ? null : '')]));
    values.fullName = contact.fullName || displayName(contact);
    values.phoneNumber = normalizePhone(contact.phoneNumber);
    values.mobileNumber = normalizePhone(contact.mobileNumber);
    values.leadStatus = contactStatusOf(contact);
    values.customerType = customerTypeOf(contact);
    values.gender = LEGACY_GENDER[contact.gender] || contact.gender || '';
    values.birthday = toDateInput(contact.birthday);
    values.dataConsent = Boolean(contact.dataConsent);
    values.leadRating = contact.leadRating ? String(contact.leadRating) : '';
    return values;
};

export const contactPayload = (values) => ({
    ...values,
    phoneNumber: normalizePhone(values.phoneNumber),
    mobileNumber: normalizePhone(values.mobileNumber),
    birthday: values.birthday || null,
    leadRating: values.leadRating ? Number(values.leadRating) : null,
});

// Columns of an import file (see ImportModal)
export const contactImportFields = [
    { key: 'fullName', label: 'Họ và tên', aliases: ['Họ tên', 'Tên khách hàng', 'Tên khách', 'Khách hàng', 'Tên', 'Name', 'Full name'], example: 'Nguyễn Văn An' },
    { key: 'phoneNumber', label: 'Số điện thoại', aliases: ['SĐT', 'Điện thoại', 'Di động', 'Phone', 'Mobile', 'SĐT chính'], example: '0901234567' },
    { key: 'mobileNumber', label: 'SĐT khác', aliases: ['Số điện thoại khác', 'SĐT phụ', 'Điện thoại 2'] },
    { key: 'zalo', label: 'Zalo' },
    { key: 'email', label: 'Email', aliases: ['E-mail', 'Thư điện tử'] },
    { key: 'title', label: 'Danh xưng', aliases: ['Xưng hô'], example: 'Anh' },
    { key: 'physicalAddress', label: 'Địa chỉ', aliases: ['Địa chỉ liên hệ', 'Address'] },
    { key: 'customerType', label: 'Nhu cầu', example: 'Mua', transform: (text) => matchOption(CUSTOMER_TYPES, text) },
    { key: 'interestedPropertyType', label: 'Loại BĐS quan tâm', aliases: ['Loại BĐS', 'Loại bất động sản'], example: 'Căn hộ chung cư', transform: (text) => matchOption(PROPERTY_TYPES, text) },
    { key: 'budgetFrom', label: 'Ngân sách từ', aliases: ['Ngân sách', 'Tài chính'], example: '3 tỷ', transform: parseMoneyText },
    { key: 'budgetTo', label: 'Ngân sách đến', example: '4,5 tỷ', transform: parseMoneyText },
    { key: 'interestedArea', label: 'Khu vực quan tâm', aliases: ['Khu vực'], example: 'Thủ Đức' },
    { key: 'leadSource', label: 'Nguồn khách', aliases: ['Nguồn'], example: 'Facebook', transform: (text) => matchOption(LEAD_SOURCES, text) },
    { key: 'leadStatus', label: 'Tình trạng', aliases: ['Trạng thái'], transform: (text) => matchOption(CONTACT_STATUSES, text) },
    { key: 'notesandComments', label: 'Ghi chú', aliases: ['Note', 'Notes'] },
];
