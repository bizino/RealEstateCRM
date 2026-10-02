import { formatDate, formatTime, isSameDay, parseDate } from 'utils/format';

// Helpers shared by the calendar, the meetings and the tasks

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

// Lists loaded from the API (the initial value is kept when a call fails)
export const listOf = (data) => (Array.isArray(data) ? data : []);

// Id of a reference: detail endpoints send the whole document instead of the id
export const idOf = (value) => (value && typeof value === 'object' ? value._id : value) || '';
export const idsOf = (values) => (Array.isArray(values) ? values.map(idOf).filter(Boolean) : []);

// "2026-09-27" (all day, from <input type="date">) has no time of day,
// "2026-09-27T09:00" (from <input type="datetime-local">) has one
export const hasTime = (value) => value instanceof Date || /\d{1,2}:\d{2}/.test(String(value ?? ''));

export const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

// Weeks start on Monday in Vietnam
export const startOfWeek = (date) => addDays(startOfDay(date), -((date.getDay() + 6) % 7));

export const isThisWeek = (date, now = new Date()) => {
    const start = startOfWeek(now);
    return date >= start && date < addDays(start, 7);
};

// "Hôm nay", "Ngày mai", "Hôm qua", or '' for other days
export const nearDayLabel = (value, now = new Date()) => {
    const date = parseDate(value);
    if (!date) return '';
    const today = startOfDay(now);
    if (isSameDay(date, today)) return 'Hôm nay';
    if (isSameDay(date, addDays(today, 1))) return 'Ngày mai';
    if (isSameDay(date, addDays(today, -1))) return 'Hôm qua';
    return '';
};

// "Hôm nay", "Ngày mai", "Hôm qua", else the day of the week ("Thứ hai")
export const dayLabel = (value, now = new Date()) => {
    const date = parseDate(value);
    if (!date) return '';
    return nearDayLabel(date, now) || WEEKDAYS[date.getDay()];
};

// "Thứ bảy, 27/09/2026 lúc 09:00", without the time for all-day values
export const longDateTime = (value) => {
    const date = parseDate(value);
    if (!date) return '';
    const day = `${WEEKDAYS[date.getDay()]}, ${formatDate(date)}`;
    return hasTime(value) ? `${day} lúc ${formatTime(date)}` : day;
};

export const isHexColor = (value) => /^#[0-9a-f]{6}$/i.test(String(value ?? ''));

// Dark or white text, whichever reads better on a background color
export const readableTextColor = (background) => {
    if (!isHexColor(background)) return '#FFFFFF';
    const [r, g, b] = [1, 3, 5].map((index) => parseInt(background.slice(index, index + 2), 16));
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1A202C' : '#FFFFFF';
};
