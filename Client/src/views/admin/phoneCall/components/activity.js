import { Box, Link, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { formatDateTime, formatNumber, parseDate } from 'utils/format';

// Helpers shared by the call and email logs

// Time of a call / an email: the time entered by the employee, else the time
// it was saved. Older versions stored Date.now() as a string of digits.
export const activityDate = (item) => {
    const value = item?.startDate;
    const date = typeof value === 'number' || (typeof value === 'string' && /^\d{12,}$/.test(value))
        ? new Date(Number(value))
        : parseDate(value);
    return date && !Number.isNaN(date.getTime()) ? date : parseDate(item?.timestamp);
};

export const activityTime = (item) => activityDate(item)?.getTime() ?? null;

export const formatActivityDate = (item) => formatDateTime(activityDate(item));

// Value of an <input type="datetime-local"> sent as an unambiguous date
export const toIsoDate = (value) => {
    const date = parseDate(value);
    return date ? date.toISOString() : value;
};

const startOfDay = (daysAgo) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - daysAgo);
    return date.getTime();
};

const PERIODS = [['today', 0], ['7d', 6], ['30d', 29]];

// Filter of the lists (see components/crm/DataTable): today, last 7 / 30 days
export const periodFilter = {
    id: 'period',
    label: 'Thời gian',
    options: [
        { value: 'today', label: 'Hôm nay' },
        { value: '7d', label: '7 ngày qua' },
        { value: '30d', label: '30 ngày qua' },
    ],
    getValue: (item) => {
        const time = activityTime(item);
        if (time === null || time >= startOfDay(-1)) return [];
        return PERIODS.filter(([, days]) => time >= startOfDay(days)).map(([period]) => period);
    },
};

// Filter by employee, for admins who see the logs of everyone
export const senderFilter = (items) => {
    const names = new Map();
    items.forEach((item) => {
        const id = String(item.sender || '');
        if (id && !names.has(id)) names.set(id, item.senderName || 'Không rõ');
    });
    return {
        id: 'sender',
        label: 'Nhân viên',
        options: [...names]
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label, 'vi', { sensitivity: 'base' })),
        getValue: (item) => String(item.sender || ''),
    };
};

// Customer (contact) or lead the call / email is about
export const isLeadActivity = (item) => Boolean(item?.createByLead && !item?.createBy);

export const customerKindLabel = (item) => {
    if (!item?.createBy && !item?.createByLead) return '';
    return isLeadActivity(item) ? 'Khách tiềm năng' : 'Khách hàng';
};

export const customerPath = (item) => {
    if (item?.createBy) return `/contacts/${item.createBy}`;
    if (item?.createByLead) return `/leads/${item.createByLead}`;
    return '';
};

export function CustomerLink({ item, showKind = true }) {
    const path = customerPath(item);
    const name = item?.createByName || (path ? '(không tên)' : 'Không rõ khách');
    return (
        <Box minW="120px">
            {path
                ? <Link as={RouterLink} to={path} fontWeight="700" color="brand.500">{name}</Link>
                : <Text as="span" color="gray.500">{name}</Text>}
            {showKind && customerKindLabel(item) && <Text fontSize="xs" color="gray.500">{customerKindLabel(item)}</Text>}
        </Box>
    );
}

// Duration of a call in minutes ("5" -> "5 phút"); free text of older versions is kept
export const formatCallDuration = (value) => {
    if (value === undefined || value === null) return '';
    const text = String(value).trim();
    if (/^\d+([.,]\d+)?$/.test(text)) return `${formatNumber(Number(text.replace(',', '.')))} phút`;
    return text;
};
