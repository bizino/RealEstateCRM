import { isSameDay, parseDate, toDateTimeInput } from 'utils/format';
import { addDays, idOf, idsOf, startOfDay } from 'views/admin/calender/calendarUtils';
import * as yup from 'yup';

const HOUR = 60 * 60 * 1000;

// Older meetings have no status
export const meetingStatusOf = (meeting) => meeting?.status || 'scheduled';

// A meeting lasts one hour on the calendar
export const meetingEnd = (date) => new Date(date.getTime() + HOUR);

// Still "scheduled" although it is over: the result should be written down
export const isMeetingLate = (meeting, now = new Date()) => {
    const date = parseDate(meeting?.dateTime);
    return meetingStatusOf(meeting) === 'scheduled' && Boolean(date) && meetingEnd(date) < now;
};

export const MEETING_TIME_FILTERS = [
    { value: 'today', label: 'Hôm nay' },
    { value: 'tomorrow', label: 'Ngày mai' },
    { value: 'upcoming', label: 'Sắp tới' },
    { value: 'past', label: 'Đã qua' },
];

// Values of the time filter matching a meeting (one today is also upcoming or past)
export const meetingTimeTags = (meeting, now = new Date()) => {
    const date = parseDate(meeting?.dateTime);
    if (!date) return [];
    const today = startOfDay(now);
    const tags = [date >= now ? 'upcoming' : 'past'];
    if (isSameDay(date, today)) tags.push('today');
    if (isSameDay(date, addDays(today, 1))) tags.push('tomorrow');
    return tags;
};

// Names of the attendees and of the property sent by the list endpoint
export const attendeesText = (meeting) => (meeting?.attendesArray || []).filter(Boolean).join(', ');
export const meetingPropertyText = (meeting) => [meeting?.propertyCode, meeting?.propertyName].filter(Boolean).join(' · ');

export const meetingSchema = yup.object({
    agenda: yup.string().trim().required('Vui lòng nhập nội dung lịch hẹn'),
    dateTime: yup.string()
        .required('Vui lòng chọn ngày giờ hẹn')
        .test('valid-date', 'Ngày giờ không hợp lệ', (value) => !value || Boolean(parseDate(value))),
});

// Form values of a meeting (from the list or the detail endpoint: attendees and
// property are ids or documents), or of a new one from the defaults
export const meetingInitialValues = (meeting, defaults) => {
    const source = meeting || defaults || {};
    return {
        agenda: source.agenda || '',
        meetingType: source.meetingType || (meeting ? '' : 'viewing'),
        dateTime: toDateTimeInput(source.dateTime),
        location: source.location || '',
        attendes: idsOf(source.attendes),
        attendesLead: idsOf(source.attendesLead),
        property: idOf(source.property),
        status: meeting ? meetingStatusOf(meeting) : 'scheduled',
        result: meeting?.result || '',
        notes: source.notes || '',
    };
};

const trimmed = (value) => String(value ?? '').trim();

export const meetingPayload = (values, { isEdit = false } = {}) => {
    const payload = {
        agenda: trimmed(values.agenda),
        meetingType: values.meetingType || '',
        dateTime: values.dateTime,
        location: trimmed(values.location),
        attendes: values.attendes,
        attendesLead: values.attendesLead,
        // Older screens read `related` to know which attendees to show
        related: values.attendes.length ? 'contact' : values.attendesLead.length ? 'lead' : '',
        status: values.status || 'scheduled',
        result: trimmed(values.result),
        notes: trimmed(values.notes),
    };
    // An empty property clears the one saved before
    if (values.property) payload.property = values.property;
    else if (isEdit) payload.property = '';
    return payload;
};
