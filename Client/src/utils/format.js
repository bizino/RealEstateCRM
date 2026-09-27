// Vietnamese formats: 3.500.000.000 ₫, "3,5 tỷ", 80 m², dd/MM/yyyy, 0901 234 567

const isBlank = (value) => value === undefined || value === null || value === '';

export const toNumber = (value) => {
    if (isBlank(value)) return null;
    const number = typeof value === 'number' ? value : Number(String(value).replace(/[^\d.-]/g, ''));
    return Number.isFinite(number) ? number : null;
};

const decimal = (value, digits) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);

// 3500000000 -> "3.500.000.000"
export const formatNumber = (value, digits = 2) => {
    const number = toNumber(value);
    return number === null ? '' : decimal(number, digits);
};

// 3500000000 -> "3.500.000.000 ₫"
export const formatMoney = (value) => {
    const number = toNumber(value);
    return number === null ? '' : `${decimal(Math.round(number), 0)} ₫`;
};

// Amounts as Vietnamese agents say them: "3,5 tỷ", "850 triệu", "15 triệu/tháng"
export const formatPriceShort = (value, { rent = false, empty = 'Thỏa thuận' } = {}) => {
    const number = toNumber(value);
    if (!number) return empty;
    const suffix = rent ? '/tháng' : '';
    const abs = Math.abs(number);
    if (abs >= 1e9) return `${decimal(number / 1e9, 2)} tỷ${suffix}`;
    if (abs >= 1e6) return `${decimal(number / 1e6, 1)} triệu${suffix}`;
    if (abs >= 1e3) return `${decimal(number / 1e3, 0)} nghìn${suffix}`;
    return `${decimal(number, 0)} đ${suffix}`;
};

// Price of one square meter: "58,3 triệu/m²"
export const formatPricePerM2 = (price, area) => {
    const p = toNumber(price);
    const a = toNumber(area);
    if (!p || !a) return '';
    return `${formatPriceShort(p / a)}/m²`;
};

export const formatArea = (value) => {
    const number = toNumber(value);
    return number === null ? '' : `${decimal(number, 2)} m²`;
};

// Reads what a user typed in a money field ("3.500.000.000", "3500000000 đ")
export const parseMoneyInput = (text) => {
    const digits = String(text ?? '').replace(/\D/g, '');
    return digits === '' ? null : Number(digits);
};

// Amounts written in files: "3,5 tỷ", "1 tỷ 250", "1 tỷ 2" (1,2 tỷ), "800 triệu",
// "800tr", "15 triệu/tháng", "500k", "3.500.000.000", "3500000000 đ"
export const parseMoneyText = (text) => {
    if (typeof text === 'number') return Number.isFinite(text) ? text : null;
    const value = removeDiacritics(text).toLowerCase().trim();
    if (!value) return null;
    const decimalOf = (digits) => Number(digits.replace(',', '.'));
    const billion = /^(\d+(?:[.,]\d+)?)\s*(?:ty|t)(?![a-z])\s*(?:(\d{1,3})\s*(trieu|tr)?)?/.exec(value);
    if (billion) {
        let amount = decimalOf(billion[1]) * 1e9;
        // "1 tỷ 2" is 1,2 tỷ, "1 tỷ 25" 1,25 tỷ, "1 tỷ 250 triệu" 1,25 tỷ
        if (billion[2]) amount += Number(billion[3] ? billion[2] : billion[2].padEnd(3, '0')) * 1e6;
        return Math.round(amount);
    }
    const million = /^(\d+(?:[.,]\d+)?)\s*(?:trieu|tr)(?![a-z])/.exec(value);
    if (million) return Math.round(decimalOf(million[1]) * 1e6);
    const thousand = /^(\d+(?:[.,]\d+)?)\s*(?:nghin|ngan|k)(?![a-z])/.exec(value);
    if (thousand) return Math.round(decimalOf(thousand[1]) * 1e3);
    return parseMoneyInput(value);
};

// Date-only values ("2026-09-27") are local dates, not UTC midnight
const toDate = (value) => {
    if (isBlank(value)) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const text = String(value);
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
};

const pad = (number) => String(number).padStart(2, '0');

export const formatDate = (value) => {
    const date = toDate(value);
    return date ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}` : '';
};

export const formatTime = (value) => {
    const date = toDate(value);
    return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : '';
};

// Values of <input type="date"> without time are shown without time
export const formatDateTime = (value) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
    const date = toDate(value);
    return date ? `${formatDate(date)} ${formatTime(date)}` : '';
};

// Value for <input type="date">
export const toDateInput = (value) => {
    const date = toDate(value);
    return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : '';
};

// Value for <input type="datetime-local">
export const toDateTimeInput = (value) => {
    const date = toDate(value);
    return date ? `${toDateInput(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}` : '';
};

export const isSameDay = (a, b) => {
    const x = toDate(a);
    const y = toDate(b);
    return Boolean(x && y && x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate());
};

export const parseDate = toDate;

// Same rules as the API: national form, +84 / 84 / 0084 prefixes become 0
export const normalizePhone = (value) => {
    if (isBlank(value)) return '';
    const raw = String(value).trim();
    const international = raw.startsWith('+') || raw.startsWith('00');
    let digits = raw.replace(/\D/g, '');
    if (raw.startsWith('00')) digits = digits.slice(2);
    if (digits === '') return '';
    if (digits.startsWith('84') && (international || digits.length === 11)) return `0${digits.slice(2).replace(/^0/, '')}`;
    if (international) return `+${digits}`;
    if (!digits.startsWith('0') && ((digits.length === 9 && /^[35789]/.test(digits)) || (digits.length === 10 && digits.startsWith('2')))) {
        return `0${digits}`;
    }
    return digits;
};

export const isValidPhone = (value) => {
    const phone = normalizePhone(value);
    return /^0\d{9,10}$/.test(phone) || /^\+\d{8,15}$/.test(phone);
};

// "0901 234 567", landlines "028 3812 3456"
export const formatPhone = (value) => {
    const phone = normalizePhone(value);
    if (/^0\d{9}$/.test(phone)) return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
    if (/^0\d{10}$/.test(phone)) return `${phone.slice(0, 3)} ${phone.slice(3, 7)} ${phone.slice(7)}`;
    return phone || (isBlank(value) ? '' : String(value));
};

export const telLink = (value) => {
    const phone = normalizePhone(value);
    return phone ? `tel:${phone}` : '';
};

// Zalo chat of a phone number, or the Zalo link / id stored for the customer
export const zaloLink = (value) => {
    if (isBlank(value)) return '';
    const text = String(value).trim();
    if (/^[\d\s.+()-]+$/.test(text)) {
        const phone = normalizePhone(text);
        return phone ? `https://zalo.me/${phone.replace(/^\+/, '')}` : '';
    }
    if (/^https?:\/\//i.test(text)) return text;
    if (/^zalo\.me\//i.test(text)) return `https://${text}`;
    return `https://zalo.me/${encodeURIComponent(text)}`;
};

// "Nguyễn Văn Ân" -> "nguyen van an", for searches ignoring accents
export const removeDiacritics = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

export const searchText = (value) => removeDiacritics(value).toLowerCase().replace(/\s+/g, ' ').trim();

// Contacts and users: full name, else the first / last names of older versions
export const displayName = (person) => {
    if (!person) return '';
    if (person.fullName) return person.fullName;
    return [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
};

export const userName = (user) => displayName(user) || user?.username || '';

// Address of a property from its parts, or the address of older versions
export const propertyAddress = (property) => {
    if (!property) return '';
    const parts = [property.street, property.ward, property.province].filter(Boolean);
    return parts.length ? parts.join(', ') : (property.propertyAddress || '');
};

// Short name of a property for lists and pickers: "BDS00012 · Căn hộ 2PN Q7"
export const propertyName = (property) => {
    if (!property) return '';
    const name = property.title || propertyAddress(property) || property.propertyType || '';
    return [property.code, name].filter(Boolean).join(' · ');
};
