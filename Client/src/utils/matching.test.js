import { matchProperties } from './matching';

const listings = [
    { _id: '1', transactionType: 'sale', propertyType: 'apartment', price: 3000000000, ward: 'Phường Thủ Đức', province: 'TP. Hồ Chí Minh', listingStatus: 'available', createdDate: '2026-09-01' },
    { _id: '2', transactionType: 'sale', propertyType: 'apartment', price: 3200000000, oldAddress: 'Quận 9', listingStatus: 'active', createdDate: '2026-09-02' },
    { _id: '3', transactionType: 'rent', propertyType: 'apartment', price: 12000000, ward: 'Thủ Đức', listingStatus: 'available' },
    { _id: '4', transactionType: 'sale', propertyType: 'townhouse', price: 3000000000, ward: 'Thủ Đức', listingStatus: 'available' },
    { _id: '5', transactionType: 'sale', propertyType: 'apartment', price: 9000000000, ward: 'Thủ Đức', listingStatus: 'available' },
    { _id: '6', transactionType: 'sale', propertyType: 'apartment', price: 3000000000, ward: 'Thủ Đức', listingStatus: 'sold' },
];

test('keeps the available listings matching the needs, best first', () => {
    const customer = { customerType: 'buyer', interestedPropertyType: 'apartment', budgetFrom: 2800000000, budgetTo: 3500000000, interestedArea: 'Thu Duc, Quận 9' };
    const result = matchProperties(customer, listings);
    expect(result.map((r) => r.property._id)).toEqual(['2', '1']);
    expect(result[0].reasons).toEqual(['Đúng loại BĐS', 'Trong ngân sách', 'Đúng khu vực']);
});

test('renters get rentals, customers without needs get every available listing', () => {
    expect(matchProperties({ customerType: 'renter' }, listings).map((r) => r.property._id)).toEqual(['3']);
    expect(matchProperties({}, listings)).toHaveLength(5);
    expect(matchProperties({}, listings, { exclude: ['1', '2'], limit: 2 })).toHaveLength(2);
    expect(matchProperties(null, listings)).toEqual([]);
});
