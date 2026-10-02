import { followUpState, leadInitialValues, leadPayload, leadSchema } from './leadFields';

test('requires a name and a valid phone number', async () => {
    await expect(leadSchema.validate({ leadName: 'Bình', leadPhoneNumber: '0912 345 678' })).resolves.toBeTruthy();
    await expect(leadSchema.validate({ leadName: '', leadPhoneNumber: '0912345678' })).rejects.toThrow('Vui lòng nhập họ và tên');
    await expect(leadSchema.validate({ leadName: 'Bình', leadPhoneNumber: '' })).rejects.toThrow('Vui lòng nhập số điện thoại');
    await expect(leadSchema.validate({ leadName: 'Bình', leadPhoneNumber: '0912' })).rejects.toThrow('Số điện thoại không hợp lệ');
});

test('prepares the form and the payload', () => {
    expect(leadInitialValues({ leadPhoneNumber: 912345678 })).toMatchObject({ leadPhoneNumber: '0912345678', leadStatus: 'new', budgetFrom: null });
    expect(leadPayload({ ...leadInitialValues(), leadPhoneNumber: '+84912345678' })).toMatchObject({ leadPhoneNumber: '0912345678', leadFollowUpDate: null });
});

test('follow-up states', () => {
    const today = new Date();
    const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    expect(followUpState({ leadFollowUpDate: iso(yesterday) })).toBe('overdue');
    expect(followUpState({ leadFollowUpDate: iso(today) })).toBe('today');
    expect(followUpState({ leadFollowUpDate: iso(tomorrow) })).toBe('upcoming');
    expect(followUpState({})).toBe('none');
    expect(followUpState({ leadFollowUpDate: iso(yesterday), leadStatus: 'converted' })).toBe('none');
});
