const { normalizePhone, isValidPhone, phoneMatchers } = require('../utils/phone');
const { splitFullName, withFullName, displayName } = require('../utils/names');

describe('normalizePhone', () => {
    test.each([
        ['0901234567', '0901234567'],
        ['090 123 4567', '0901234567'],
        ['090.123.4567', '0901234567'],
        ['(090) 123-4567', '0901234567'],
        ['+84 901 234 567', '0901234567'],
        ['+84 (0) 901 234 567', '0901234567'],
        ['84901234567', '0901234567'],
        ['0084901234567', '0901234567'],
        [901234567, '0901234567'],
        ['2838123456', '02838123456'],
        ['02838123456', '02838123456'],
        ['+1 415 555 0100', '+14155550100'],
        ['', ''],
    ])('%p -> %p', (input, expected) => {
        expect(normalizePhone(input)).toBe(expected);
    });

    test('keeps missing values', () => {
        expect(normalizePhone(undefined)).toBeUndefined();
        expect(normalizePhone(null)).toBeNull();
    });
});

describe('isValidPhone', () => {
    test('accepts mobile, landline and international numbers', () => {
        ['0901234567', '02838123456', '+14155550100'].forEach((phone) => expect(isValidPhone(phone)).toBe(true));
    });

    test('rejects short, long or local numbers without 0', () => {
        ['090123', '090123456789', '901234567', 'abc', ''].forEach((phone) => expect(isValidPhone(phone)).toBe(false));
    });
});

describe('phoneMatchers', () => {
    test('match every stored form of a number', () => {
        const { regex, numbers } = phoneMatchers('0901234567');
        ['0901234567', '090 123 4567', '+84901234567', '84 901 234 567', '901234567'].forEach((stored) => expect(regex.test(stored)).toBe(true));
        ['0901234568', '09012345678', '0987654321'].forEach((stored) => expect(regex.test(stored)).toBe(false));
        expect(numbers).toEqual([901234567, 84901234567]);
    });

    test('return null without a number', () => {
        expect(phoneMatchers('')).toBeNull();
        expect(phoneMatchers(undefined)).toBeNull();
    });
});

describe('Vietnamese names', () => {
    test('split the family name and the given name', () => {
        expect(splitFullName('Nguyễn Văn An')).toEqual({ lastName: 'Nguyễn Văn', firstName: 'An' });
        expect(splitFullName('  Trần   Thị  Bích Ngọc ')).toEqual({ lastName: 'Trần Thị Bích', firstName: 'Ngọc' });
        expect(splitFullName('An')).toEqual({ lastName: '', firstName: 'An' });
        expect(splitFullName('')).toEqual({ lastName: '', firstName: '' });
    });

    test('withFullName only changes data holding a full name', () => {
        expect(withFullName({ fullName: ' Lê  Minh ', email: 'x' })).toEqual({ fullName: 'Lê Minh', firstName: 'Minh', lastName: 'Lê', email: 'x' });
        expect(withFullName({ firstName: 'John' })).toEqual({ firstName: 'John' });
    });

    test('displayName prefers the full name', () => {
        expect(displayName({ fullName: 'Nguyễn Văn An', firstName: 'An', lastName: 'Nguyễn Văn' })).toBe('Nguyễn Văn An');
        expect(displayName({ firstName: 'John', lastName: 'Doe' })).toBe('John Doe');
        expect(displayName({ firstName: 'John' })).toBe('John');
        expect(displayName(null)).toBe('');
    });
});

describe('decodeFileName', () => {
    const { decodeFileName } = require('../utils/upload');

    test('repairs UTF-8 names read as latin1 by multer', () => {
        const garbled = Buffer.from('Sổ hồng.pdf', 'utf8').toString('latin1');
        expect(decodeFileName(garbled)).toBe('Sổ hồng.pdf');
        expect(decodeFileName('plain-name.pdf')).toBe('plain-name.pdf');
    });

    test('keeps names that were not UTF-8', () => {
        expect(decodeFileName('café.pdf')).toBe('café.pdf');
    });
});
