import { budgetText, contactInitialValues, contactPayload, contactSchema } from './contactFields';

const valid = { fullName: 'Nguyễn Văn An', phoneNumber: '0901 234 567' };

test('requires a name and a valid Vietnamese phone number', async () => {
    await expect(contactSchema.validate(valid)).resolves.toBeTruthy();
    await expect(contactSchema.validate({ ...valid, fullName: ' ' })).rejects.toThrow('Vui lòng nhập họ và tên');
    await expect(contactSchema.validate({ ...valid, phoneNumber: '' })).rejects.toThrow('Vui lòng nhập số điện thoại');
    await expect(contactSchema.validate({ ...valid, phoneNumber: '12345' })).rejects.toThrow('Số điện thoại không hợp lệ');
    await expect(contactSchema.validate({ ...valid, phoneNumber: '+84 901 234 567' })).resolves.toBeTruthy();
    await expect(contactSchema.validate({ ...valid, email: 'not-an-email' })).rejects.toThrow('Email không hợp lệ');
    await expect(contactSchema.validate({ ...valid, budgetFrom: 5000000000, budgetTo: 3000000000 })).rejects.toThrow('Ngân sách từ');
});

test('adapts contacts of older versions to the form', () => {
    const values = contactInitialValues({
        firstName: 'John', lastName: 'Doe', phoneNumber: 901234567, leadStatus: 'qualifiedLead',
        tagsOrLabelsForcategorizingcontacts: 'homeBuyer', gender: 'Male', leadRating: 4, birthday: '1990-05-01T00:00:00.000Z',
    });
    expect(values).toMatchObject({
        fullName: 'John Doe', phoneNumber: '0901234567', leadStatus: 'consulting', customerType: 'buyer', gender: 'male', leadRating: '4',
    });
    expect(values.birthday).toMatch(/^1990-05-0[12]$/);
    expect(contactInitialValues().leadStatus).toBe('new');
});

test('sends normalized values', () => {
    const payload = contactPayload({ ...contactInitialValues(), ...valid, mobileNumber: '84912345678', leadRating: '5' });
    expect(payload).toMatchObject({ phoneNumber: '0901234567', mobileNumber: '0912345678', leadRating: 5, birthday: null });
});

test('shows budgets the way agents say them', () => {
    expect(budgetText({ budgetFrom: 3000000000, budgetTo: 4500000000 })).toBe('3 tỷ – 4,5 tỷ');
    expect(budgetText({ budgetTo: 800000000 })).toBe('≤ 800 triệu');
    expect(budgetText({ budgetFrom: 2000000000 })).toBe('≥ 2 tỷ');
    expect(budgetText({})).toBe('');
});
