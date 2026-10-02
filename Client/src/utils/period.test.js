import { periodQuery, periodRange } from './period';

const now = new Date(2026, 8, 27, 15, 30); // 27/09/2026

test('periods start on the first day and end tonight', () => {
    expect(periodRange('month', now)).toEqual({ from: new Date(2026, 8, 1), to: new Date(2026, 8, 27, 23, 59, 59, 999) });
    expect(periodRange('lastMonth', now)).toEqual({ from: new Date(2026, 7, 1), to: new Date(2026, 7, 31, 23, 59, 59, 999) });
    expect(periodRange('quarter', now).from).toEqual(new Date(2026, 6, 1));
    expect(periodRange('year', now).from).toEqual(new Date(2026, 0, 1));
    // January: last month is December of the previous year
    expect(periodRange('lastMonth', new Date(2026, 0, 10))).toEqual({ from: new Date(2025, 11, 1), to: new Date(2025, 11, 31, 23, 59, 59, 999) });
});

test('builds the query of the dashboard API', () => {
    const range = { from: new Date('2026-09-01T00:00:00Z'), to: new Date('2026-09-30T00:00:00Z') };
    expect(periodQuery(range)).toBe('from=2026-09-01T00%3A00%3A00.000Z&to=2026-09-30T00%3A00%3A00.000Z');
});
