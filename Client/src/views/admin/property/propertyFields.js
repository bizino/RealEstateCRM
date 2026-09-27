import {
    DIRECTIONS, FURNITURE, LEGAL_STATUSES, LISTING_STATUSES, PROPERTY_TYPES, PROVINCES, SOURCE_TYPES, TRANSACTION_TYPES, YES_NO,
} from 'constants/realEstate';
import { isValidPhone, normalizePhone, toDateInput, toNumber } from 'utils/format';
import * as yup from 'yup';

// Types sold by unit in a building: block, unit code and floor are asked
const UNIT_TYPES = ['apartment', 'miniApartment', 'condotel', 'office', 'shophouse'];
const isRent = (values) => values.transactionType === 'rent';

// Older versions used active / pending
const LEGACY_STATUS = { active: 'available', pending: 'deposited' };

const FIELD_NAMES = [
    'title', 'transactionType', 'propertyType', 'listingStatus', 'sourceType', 'price', 'commissionRate',
    'street', 'ward', 'province', 'oldAddress', 'projectName', 'block', 'unitCode', 'floorNumber', 'mapUrl',
    'area', 'usableArea', 'width', 'length', 'roadWidth', 'floors', 'numberofBedrooms', 'numberofBathrooms',
    'direction', 'balconyDirection', 'legalStatus', 'furniture', 'parkingAvailability', 'yearBuilt',
    'communityAmenities', 'propertyDescription',
    'ownerName', 'ownerPhone', 'contractExpiry', 'listingDate', 'commissionNote', 'internalNotesOrComments',
];
const NUMBER_FIELDS = ['price', 'commissionRate', 'area', 'usableArea', 'width', 'length', 'roadWidth', 'floors', 'numberofBedrooms', 'numberofBathrooms', 'yearBuilt'];
const DATE_FIELDS = ['contractExpiry', 'listingDate'];

export const propertyFields = ({ canSeeOwner = true } = {}) => [
    { section: 'Thông tin chính' },
    { name: 'title', label: 'Tiêu đề tin', span: 2, placeholder: 'VD: Bán nhà mặt tiền Nguyễn Thị Thập, 4x15m, 3 tầng' },
    { name: 'transactionType', label: 'Hình thức', type: 'select', options: TRANSACTION_TYPES, required: true },
    { name: 'propertyType', label: 'Loại bất động sản', type: 'select', options: PROPERTY_TYPES, required: true },
    { name: 'price', label: 'Giá', type: 'money', rent: isRent, help: 'Để trống nếu giá thỏa thuận. Cho thuê: giá mỗi tháng' },
    { name: 'listingStatus', label: 'Tình trạng', type: 'select', options: LISTING_STATUSES, placeholder: false },
    { name: 'sourceType', label: 'Nguồn hàng', type: 'select', options: SOURCE_TYPES },
    { name: 'commissionRate', label: 'Phí môi giới', type: 'number', suffix: '%', min: 0, max: 100, help: 'Phần trăm trên giá bán' },

    { section: 'Vị trí' },
    { name: 'street', label: 'Số nhà, tên đường', span: 2, placeholder: 'VD: 12 Nguyễn Thị Thập' },
    { name: 'ward', label: 'Phường / Xã', placeholder: 'VD: Phường Tân Hưng' },
    { name: 'province', label: 'Tỉnh / Thành phố', type: 'select', options: PROVINCES },
    { name: 'oldAddress', label: 'Địa chỉ cũ (trước sáp nhập)', placeholder: 'VD: Quận 7', help: 'Quận / huyện cũ để khách dễ hình dung' },
    { name: 'projectName', label: 'Dự án', placeholder: 'VD: Vinhomes Grand Park' },
    { name: 'block', label: 'Tòa / Block', hidden: (values) => !UNIT_TYPES.includes(values.propertyType) },
    { name: 'unitCode', label: 'Mã căn', hidden: (values) => !UNIT_TYPES.includes(values.propertyType) },
    { name: 'floorNumber', label: 'Tầng số', hidden: (values) => !UNIT_TYPES.includes(values.propertyType) },
    { name: 'mapUrl', label: 'Link Google Maps', type: 'url', span: 2, placeholder: 'https://maps.app.goo.gl/...' },

    { section: 'Diện tích và đặc điểm' },
    { name: 'area', label: 'Diện tích', type: 'number', suffix: 'm²', min: 0 },
    { name: 'usableArea', label: 'Diện tích sử dụng', type: 'number', suffix: 'm²', min: 0 },
    { name: 'width', label: 'Chiều ngang (mặt tiền)', type: 'number', suffix: 'm', min: 0 },
    { name: 'length', label: 'Chiều dài', type: 'number', suffix: 'm', min: 0 },
    { name: 'roadWidth', label: 'Đường / hẻm trước nhà', type: 'number', suffix: 'm', min: 0 },
    { name: 'floors', label: 'Số tầng', type: 'number', min: 0, step: 1 },
    { name: 'numberofBedrooms', label: 'Phòng ngủ', type: 'number', min: 0, step: 1 },
    { name: 'numberofBathrooms', label: 'Phòng tắm / WC', type: 'number', min: 0, step: 1 },
    { name: 'direction', label: 'Hướng nhà', type: 'select', options: DIRECTIONS },
    { name: 'balconyDirection', label: 'Hướng ban công', type: 'select', options: DIRECTIONS },
    { name: 'legalStatus', label: 'Pháp lý', type: 'select', options: LEGAL_STATUSES },
    { name: 'furniture', label: 'Nội thất', type: 'select', options: FURNITURE },
    { name: 'parkingAvailability', label: 'Chỗ đậu ô tô', type: 'select', options: YES_NO },
    { name: 'yearBuilt', label: 'Năm xây dựng', type: 'number', min: 1900, max: 2100, step: 1 },
    { name: 'communityAmenities', label: 'Tiện ích xung quanh', type: 'textarea', span: 2, rows: 2, placeholder: 'Gần chợ, trường học, công viên...' },
    { name: 'propertyDescription', label: 'Mô tả chi tiết', type: 'textarea', span: 2, rows: 5 },

    { section: 'Chủ nhà và thông tin nội bộ', hidden: () => !canSeeOwner },
    { name: 'ownerName', label: 'Tên chủ nhà', hidden: () => !canSeeOwner },
    { name: 'ownerPhone', label: 'SĐT chủ nhà', type: 'phone', hidden: () => !canSeeOwner },
    { name: 'listingDate', label: 'Ngày nhận hàng', type: 'date', hidden: () => !canSeeOwner },
    { name: 'contractExpiry', label: 'Hạn HĐ ký gửi / độc quyền', type: 'date', hidden: () => !canSeeOwner },
    { name: 'commissionNote', label: 'Thỏa thuận phí với chủ nhà', span: 2, hidden: () => !canSeeOwner },
    { name: 'internalNotesOrComments', label: 'Ghi chú nội bộ', type: 'textarea', span: 2, rows: 3, hidden: () => !canSeeOwner },
];

const optionalNumber = (label) => yup.number().typeError(`${label} phải là số`).nullable().min(0, `${label} không được âm`);

export const propertySchema = yup.object({
    transactionType: yup.string().required('Chọn hình thức bán hay cho thuê'),
    propertyType: yup.string().required('Chọn loại bất động sản'),
    price: optionalNumber('Giá'),
    commissionRate: optionalNumber('Phí môi giới').max(100, 'Phí môi giới tối đa 100%'),
    area: optionalNumber('Diện tích'),
    usableArea: optionalNumber('Diện tích sử dụng'),
    width: optionalNumber('Chiều ngang'),
    length: optionalNumber('Chiều dài'),
    roadWidth: optionalNumber('Độ rộng đường'),
    floors: optionalNumber('Số tầng').integer('Số tầng phải là số nguyên'),
    numberofBedrooms: optionalNumber('Số phòng ngủ').integer('Số phòng ngủ phải là số nguyên'),
    numberofBathrooms: optionalNumber('Số phòng tắm').integer('Số phòng tắm phải là số nguyên'),
    yearBuilt: yup.number().typeError('Năm xây dựng phải là số').nullable().integer('Năm không hợp lệ').min(1900, 'Năm không hợp lệ').max(2100, 'Năm không hợp lệ'),
    mapUrl: yup.string().nullable().url('Link không hợp lệ (bắt đầu bằng https://)'),
    ownerPhone: yup.string().nullable().test('phone', 'Số điện thoại không hợp lệ', (value) => !value || isValidPhone(value)),
});

// Form values of a property; older records are adapted (address in one field,
// price and area as text, English status codes)
export const propertyInitialValues = (property = {}) => {
    const values = Object.fromEntries(FIELD_NAMES.map((name) => [name, property[name] ?? (NUMBER_FIELDS.includes(name) ? null : '')]));
    if (!property.street && !property.ward && !property.province && property.propertyAddress) {
        values.street = property.propertyAddress;
    }
    if (values.price === null && toNumber(property.listingPrice)) values.price = toNumber(property.listingPrice);
    if (values.area === null && toNumber(property.squareFootage)) values.area = toNumber(property.squareFootage);
    values.listingStatus = LEGACY_STATUS[values.listingStatus] || values.listingStatus || 'available';
    DATE_FIELDS.forEach((name) => { values[name] = toDateInput(property[name]); });
    if (!values.transactionType) values.transactionType = 'sale';
    return values;
};

// Payload sent to the API: empty dates are cleared, the owner phone normalized
export const propertyPayload = (values, { canSeeOwner = true } = {}) => {
    const payload = { ...values };
    DATE_FIELDS.forEach((name) => { payload[name] = payload[name] || null; });
    payload.ownerPhone = normalizePhone(payload.ownerPhone);
    if (!canSeeOwner) {
        ['ownerName', 'ownerPhone', 'contractExpiry', 'listingDate', 'commissionNote', 'internalNotesOrComments'].forEach((name) => delete payload[name]);
    }
    return payload;
};
