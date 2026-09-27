// Vietnamese phone numbers are stored in their national form (0901234567):
// spaces, dots, dashes and brackets are dropped and the +84 / 84 prefix becomes 0.
// Numbers saved as numbers by older versions lost their leading 0, it is put back
// for mobile (9 digits) and landline (10 digits starting with 2) numbers.
// Foreign numbers keep their + prefix.
const normalizePhone = (value) => {
    if (value === undefined || value === null) return value;
    const raw = String(value).trim();
    if (raw === '') return '';
    const hasPlus = raw.startsWith('+') || raw.startsWith('00');
    let digits = raw.replace(/\D/g, '');
    if (raw.startsWith('00')) digits = digits.slice(2);
    if (digits === '') return '';

    if (digits.startsWith('84') && (hasPlus || digits.length === 11)) {
        return `0${digits.slice(2).replace(/^0/, '')}`;
    }
    if (hasPlus) return `+${digits}`;
    if (!digits.startsWith('0') && ((digits.length === 9 && /^[35789]/.test(digits)) || (digits.length === 10 && digits.startsWith('2')))) {
        return `0${digits}`;
    }
    return digits;
};

// Mobile (0901234567) and landline (02838123456) numbers, or an international number
const isValidPhone = (value) => /^0\d{9,10}$/.test(value) || /^\+\d{8,15}$/.test(value);

// Query parts matching every stored form of a number: normalized, with spaces or
// dots, +84 / 84 prefixes, and the numbers without leading 0 of older versions
const phoneMatchers = (normalized) => {
    if (!normalized) return null;
    const international = normalized.startsWith('+');
    const significant = international ? normalized.slice(1) : normalized.replace(/^0/, '');
    if (!significant) return null;
    const separated = significant.split('').join('\\D*');
    const pattern = international
        ? `^\\D*${separated}\\D*$`
        : `^\\D*(?:84\\D*|0\\D*)?${separated}\\D*$`;
    const numbers = [];
    const asNumber = Number(significant);
    if (Number.isSafeInteger(asNumber)) numbers.push(asNumber);
    if (!international && Number.isSafeInteger(Number(`84${significant}`))) numbers.push(Number(`84${significant}`));
    return { regex: new RegExp(pattern), numbers };
};

// Mongo filter matching any of the fields against the number (use it with the
// native collection: mongoose would cast the legacy numeric values to strings)
const phoneFilter = (fields, normalized) => {
    const matchers = phoneMatchers(normalized);
    if (!matchers) return null;
    return {
        $or: fields.flatMap((field) => [
            { [field]: { $regex: matchers.regex } },
            ...(matchers.numbers.length ? [{ [field]: { $in: matchers.numbers } }] : []),
        ]),
    };
};

module.exports = { normalizePhone, isValidPhone, phoneMatchers, phoneFilter };
