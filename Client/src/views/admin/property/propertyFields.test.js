import { propertyInitialValues, propertyPayload, propertySchema } from './propertyFields';

test('validates the listing', async () => {
    await expect(propertySchema.validate({ transactionType: 'sale', propertyType: 'townhouse', price: 8500000000 })).resolves.toBeTruthy();
    await expect(propertySchema.validate({ transactionType: '', propertyType: 'townhouse' })).rejects.toThrow('Chọn hình thức');
    await expect(propertySchema.validate({ transactionType: 'sale', propertyType: 'land', area: -5 })).rejects.toThrow('Diện tích không được âm');
    await expect(propertySchema.validate({ transactionType: 'sale', propertyType: 'land', commissionRate: 120 })).rejects.toThrow('tối đa 100%');
    await expect(propertySchema.validate({ transactionType: 'sale', propertyType: 'land', ownerPhone: '123' })).rejects.toThrow('Số điện thoại không hợp lệ');
    await expect(propertySchema.validate({ transactionType: 'sale', propertyType: 'land', mapUrl: 'maps' })).rejects.toThrow('Link không hợp lệ');
});

test('adapts listings of older versions', () => {
    const values = propertyInitialValues({ propertyAddress: '12 Nguyen Hue, HCMC', listingPrice: '3500000000', squareFootage: '80', listingStatus: 'active' });
    expect(values).toMatchObject({ street: '12 Nguyen Hue, HCMC', price: 3500000000, area: 80, listingStatus: 'available', transactionType: 'sale' });
    expect(propertyInitialValues({ listingStatus: 'pending' }).listingStatus).toBe('deposited');
});

test('does not send the owner details a colleague cannot see', () => {
    const values = { ...propertyInitialValues(), transactionType: 'rent', propertyType: 'room', ownerName: 'A', ownerPhone: '+84 903 456 789' };
    expect(propertyPayload(values)).toMatchObject({ ownerName: 'A', ownerPhone: '0903456789', contractExpiry: null, listingDate: null });
    const shared = propertyPayload(values, { canSeeOwner: false });
    expect(shared).not.toHaveProperty('ownerName');
    expect(shared).not.toHaveProperty('ownerPhone');
});
