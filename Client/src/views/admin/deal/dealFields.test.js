import { commissionTotal, computedCommission, dealInitialValues, dealPayload, dealSchema } from './dealFields';

test('computes the commission from the rate unless an amount is given', () => {
    expect(computedCommission({ price: 3000000000, commissionRate: 1.5 })).toBe(45000000);
    expect(computedCommission({ price: 3000000000 })).toBeNull();
    expect(commissionTotal({ price: 3000000000, commissionRate: 1, commissionAmount: 20000000 })).toBe(20000000);
    expect(commissionTotal({})).toBe(0);
});

test('validates the deal', async () => {
    const valid = { dealType: 'sale', status: 'deposit', contact: 'c1', commissionSplits: [], payments: [] };
    await expect(dealSchema.validate(valid)).resolves.toBeTruthy();
    await expect(dealSchema.validate({ ...valid, contact: '' })).rejects.toThrow('Chọn khách hàng');
    await expect(dealSchema.validate({ ...valid, status: 'cancelled' })).rejects.toThrow('Nhập lý do hủy');
    await expect(dealSchema.validate({ ...valid, commissionSplits: [{ user: 'u1', percent: 70 }, { user: 'u2', percent: 40 }] })).rejects.toThrow('vượt quá 100%');
    // rows without employee are ignored
    await expect(dealSchema.validate({ ...valid, commissionSplits: [{ user: 'u1', percent: 70 }, { user: '', percent: 40 }] })).resolves.toBeTruthy();
});

test('prefills a new deal and reads an existing one', () => {
    expect(dealInitialValues(undefined, { contact: 'c1', property: 'p1', price: 100 })).toMatchObject({ contact: 'c1', property: 'p1', price: 100, status: 'negotiating', dealType: 'sale' });
    const values = dealInitialValues({
        contact: { _id: 'c1', fullName: 'An' }, property: { _id: 'p1' }, depositDate: '2026-09-10T03:00:00.000Z',
        commissionSplits: [{ user: { _id: 'u1' }, role: 'listing', percent: 40, amount: 1 }],
        payments: [{ name: 'Đợt 1', amount: 5, dueDate: '2026-10-01T00:00:00.000Z' }],
    });
    expect(values).toMatchObject({ contact: 'c1', property: 'p1', commissionSplits: [{ user: 'u1', role: 'listing', percent: 40 }] });
    expect(values.depositDate).toMatch(/^2026-09-1[01]$/);
    expect(values.payments[0]).toMatchObject({ name: 'Đợt 1', amount: 5, paidDate: '' });
});

test('builds the payload: empty rows and dates dropped, owner only for admins creating', () => {
    const values = {
        ...dealInitialValues(), contact: 'c1', createBy: 'u9', status: 'deposit', cancelReason: 'old reason',
        payments: [{ name: '', amount: null, dueDate: '', paidDate: '', note: '' }, { name: 'Đợt 1', amount: 10, dueDate: '2026-10-01', paidDate: '', note: '' }],
        commissionSplits: [{ user: '', role: 'selling', percent: 10 }, { user: 'u1', role: 'selling', percent: null }],
    };
    const payload = dealPayload(values, { isAdmin: true, isEdit: false });
    expect(payload.payments).toEqual([{ name: 'Đợt 1', amount: 10, dueDate: '2026-10-01', paidDate: null, note: '' }]);
    expect(payload.commissionSplits).toEqual([{ user: 'u1', role: 'selling', percent: 0 }]);
    expect(payload).toMatchObject({ createBy: 'u9', property: null, depositDate: null, cancelReason: '' });
    expect(dealPayload(values, { isAdmin: false, isEdit: false })).not.toHaveProperty('createBy');
    expect(dealPayload(values, { isAdmin: true, isEdit: true })).not.toHaveProperty('createBy');
});
