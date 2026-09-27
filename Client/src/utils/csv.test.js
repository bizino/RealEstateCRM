import { parseCSV, rowsToRecords, toCSV } from './csv';

test('writes CSV files Excel opens with Vietnamese text', () => {
    const csv = toCSV([{ name: 'Nguyễn Văn An', note: 'Cần nhà, gần "chợ"' }], [
        { header: 'Họ và tên', value: (row) => row.name },
        { header: 'Ghi chú', value: (row) => row.note },
    ]);
    expect(csv).toBe('﻿Họ và tên,Ghi chú\r\nNguyễn Văn An,"Cần nhà, gần ""chợ"""');
});

test('reads comma, semicolon (Excel with Vietnamese settings) and quoted fields', () => {
    expect(parseCSV('﻿a,b\r\n1,"x, ""y"""\r\n\r\n')).toEqual([['a', 'b'], ['1', 'x, "y"']]);
    expect(parseCSV('Họ tên;SĐT\nAn;0901234567\n')).toEqual([['Họ tên', 'SĐT'], ['An', '0901234567']]);
    expect(parseCSV('a,b\n"line\nbreak",2')).toEqual([['a', 'b'], ['line\nbreak', '2']]);
});

test('maps Vietnamese headers to fields', () => {
    const fields = [
        { key: 'fullName', label: 'Họ và tên', aliases: ['Họ tên', 'Tên khách hàng'] },
        { key: 'phoneNumber', label: 'Số điện thoại', aliases: ['SĐT', 'Điện thoại'] },
    ];
    const { records, columns } = rowsToRecords([['HO TEN', 'sđt', 'Khác'], [' An ', '0901234567', 'x'], ['', '', '']], fields);
    expect(columns).toEqual(['fullName', 'phoneNumber', null]);
    expect(records).toEqual([{ fullName: 'An', phoneNumber: '0901234567' }, {}]);
});
