import { isSameDay, parseDate, toDateInput, toDateTimeInput } from 'utils/format';
import { addDays, hasTime, idOf, isHexColor, isThisWeek, readableTextColor } from 'views/admin/calender/calendarUtils';
import * as yup from 'yup';

export const TASK_CATEGORIES = [
    { value: 'None', label: 'Không liên kết' },
    { value: 'contact', label: 'Khách hàng' },
    { value: 'lead', label: 'Khách tiềm năng' },
];

// Colors offered for the calendar (any other color can be picked too)
export const TASK_COLORS = [
    { value: '#3182CE', label: 'Xanh dương' },
    { value: '#319795', label: 'Xanh ngọc' },
    { value: '#38A169', label: 'Xanh lá' },
    { value: '#D69E2E', label: 'Vàng' },
    { value: '#DD6B20', label: 'Cam' },
    { value: '#E53E3E', label: 'Đỏ' },
    { value: '#D53F8C', label: 'Hồng' },
    { value: '#805AD5', label: 'Tím' },
    { value: '#718096', label: 'Xám' },
];

export const TASK_DUE_FILTERS = [
    { value: 'overdue', label: 'Quá hạn' },
    { value: 'today', label: 'Hôm nay' },
    { value: 'week', label: 'Tuần này' },
    { value: 'none', label: 'Chưa đặt hạn' },
];

// Older tasks have no status nor priority
export const taskStatusOf = (task) => task?.status || 'todo';
export const taskPriorityOf = (task) => task?.priority || 'normal';
export const isTaskDone = (task) => taskStatusOf(task) === 'done';

// Customer or lead the task is about
export const taskRelated = (task) => {
    const name = task?.assignmentToName || '(không tên)';
    if (task?.assignmentTo) return { kind: 'Khách hàng', path: `/contacts/${idOf(task.assignmentTo)}`, name };
    if (task?.assignmentToLead) return { kind: 'Khách tiềm năng', path: `/leads/${idOf(task.assignmentToLead)}`, name };
    return null;
};

// Deadline of a task: its end, else its start. An all-day deadline lasts until
// the end of that day.
export const taskDue = (task) => {
    const value = task?.end || task?.start || '';
    const date = parseDate(value);
    if (!date) return null;
    const allDay = !hasTime(value);
    return { value, date, allDay, limit: allDay ? addDays(date, 1) : date };
};

export const isTaskOverdue = (task, now = new Date()) => {
    const due = taskDue(task);
    return Boolean(due) && !isTaskDone(task) && due.limit <= now;
};

// Values of the deadline filter matching a task
export const taskDueTags = (task, now = new Date()) => {
    const due = taskDue(task);
    if (!due) return ['none'];
    const tags = [];
    if (isTaskOverdue(task, now)) tags.push('overdue');
    if (isSameDay(due.date, now)) tags.push('today');
    if (isThisWeek(due.date, now)) tags.push('week');
    return tags;
};

// Position of a task on the calendar: { start, end, allDay }. The deadline of an
// all-day task is its last day, while FullCalendar expects the day after.
export const taskRange = (task) => {
    const startValue = task?.start || task?.end;
    const start = parseDate(startValue);
    if (!start) return null;
    const allDay = !hasTime(startValue);
    const range = { allDay, start: allDay ? toDateInput(start) : start };
    const end = task.start && task.end ? parseDate(task.end) : null;
    const sameKind = end && hasTime(task.end) === !allDay;
    if (sameKind && allDay && end >= start) range.end = toDateInput(addDays(end, 1));
    if (sameKind && !allDay && end > start) range.end = end;
    return range;
};

export const taskSchema = yup.object({
    title: yup.string().trim().required('Vui lòng nhập tiêu đề công việc'),
    assignmentTo: yup.string().when('category', {
        is: 'contact',
        then: (schema) => schema.required('Vui lòng chọn khách hàng'),
    }),
    assignmentToLead: yup.string().when('category', {
        is: 'lead',
        then: (schema) => schema.required('Vui lòng chọn khách tiềm năng'),
    }),
    start: yup.string().test('valid-date', 'Ngày không hợp lệ', (value) => !value || Boolean(parseDate(value))),
    end: yup.string()
        .test('valid-date', 'Ngày không hợp lệ', (value) => !value || Boolean(parseDate(value)))
        .test('after-start', 'Hạn hoàn thành không được trước thời gian bắt đầu', function afterStart(value) {
            const start = parseDate(this.parent.start);
            const end = parseDate(value);
            return !start || !end || end >= start;
        }),
});

// Form values of a task, or of a new one from the defaults. Dates keep the
// format of the task: dates only for all-day tasks, else date and time.
export const taskInitialValues = (task, defaults) => {
    const source = task || defaults || {};
    const assignmentTo = idOf(source.assignmentTo);
    const assignmentToLead = idOf(source.assignmentToLead);
    let category = 'None';
    if (assignmentTo) category = 'contact';
    else if (assignmentToLead) category = 'lead';
    else if (!task && ['contact', 'lead'].includes(source.category)) category = source.category;
    const start = source.start || '';
    const end = source.end || '';
    const allDay = !hasTime(start) && !hasTime(end);
    const toInput = allDay ? toDateInput : toDateTimeInput;
    return {
        title: source.title || '',
        category,
        assignmentTo,
        assignmentToLead,
        priority: source.priority || 'normal',
        status: source.status || 'todo',
        allDay,
        start: toInput(start),
        end: toInput(end),
        description: source.description || '',
        notes: source.notes || '',
        backgroundColor: isHexColor(source.backgroundColor) ? source.backgroundColor : '',
    };
};

// "Cả ngày" switched: dates only, or the same days at 09:00 / 17:00
export const switchAllDay = (values, allDay) => {
    const convert = (value, time) => {
        const date = toDateInput(value);
        if (!date) return '';
        return allDay ? date : `${date}T${time}`;
    };
    return { ...values, allDay, start: convert(values.start, '09:00'), end: convert(values.end, '17:00') };
};

const trimmed = (value) => String(value ?? '').trim();

// Payload of the API: the contact or the lead (the other one is cleared)
export const taskPayload = (values, task) => {
    const color = isHexColor(values.backgroundColor) ? values.backgroundColor : '';
    const payload = {
        title: trimmed(values.title),
        category: values.category,
        assignmentTo: values.category === 'contact' && values.assignmentTo ? values.assignmentTo : null,
        assignmentToLead: values.category === 'lead' && values.assignmentToLead ? values.assignmentToLead : null,
        priority: values.priority || 'normal',
        status: values.status || 'todo',
        start: values.start || '',
        end: values.end || '',
        description: trimmed(values.description),
        notes: trimmed(values.notes),
        backgroundColor: color,
        borderColor: color,
        textColor: color ? readableTextColor(color) : '',
    };
    // Sending an unchanged status again would reset the completion date
    if (task && taskStatusOf(task) === payload.status) delete payload.status;
    return payload;
};
