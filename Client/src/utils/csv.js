import { searchText } from './format';

// CSV files opened by Excel: UTF-8 with a byte order mark (or Vietnamese is
// garbled), fields quoted when needed
const BOM = '﻿';

const escapeField = (value) => {
    const text = value === undefined || value === null ? '' : String(value);
    return /[",;\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// columns: [{ header, value: (row) => any }]
export const toCSV = (rows, columns) => {
    const lines = [
        columns.map((column) => escapeField(column.header)).join(','),
        ...rows.map((row) => columns.map((column) => escapeField(column.value(row))).join(',')),
    ];
    return BOM + lines.join('\r\n');
};

export const downloadFile = (fileName, content, type = 'text/csv;charset=utf-8') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Excel with Vietnamese regional settings saves CSV files with ";"
const detectDelimiter = (text) => {
    const firstLine = text.split(/\r?\n/, 1)[0] || '';
    const counts = [',', ';', '\t'].map((delimiter) => {
        let count = 0;
        let quoted = false;
        for (const char of firstLine) {
            if (char === '"') quoted = !quoted;
            else if (char === delimiter && !quoted) count += 1;
        }
        return { delimiter, count };
    });
    return counts.sort((a, b) => b.count - a.count)[0].count > 0 ? counts[0].delimiter : ',';
};

// RFC 4180 parser: quoted fields, escaped quotes, line breaks inside quotes
export const parseCSV = (input) => {
    const text = String(input ?? '').replace(/^﻿/, '');
    const delimiter = detectDelimiter(text);
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (quoted) {
            if (char === '"' && text[i + 1] === '"') {
                field += '"';
                i += 1;
            } else if (char === '"') {
                quoted = false;
            } else {
                field += char;
            }
        } else if (char === '"') {
            quoted = true;
        } else if (char === delimiter) {
            row.push(field);
            field = '';
        } else if (char === '\n' || char === '\r') {
            if (char === '\r' && text[i + 1] === '\n') i += 1;
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += char;
        }
    }
    if (field !== '' || row.length) {
        row.push(field);
        rows.push(row);
    }
    // Excel adds empty lines at the end
    return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
};

// Turns the rows of a file into records. fields: [{ key, aliases: [...] }], the
// headers are matched without accents nor case ("Số điện thoại" = "so dien thoai").
export const rowsToRecords = (rows, fields) => {
    if (!rows.length) return { records: [], columns: [] };
    const [headers, ...lines] = rows;
    const columns = headers.map((header) => {
        const normalized = searchText(header);
        const field = fields.find((f) => [f.key, f.label, ...(f.aliases || [])].some((alias) => alias && searchText(alias) === normalized));
        return field ? field.key : null;
    });
    const records = lines.map((cells) => {
        const record = {};
        columns.forEach((key, index) => {
            const value = (cells[index] ?? '').trim();
            if (key && value !== '') record[key] = value;
        });
        return record;
    });
    return { records, columns };
};
