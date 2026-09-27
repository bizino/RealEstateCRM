import { DIRECTIONS, FURNITURE, LEGAL_STATUSES, PROPERTY_TYPES, TRANSACTION_TYPES, labelOf } from 'constants/realEstate';
import { formatArea, formatNumber, formatPhone, formatPriceShort, formatPricePerM2, propertyAddress, toNumber, userName } from './format';

// Text of a listing to paste in Zalo / Facebook groups, with the contact of the
// employee posting it (the owner's details are never included)
export const listingText = (property, agent) => {
    const rent = property.transactionType === 'rent';
    const price = property.price ?? toNumber(property.listingPrice);
    const area = property.area ?? toNumber(property.squareFootage);
    const type = labelOf(PROPERTY_TYPES, property.propertyType);
    const lines = [];

    const heading = property.title || [labelOf(TRANSACTION_TYPES, property.transactionType), type].filter(Boolean).join(' ');
    lines.push(`🏠 ${heading.toUpperCase()}`);
    if (property.code) lines.push(`Mã tin: ${property.code}`);
    const address = propertyAddress(property);
    if (address) lines.push(`📍 ${address}${property.oldAddress ? ` (${property.oldAddress} cũ)` : ''}`);
    if (property.projectName) lines.push(`🏙 Dự án: ${property.projectName}`);

    const perM2 = !rent ? formatPricePerM2(price, area) : '';
    lines.push(`💰 Giá: ${formatPriceShort(price, { rent })}${perM2 ? ` (~${perM2})` : ''}`);

    if (area) {
        const size = property.width && property.length ? ` (${formatNumber(property.width)} x ${formatNumber(property.length)} m)` : '';
        lines.push(`📐 Diện tích: ${formatArea(area)}${size}`);
    }
    const rooms = [
        property.floors ? `${property.floors} tầng` : '',
        property.numberofBedrooms ? `${property.numberofBedrooms} phòng ngủ` : '',
        property.numberofBathrooms ? `${property.numberofBathrooms} WC` : '',
    ].filter(Boolean);
    if (rooms.length) lines.push(`🛏 ${rooms.join(' · ')}`);
    if (property.roadWidth) lines.push(`🛣 Đường trước nhà: ${formatNumber(property.roadWidth)} m`);
    if (property.direction) lines.push(`🧭 Hướng: ${labelOf(DIRECTIONS, property.direction)}`);
    if (property.legalStatus) lines.push(`📜 Pháp lý: ${labelOf(LEGAL_STATUSES, property.legalStatus)}`);
    if (property.furniture) lines.push(`🛋 ${labelOf(FURNITURE, property.furniture)}`);
    if (property.propertyDescription) lines.push('', property.propertyDescription.trim());
    if (agent) {
        const phone = formatPhone(agent.phoneNumber);
        lines.push('', `☎️ Liên hệ: ${userName(agent)}${phone ? ` - ${phone}` : ''}`);
    }
    return lines.join('\n');
};
