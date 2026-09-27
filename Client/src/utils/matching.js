import { propertyAddress, searchText, toNumber } from './format';

const LEGACY_STATUS = { active: 'available', pending: 'deposited' };
const SALE_NEEDS = ['buyer', 'investor'];
const RENT_NEEDS = ['renter'];

// Available listings matching the needs of a customer, best first: kind of
// transaction, type of property, budget (±10%) and area (words of
// "Khu vực quan tâm" found in the address, old district or project)
export const matchProperties = (customer, properties = [], { limit = 10, exclude = [] } = {}) => {
    if (!customer) return [];
    const need = customer.customerType;
    const from = toNumber(customer.budgetFrom);
    const to = toNumber(customer.budgetTo);
    const areas = String(customer.interestedArea || '')
        .split(/[,;/]| và /)
        .map(searchText)
        .filter((area) => area.length > 1);
    const excluded = new Set(exclude.map(String));

    return properties
        .filter((property) => !excluded.has(String(property._id)))
        .filter((property) => (LEGACY_STATUS[property.listingStatus] || property.listingStatus || 'available') === 'available')
        .map((property) => {
            const rent = property.transactionType === 'rent';
            if ((SALE_NEEDS.includes(need) && rent) || (RENT_NEEDS.includes(need) && !rent)) return null;
            let score = 0;
            const reasons = [];
            if (customer.interestedPropertyType) {
                if (property.propertyType !== customer.interestedPropertyType) return null;
                score += 3;
                reasons.push('Đúng loại BĐS');
            }
            const price = property.price ?? toNumber(property.listingPrice);
            if ((from || to) && price) {
                if ((to && price > to * 1.1) || (from && price < from * 0.9)) return null;
                score += 3;
                reasons.push('Trong ngân sách');
            }
            if (areas.length) {
                const text = searchText([propertyAddress(property), property.oldAddress, property.projectName, property.title].join(' '));
                const found = areas.filter((area) => text.includes(area));
                if (!found.length) return null;
                score += 2 * found.length;
                reasons.push('Đúng khu vực');
            }
            return { property, score, reasons };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score || (b.property.createdDate || '').localeCompare(a.property.createdDate || ''))
        .slice(0, limit);
};
