// Usual reporting periods, in the browser's time zone
export const PERIODS = [
    { value: 'month', label: 'Tháng này' },
    { value: 'lastMonth', label: 'Tháng trước' },
    { value: 'quarter', label: 'Quý này' },
    { value: 'year', label: 'Năm nay' },
];

// First and last moments of a period (up to the end of today for the current ones)
export const periodRange = (period, now = new Date()) => {
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = {
        month: new Date(year, month, 1),
        lastMonth: new Date(year, month - 1, 1),
        quarter: new Date(year, Math.floor(month / 3) * 3, 1),
        year: new Date(year, 0, 1),
    }[period];
    const end = period === 'lastMonth'
        ? new Date(year, month, 0, 23, 59, 59, 999)
        : new Date(year, month, now.getDate(), 23, 59, 59, 999);
    return { from: start, to: end };
};

// Query string of the dashboard API for a period
export const periodQuery = ({ from, to }) => `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
