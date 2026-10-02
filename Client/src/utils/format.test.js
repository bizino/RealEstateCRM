import {
    displayName, formatArea, formatDate, formatDateTime, formatMoney, formatPhone, formatPriceShort, formatPricePerM2,
    isValidPhone, normalizePhone, parseMoneyInput, parseMoneyText, propertyAddress, propertyName, removeDiacritics,
    searchText, telLink, toDateInput, zaloLink,
} from './format';

describe('money', () => {
    test('formats full amounts in VND', () => {
        expect(formatMoney(3500000000)).toBe('3.500.000.000 ₫');
        expect(formatMoney('')).toBe('');
    });

    test('formats amounts the way agents say them', () => {
        expect(formatPriceShort(3500000000)).toBe('3,5 tỷ');
        expect(formatPriceShort(12000000000)).toBe('12 tỷ');
        expect(formatPriceShort(1250000000)).toBe('1,25 tỷ');
        expect(formatPriceShort(850000000)).toBe('850 triệu');
        expect(formatPriceShort(15500000, { rent: true })).toBe('15,5 triệu/tháng');
        expect(formatPriceShort(500000)).toBe('500 nghìn');
        expect(formatPriceShort(null)).toBe('Thỏa thuận');
        expect(formatPriceShort(0, { empty: '—' })).toBe('—');
    });

    test('computes the price of one square meter', () => {
        expect(formatPricePerM2(3500000000, 60)).toBe('58,3 triệu/m²');
        expect(formatPricePerM2(3500000000, null)).toBe('');
    });

    test('reads amounts typed in inputs and written in files', () => {
        expect(parseMoneyInput('3.500.000.000')).toBe(3500000000);
        expect(parseMoneyInput('')).toBeNull();
        expect(parseMoneyText('3,5 tỷ')).toBe(3500000000);
        expect(parseMoneyText('3.5 ty')).toBe(3500000000);
        expect(parseMoneyText('1 tỷ 2')).toBe(1200000000);
        expect(parseMoneyText('1 tỷ 25')).toBe(1250000000);
        expect(parseMoneyText('1 tỷ 250 triệu')).toBe(1250000000);
        expect(parseMoneyText('800 triệu')).toBe(800000000);
        expect(parseMoneyText('800tr')).toBe(800000000);
        expect(parseMoneyText('15 triệu/tháng')).toBe(15000000);
        expect(parseMoneyText('500k')).toBe(500000);
        expect(parseMoneyText('3.500.000.000')).toBe(3500000000);
        expect(parseMoneyText('3500000000 đ')).toBe(3500000000);
        expect(parseMoneyText('')).toBeNull();
    });
});

describe('dates', () => {
    test('are shown dd/MM/yyyy without shifting date-only values', () => {
        expect(formatDate('2026-09-01')).toBe('01/09/2026');
        expect(formatDateTime('2026-09-01T08:05')).toBe('01/09/2026 08:05');
        expect(formatDateTime('2026-09-01')).toBe('01/09/2026');
        expect(formatDate('')).toBe('');
        expect(formatDate('not a date')).toBe('');
        expect(toDateInput('2026-09-01')).toBe('2026-09-01');
        expect(toDateInput(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
});

describe('phones', () => {
    test('are normalized like the API', () => {
        expect(normalizePhone('+84 901 234 567')).toBe('0901234567');
        expect(normalizePhone('090.123.4567')).toBe('0901234567');
        expect(normalizePhone(901234567)).toBe('0901234567');
        expect(normalizePhone('')).toBe('');
        expect(isValidPhone('0901 234 567')).toBe(true);
        expect(isValidPhone('12345')).toBe(false);
    });

    test('are grouped for reading', () => {
        expect(formatPhone('0901234567')).toBe('0901 234 567');
        expect(formatPhone('02838123456')).toBe('028 3812 3456');
        expect(formatPhone('+14155550100')).toBe('+14155550100');
    });

    test('link to calls and Zalo chats', () => {
        expect(telLink('090 123 4567')).toBe('tel:0901234567');
        expect(zaloLink('0901234567')).toBe('https://zalo.me/0901234567');
        expect(zaloLink('zalo.me/anguyen')).toBe('https://zalo.me/anguyen');
        expect(zaloLink('https://zalo.me/g/abc')).toBe('https://zalo.me/g/abc');
        expect(zaloLink('')).toBe('');
    });
});

describe('texts', () => {
    test('searches ignore Vietnamese accents', () => {
        expect(removeDiacritics('Nguyễn Văn Đạt')).toBe('Nguyen Van Dat');
        expect(searchText('  Hồ   Chí Minh ')).toBe('ho chi minh');
    });

    test('names prefer the full name', () => {
        expect(displayName({ fullName: 'Nguyễn Văn An', firstName: 'An' })).toBe('Nguyễn Văn An');
        expect(displayName({ firstName: 'John', lastName: 'Doe' })).toBe('John Doe');
        expect(displayName(null)).toBe('');
    });

    test('areas and property names', () => {
        expect(formatArea(80.5)).toBe('80,5 m²');
        const property = { code: 'BDS00001', title: 'Nhà phố Q7', street: '12 Nguyễn Thị Thập', ward: 'Tân Hưng', province: 'TP. Hồ Chí Minh' };
        expect(propertyAddress(property)).toBe('12 Nguyễn Thị Thập, Tân Hưng, TP. Hồ Chí Minh');
        expect(propertyAddress({ propertyAddress: 'Old address' })).toBe('Old address');
        expect(propertyName(property)).toBe('BDS00001 · Nhà phố Q7');
    });
});
