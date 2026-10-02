// Option lists of the Vietnamese real estate market. `value` is the code stored
// in the database, `label` is what users see. Codes saved by older versions of
// the application are kept with `legacy: true`: they still get a label but are
// not offered in the forms any more.

export const TRANSACTION_TYPES = [
    { value: 'sale', label: 'Bán' },
    { value: 'rent', label: 'Cho thuê' },
];

// Categories of the main Vietnamese listing sites
export const PROPERTY_TYPES = [
    { value: 'apartment', label: 'Căn hộ chung cư' },
    { value: 'miniApartment', label: 'Chung cư mini, căn hộ dịch vụ' },
    { value: 'house', label: 'Nhà riêng (hẻm, ngõ)' },
    { value: 'townhouse', label: 'Nhà mặt phố' },
    { value: 'villa', label: 'Biệt thự, liền kề' },
    { value: 'shophouse', label: 'Shophouse, nhà phố thương mại' },
    { value: 'land', label: 'Đất thổ cư' },
    { value: 'projectLand', label: 'Đất nền dự án' },
    { value: 'farm', label: 'Đất nông nghiệp, trang trại' },
    { value: 'condotel', label: 'Condotel, officetel' },
    { value: 'room', label: 'Nhà trọ, phòng trọ' },
    { value: 'office', label: 'Văn phòng' },
    { value: 'shop', label: 'Mặt bằng, cửa hàng, ki ốt' },
    { value: 'warehouse', label: 'Kho, nhà xưởng' },
    { value: 'other', label: 'Bất động sản khác' },
];

export const LISTING_STATUSES = [
    { value: 'available', label: 'Còn hàng', color: 'green' },
    { value: 'deposited', label: 'Đã đặt cọc', color: 'orange' },
    { value: 'sold', label: 'Đã bán', color: 'red' },
    { value: 'rented', label: 'Đã cho thuê', color: 'purple' },
    { value: 'paused', label: 'Tạm ngưng', color: 'gray' },
    { value: 'active', label: 'Còn hàng', color: 'green', legacy: true },
    { value: 'pending', label: 'Đã đặt cọc', color: 'orange', legacy: true },
];

export const DIRECTIONS = [
    { value: 'east', label: 'Đông' },
    { value: 'west', label: 'Tây' },
    { value: 'south', label: 'Nam' },
    { value: 'north', label: 'Bắc' },
    { value: 'northEast', label: 'Đông Bắc' },
    { value: 'southEast', label: 'Đông Nam' },
    { value: 'northWest', label: 'Tây Bắc' },
    { value: 'southWest', label: 'Tây Nam' },
];

export const LEGAL_STATUSES = [
    { value: 'pinkBook', label: 'Sổ hồng / Sổ đỏ' },
    { value: 'saleContract', label: 'Hợp đồng mua bán' },
    { value: 'waitingBook', label: 'Đang chờ sổ' },
    { value: 'handwritten', label: 'Giấy tay / Vi bằng' },
    { value: 'other', label: 'Khác' },
];

export const FURNITURE = [
    { value: 'full', label: 'Nội thất đầy đủ' },
    { value: 'basic', label: 'Nội thất cơ bản' },
    { value: 'none', label: 'Không nội thất / nhà thô' },
];

// Where the listing comes from
export const SOURCE_TYPES = [
    { value: 'consignment', label: 'Ký gửi' },
    { value: 'exclusive', label: 'Độc quyền' },
    { value: 'project', label: 'Dự án (F1/F2)' },
    { value: 'collected', label: 'Tự khai thác' },
    { value: 'partner', label: 'Hàng đối tác' },
];

export const YES_NO = [
    { value: 'yes', label: 'Có' },
    { value: 'no', label: 'Không' },
];

// Needs of a customer
export const CUSTOMER_TYPES = [
    { value: 'buyer', label: 'Mua' },
    { value: 'renter', label: 'Thuê' },
    { value: 'investor', label: 'Đầu tư' },
    { value: 'seller', label: 'Bán (chủ nhà)' },
    { value: 'landlord', label: 'Cho thuê (chủ nhà)' },
    { value: 'other', label: 'Khác' },
    { value: 'homeBuyer', label: 'Mua', legacy: true },
];

export const LEAD_SOURCES = [
    { value: 'facebook', label: 'Facebook' },
    { value: 'zalo', label: 'Zalo' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'website', label: 'Website / Landing page' },
    { value: 'google', label: 'Google' },
    { value: 'portal', label: 'Trang tin BĐS (Batdongsan, Chợ Tốt...)' },
    { value: 'referral', label: 'Người quen giới thiệu' },
    { value: 'hotline', label: 'Hotline' },
    { value: 'walkIn', label: 'Khách đến văn phòng' },
    { value: 'event', label: 'Sự kiện, mở bán' },
    { value: 'telesale', label: 'Telesale, data' },
    { value: 'signboard', label: 'Bảng rao, tờ rơi' },
    { value: 'other', label: 'Khác' },
    { value: 'referrals', label: 'Người quen giới thiệu', legacy: true },
    { value: 'advertising', label: 'Quảng cáo', legacy: true },
    { value: 'socialMedia', label: 'Mạng xã hội', legacy: true },
    { value: 'eventsAndTradeShows', label: 'Sự kiện, mở bán', legacy: true },
    { value: 'callCentersOrTelemarketing', label: 'Telesale, data', legacy: true },
    { value: 'partnerships', label: 'Đối tác', legacy: true },
    { value: 'directMail', label: 'Thư trực tiếp', legacy: true },
    { value: 'onlineAggregatorsOrComparisonWebsites', label: 'Trang tin BĐS (Batdongsan, Chợ Tốt...)', legacy: true },
    { value: 'contentMarketing', label: 'Nội dung marketing', legacy: true },
];

// Customer care pipeline of a contact
export const CONTACT_STATUSES = [
    { value: 'new', label: 'Mới', color: 'blue' },
    { value: 'consulting', label: 'Đang tư vấn', color: 'cyan' },
    { value: 'viewing', label: 'Đã dẫn xem', color: 'teal' },
    { value: 'negotiating', label: 'Đang thương lượng', color: 'orange' },
    { value: 'deposited', label: 'Đã đặt cọc', color: 'purple' },
    { value: 'closed', label: 'Đã giao dịch', color: 'green' },
    { value: 'lost', label: 'Ngừng chăm sóc', color: 'gray' },
    { value: 'newLead', label: 'Mới', color: 'blue', legacy: true },
    { value: 'qualifiedLead', label: 'Đang tư vấn', color: 'cyan', legacy: true },
    { value: 'negotiatingLead', label: 'Đang thương lượng', color: 'orange', legacy: true },
];

export const LEAD_STATUSES = [
    { value: 'new', label: 'Mới', color: 'blue' },
    { value: 'contacted', label: 'Đã liên hệ', color: 'cyan' },
    { value: 'consulting', label: 'Đang tư vấn', color: 'teal' },
    { value: 'appointment', label: 'Đã hẹn gặp', color: 'orange' },
    { value: 'converted', label: 'Đã thành khách hàng', color: 'green' },
    { value: 'lost', label: 'Không tiềm năng', color: 'gray' },
    { value: 'active', label: 'Đang theo dõi', color: 'cyan', legacy: true },
    { value: 'pending', label: 'Chờ xử lý', color: 'blue', legacy: true },
    { value: 'sold', label: 'Đã chốt', color: 'green', legacy: true },
];

export const TITLES = ['Anh', 'Chị', 'Ông', 'Bà', 'Cô', 'Chú', 'Bác', 'Em'].map((title) => ({ value: title, label: title }));

export const GENDERS = [
    { value: 'male', label: 'Nam' },
    { value: 'female', label: 'Nữ' },
    { value: 'other', label: 'Khác' },
    { value: 'Male', label: 'Nam', legacy: true },
    { value: 'Female', label: 'Nữ', legacy: true },
];

export const DEAL_TYPES = [
    { value: 'sale', label: 'Mua bán' },
    { value: 'rent', label: 'Cho thuê' },
];

export const DEAL_STATUSES = [
    { value: 'negotiating', label: 'Đang đàm phán', color: 'blue' },
    { value: 'deposit', label: 'Đã đặt cọc', color: 'orange' },
    { value: 'contract', label: 'Đã ký hợp đồng', color: 'purple' },
    { value: 'completed', label: 'Hoàn tất', color: 'green' },
    { value: 'cancelled', label: 'Đã hủy', color: 'red' },
];

export const COMMISSION_STATUSES = [
    { value: 'pending', label: 'Chưa thu', color: 'orange' },
    { value: 'partial', label: 'Đã thu một phần', color: 'yellow' },
    { value: 'received', label: 'Đã thu đủ', color: 'green' },
];

// Role of an employee in a deal, for the commission split
export const SPLIT_ROLES = [
    { value: 'selling', label: 'Đầu khách' },
    { value: 'listing', label: 'Đầu chủ' },
    { value: 'support', label: 'Hỗ trợ' },
    { value: 'manager', label: 'Quản lý' },
];

export const MEETING_TYPES = [
    { value: 'viewing', label: 'Dẫn xem nhà' },
    { value: 'consulting', label: 'Gặp tư vấn' },
    { value: 'signing', label: 'Ký cọc / hợp đồng' },
    { value: 'other', label: 'Khác' },
];

export const MEETING_STATUSES = [
    { value: 'scheduled', label: 'Đã lên lịch', color: 'blue' },
    { value: 'done', label: 'Đã gặp', color: 'green' },
    { value: 'cancelled', label: 'Đã hủy', color: 'gray' },
];

export const CALL_RESULTS = [
    { value: 'answered', label: 'Nghe máy', color: 'green' },
    { value: 'callBack', label: 'Hẹn gọi lại', color: 'blue' },
    { value: 'noAnswer', label: 'Không nghe máy', color: 'orange' },
    { value: 'busy', label: 'Máy bận / thuê bao', color: 'yellow' },
    { value: 'wrongNumber', label: 'Sai số', color: 'red' },
];

export const TASK_STATUSES = [
    { value: 'todo', label: 'Cần làm', color: 'blue' },
    { value: 'inProgress', label: 'Đang làm', color: 'orange' },
    { value: 'done', label: 'Hoàn thành', color: 'green' },
];

export const TASK_PRIORITIES = [
    { value: 'high', label: 'Cao', color: 'red' },
    { value: 'normal', label: 'Bình thường', color: 'blue' },
    { value: 'low', label: 'Thấp', color: 'gray' },
];

// Provinces and centrally-run cities since the merger of 12/06/2025 (Nghị quyết
// 202/2025/QH15): the 6 cities first, then the provinces
export const PROVINCES = [
    'Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Huế',
    'An Giang', 'Bắc Ninh', 'Cà Mau', 'Cao Bằng', 'Đắk Lắk', 'Điện Biên', 'Đồng Nai', 'Đồng Tháp',
    'Gia Lai', 'Hà Tĩnh', 'Hưng Yên', 'Khánh Hòa', 'Lai Châu', 'Lâm Đồng', 'Lạng Sơn', 'Lào Cai',
    'Nghệ An', 'Ninh Bình', 'Phú Thọ', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sơn La', 'Tây Ninh',
    'Thái Nguyên', 'Thanh Hóa', 'Tuyên Quang', 'Vĩnh Long',
].map((province) => ({ value: province, label: province }));

// Options offered in forms (without the legacy codes)
export const selectable = (options) => options.filter((option) => !option.legacy);

export const findOption = (options, value) => options.find((option) => option.value === value);

// Label of a stored code; unknown values (free text of older versions) are shown as they are
export const labelOf = (options, value) => {
    if (value === undefined || value === null || value === '') return '';
    return findOption(options, value)?.label ?? String(value);
};

export const colorOf = (options, value) => findOption(options, value)?.color || 'gray';
