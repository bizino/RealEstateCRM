import { Badge, Box, Flex, Icon, Link, Stack, Text, useColorModeValue } from '@chakra-ui/react';
import { CALL_RESULTS, MEETING_STATUSES, TASK_STATUSES, labelOf } from 'constants/realEstate';
import { MdCall, MdEmail, MdEventNote, MdTaskAlt } from 'react-icons/md';
import { Link as RouterLink } from 'react-router-dom';
import { formatDateTime, parseDate } from 'utils/format';
import StatusBadge from './StatusBadge';

const KINDS = {
    call: { icon: MdCall, color: 'green.500', label: 'Cuộc gọi', path: '/calls' },
    email: { icon: MdEmail, color: 'blue.500', label: 'Email', path: '/emails' },
    meeting: { icon: MdEventNote, color: 'purple.500', label: 'Lịch hẹn', path: '/meetings' },
    task: { icon: MdTaskAlt, color: 'orange.500', label: 'Công việc', path: '/tasks' },
};

// Customer care history (calls, emails, meetings, tasks), newest first
export const activityItems = ({ calls = [], emails = [], meetings = [], tasks = [] }) => [
    ...calls.map((call) => ({
        kind: 'call', id: call._id, date: call.startDate || call.timestamp,
        title: labelOf(CALL_RESULTS, call.callResult) || 'Đã gọi điện',
        text: call.callNotes, by: call.senderName,
        badge: call.callResult ? <StatusBadge options={CALL_RESULTS} value={call.callResult} /> : null,
    })),
    ...emails.map((email) => ({
        kind: 'email', id: email._id, date: email.startDate || email.timestamp,
        title: email.subject || '(không tiêu đề)', text: email.message, by: email.senderName,
    })),
    ...meetings.map((meeting) => ({
        kind: 'meeting', id: meeting._id, date: meeting.dateTime || meeting.timestamp,
        title: meeting.agenda,
        text: [meeting.propertyCode && `BĐS ${meeting.propertyCode}`, meeting.result || meeting.notes].filter(Boolean).join(' · '),
        by: meeting.createdByName,
        badge: <StatusBadge options={MEETING_STATUSES} value={meeting.status || 'scheduled'} />,
    })),
    ...tasks.map((task) => ({
        kind: 'task', id: task._id, date: task.end || task.start || task.createdDate,
        title: task.title, text: task.description, by: task.createByName,
        badge: <StatusBadge options={TASK_STATUSES} value={task.status || 'todo'} />,
    })),
].sort((a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0));

export default function ActivityTimeline({ items, emptyText = 'Chưa có hoạt động chăm sóc nào' }) {
    const lineColor = useColorModeValue('gray.200', 'whiteAlpha.300');
    const now = Date.now();
    if (!items.length) return <Text color="gray.500" fontSize="sm" py={4}>{emptyText}</Text>;
    return (
        <Stack spacing={0}>
            {items.map((item) => {
                const kind = KINDS[item.kind];
                const upcoming = (parseDate(item.date)?.getTime() || 0) > now;
                return (
                    <Flex key={`${item.kind}-${item.id}`} gap={3}>
                        <Flex direction="column" align="center">
                            <Flex boxSize="32px" borderRadius="full" bg={kind.color} color="white" align="center" justify="center" flexShrink={0}>
                                <Icon as={kind.icon} />
                            </Flex>
                            <Box flex="1" w="2px" bg={lineColor} my={1} />
                        </Flex>
                        <Box pb={5} flex="1" minW={0}>
                            <Flex gap={2} align="center" wrap="wrap">
                                <Text fontSize="xs" color="gray.500">{kind.label} · {formatDateTime(item.date)}</Text>
                                {upcoming && <Badge colorScheme="blue" variant="outline" textTransform="none">Sắp tới</Badge>}
                                {item.badge}
                            </Flex>
                            <Link as={RouterLink} to={`${kind.path}/${item.id}`} fontWeight="700" noOfLines={1}>{item.title}</Link>
                            {item.text && <Text fontSize="sm" color="gray.600" noOfLines={3} whiteSpace="pre-wrap">{item.text}</Text>}
                            {item.by && <Text fontSize="xs" color="gray.400">{item.by}</Text>}
                        </Box>
                    </Flex>
                );
            })}
        </Stack>
    );
}
