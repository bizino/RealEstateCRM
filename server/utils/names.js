// Vietnamese names are written family name first: "Nguyễn Văn An" is stored as
// fullName, with lastName "Nguyễn Văn" and firstName "An" (the given name, used
// to sort) for the parts of the application that still read the two fields.
const cleanName = (value) => String(value).trim().replace(/\s+/g, ' ');

const splitFullName = (fullName) => {
    const parts = cleanName(fullName).split(' ').filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '' };
    return { firstName: parts[parts.length - 1], lastName: parts.slice(0, -1).join(' ') };
};

// Fills firstName / lastName from fullName when the client sends a full name
const withFullName = (data) => {
    if (typeof data?.fullName !== 'string') return data;
    const fullName = cleanName(data.fullName);
    return { ...data, fullName, ...splitFullName(fullName) };
};

// Display name of a person document in an aggregation: fullName, else the old
// "firstName lastName" pair (records created before fullName existed)
const nameExpr = (prefix) => {
    const fullName = { $ifNull: [`${prefix}.fullName`, ''] };
    return {
        $cond: [
            { $gt: [{ $strLenCP: fullName }, 0] },
            fullName,
            {
                $trim: {
                    input: {
                        $concat: [
                            { $ifNull: [`${prefix}.firstName`, ''] },
                            ' ',
                            { $ifNull: [`${prefix}.lastName`, ''] },
                        ],
                    },
                },
            },
        ],
    };
};

// Display name of a document already loaded: same rules as nameExpr
const displayName = (person) => {
    if (!person) return '';
    if (person.fullName) return person.fullName;
    return [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
};

module.exports = { splitFullName, withFullName, nameExpr, displayName, cleanName };
