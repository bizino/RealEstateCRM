import { displayName, formatPhone, formatPriceShort, propertyAddress, propertyName, searchText, userName } from './format';

// Code of an option from what users wrote in a file: the label ("Mua", "Đã dẫn
// xem") or the code itself, ignoring accents and case; unknown text is kept
export const matchOption = (options, text) => {
    const wanted = searchText(text);
    if (!wanted) return '';
    const option = options.find((o) => searchText(o.label) === wanted || searchText(o.value) === wanted);
    return option ? option.value : String(text).trim();
};

// Options of the pickers (SearchSelect)
export const contactOptions = (contacts = []) => contacts.map((contact) => ({
    value: contact._id,
    label: displayName(contact) || formatPhone(contact.phoneNumber) || '(không tên)',
    description: [formatPhone(contact.phoneNumber), contact.email].filter(Boolean).join(' · '),
}));

export const leadOptions = (leads = []) => leads.map((lead) => ({
    value: lead._id,
    label: lead.leadName || formatPhone(lead.leadPhoneNumber) || '(không tên)',
    description: [formatPhone(lead.leadPhoneNumber), lead.leadEmail].filter(Boolean).join(' · '),
}));

export const propertyOptions = (properties = []) => properties.map((property) => ({
    value: property._id,
    label: propertyName(property) || '(chưa có tên)',
    description: [formatPriceShort(property.price ?? property.listingPrice, { rent: property.transactionType === 'rent', empty: '' }), propertyAddress(property)].filter(Boolean).join(' · '),
}));

export const userOptions = (users = []) => users.map((user) => ({
    value: user._id,
    label: userName(user),
    description: user.username,
}));
