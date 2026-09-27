import {
    Box, Button, Flex, HStack, Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay, Spinner, Stack, Text,
    useBreakpointValue, useColorModeValue, useDisclosure, Wrap, WrapItem,
} from '@chakra-ui/react';
import viLocale from '@fullcalendar/core/locales/vi';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import Card from 'components/card/Card';
import useApiData from 'hooks/useApiData';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MdAddTask, MdEventAvailable } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { parseDate, toDateInput, toDateTimeInput } from 'utils/format';
import MeetingForm from 'views/admin/meeting/MeetingForm';
import { meetingEnd, meetingStatusOf } from 'views/admin/meeting/meetingFields';
import TaskForm from 'views/admin/task/TaskForm';
import { isTaskDone, taskPriorityOf, taskRange } from 'views/admin/task/taskFields';
import { hasTime, isHexColor, listOf, longDateTime, readableTextColor } from './calendarUtils';

const COLORS = {
    task: '#422AFB',
    high: '#E53E3E',
    meeting: '#319795',
    done: '#A0AEC0',
};

const LEGEND = [
    { color: COLORS.meeting, label: 'Lịch hẹn' },
    { color: COLORS.task, label: 'Công việc' },
    { color: COLORS.high, label: 'Việc ưu tiên cao' },
    { color: COLORS.done, label: 'Đã xong / đã hủy' },
];

// Options of FullCalendar, outside the component so that they keep their identity
const PLUGINS = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin];
const HEADER_TOOLBAR = { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' };
const BUTTON_TEXT = { list: 'Danh sách' };
const BUTTON_HINTS = {
    prev: '$0 trước',
    next: '$0 sau',
    today: (text, unit) => (unit === 'day' ? 'Hôm nay' : `${text} này`),
};
const TIME_FORMAT = { hour: '2-digit', minute: '2-digit', hour12: false };
const VIEWS = { dayGridMonth: { eventDisplay: 'block' } };
const moreLinkHint = (count) => `Xem thêm ${count} mục`;

const PALETTES = {
    light: {
        border: '#E2E8F0', page: '#FFFFFF', neutral: '#F4F7FE', today: 'rgba(66, 42, 251, 0.06)', hover: '#F4F7FE',
        button: '#FFFFFF', buttonHover: '#EDF2F7', buttonText: '#2D3748', muted: '#718096',
    },
    dark: {
        border: 'rgba(255, 255, 255, 0.16)', page: '#111C44', neutral: 'rgba(255, 255, 255, 0.06)', today: 'rgba(117, 81, 255, 0.18)',
        hover: 'rgba(255, 255, 255, 0.08)', button: 'rgba(255, 255, 255, 0.06)', buttonHover: 'rgba(255, 255, 255, 0.14)',
        buttonText: '#E2E8F0', muted: '#A0AEC0',
    },
};

// Theme of FullCalendar: colors of the application, toolbar on three rows on phones
const calendarStyles = (p) => ({
    '--fc-border-color': p.border,
    '--fc-page-bg-color': p.page,
    '--fc-neutral-bg-color': p.neutral,
    '--fc-today-bg-color': p.today,
    '--fc-list-event-hover-bg-color': p.hover,
    '--fc-now-indicator-color': COLORS.high,
    '.fc': { fontSize: { base: '13px', md: '14px' } },
    '.fc .fc-toolbar.fc-header-toolbar': { flexWrap: 'wrap', gap: '8px', marginBottom: '16px' },
    '.fc .fc-toolbar-chunk': { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexBasis: { base: '100%', md: 'auto' } },
    '.fc .fc-toolbar-chunk:nth-of-type(2)': { order: { base: -1, md: 0 }, justifyContent: 'center' },
    '.fc .fc-toolbar-chunk:nth-of-type(3) .fc-button-group': { width: { base: '100%', md: 'auto' } },
    '.fc .fc-toolbar-title': { fontSize: { base: '18px', md: '22px' }, fontWeight: 700, textAlign: 'center' },
    '.fc .fc-toolbar-title::first-letter': { textTransform: 'uppercase' },
    '.fc .fc-button': { fontWeight: 600, borderRadius: '10px', boxShadow: 'none !important', padding: '6px 12px' },
    '.fc .fc-button-primary, .fc .fc-button-primary:disabled': { bg: p.button, borderColor: p.border, color: p.buttonText },
    '.fc .fc-button-primary:hover': { bg: p.buttonHover, borderColor: p.border, color: p.buttonText },
    '.fc .fc-button-primary:not(:disabled).fc-button-active, .fc .fc-button-primary:not(:disabled):active': {
        bg: 'brand.500', borderColor: 'brand.500', color: 'white',
    },
    '.fc .fc-col-header-cell-cushion': { color: p.muted, fontWeight: 600, padding: '6px 4px' },
    '.fc .fc-daygrid-day-number': { fontWeight: 600 },
    '.fc .fc-daygrid-day-frame': { cursor: 'pointer' },
    '.fc .fc-event, .fc .fc-list-event': { cursor: 'pointer' },
    '.fc .fc-daygrid-block-event': { borderRadius: '6px' },
    '.fc .fc-daygrid-block-event .fc-event-main': { padding: '1px 4px' },
    '.fc .crm-event-done .fc-event-title, .fc .crm-event-done .fc-list-event-title': { textDecoration: 'line-through' },
});

const taskEvent = (task) => {
    const range = taskRange(task);
    if (!range) return null;
    const done = isTaskDone(task);
    let color = taskPriorityOf(task) === 'high' ? COLORS.high : COLORS.task;
    if (isHexColor(task.backgroundColor)) color = task.backgroundColor;
    if (done) color = COLORS.done;
    return {
        id: `task-${task._id}`,
        title: task.title || 'Công việc',
        ...range,
        backgroundColor: color,
        borderColor: color,
        textColor: readableTextColor(color),
        classNames: done ? ['crm-event-done'] : [],
        extendedProps: { path: `/tasks/${task._id}` },
    };
};

const meetingEvent = (meeting) => {
    const start = parseDate(meeting.dateTime);
    if (!start) return null;
    const status = meetingStatusOf(meeting);
    const allDay = !hasTime(meeting.dateTime);
    const color = status === 'scheduled' ? COLORS.meeting : COLORS.done;
    const event = {
        id: `meeting-${meeting._id}`,
        title: `Hẹn: ${meeting.agenda || 'gặp khách'}`,
        start: allDay ? toDateInput(start) : start,
        allDay,
        backgroundColor: color,
        borderColor: color,
        textColor: readableTextColor(color),
        classNames: status === 'cancelled' ? ['crm-event-done'] : [],
        extendedProps: { path: `/meetings/${meeting._id}` },
    };
    if (!allDay) event.end = meetingEnd(start);
    return event;
};

// Tasks and meetings of the user (all of them for admins) on a calendar
export default function WorkCalendar() {
    const navigate = useNavigate();
    const tasks = useApiData('api/task/');
    const meetings = useApiData('api/meeting/');
    const isMobile = useBreakpointValue({ base: true, md: false });
    const palette = useColorModeValue(PALETTES.light, PALETTES.dark);
    const taskForm = useDisclosure();
    const meetingForm = useDisclosure();
    const [taskDefaults, setTaskDefaults] = useState();
    const [meetingDefaults, setMeetingDefaults] = useState();
    // Day (or time slot) clicked, then the choice of what to add on it
    const { isOpen: isChooserOpen, onOpen: openChooser, onClose: closeChooser } = useDisclosure();
    const [picked, setPicked] = useState(null);
    const [mounted, setMounted] = useState(false);
    const [initialView, setInitialView] = useState(null);

    // useBreakpointValue gives the value of phones on the first render: the
    // initial view is chosen once the real width is known
    useEffect(() => { setMounted(true); }, []);
    useEffect(() => {
        if (mounted && !initialView) setInitialView(isMobile ? 'listWeek' : 'dayGridMonth');
    }, [mounted, initialView, isMobile]);

    const events = useMemo(
        () => [...listOf(tasks.data).map(taskEvent), ...listOf(meetings.data).map(meetingEvent)].filter(Boolean),
        [tasks.data, meetings.data],
    );
    const styles = useMemo(() => calendarStyles(palette), [palette]);

    const handleDateClick = useCallback((arg) => {
        setPicked({ date: arg.date, allDay: arg.allDay });
        openChooser();
    }, [openChooser]);
    const handleEventClick = useCallback((info) => {
        info.jsEvent.preventDefault();
        const { path } = info.event.extendedProps;
        if (path) navigate(path);
    }, [navigate]);

    const openTaskForm = (defaults) => {
        setTaskDefaults(defaults);
        taskForm.onOpen();
    };
    const openMeetingForm = (defaults) => {
        setMeetingDefaults(defaults);
        meetingForm.onOpen();
    };

    // Clicked on a day: 09:00 for a meeting, the whole day for a task. Clicked on
    // a time slot (week and day views): that time.
    const addOnPickedDay = (kind) => {
        const { date, allDay } = picked;
        const day = toDateInput(date);
        closeChooser();
        if (kind === 'task') openTaskForm({ start: allDay ? day : toDateTimeInput(date) });
        else openMeetingForm({ dateTime: allDay ? `${day}T09:00` : toDateTimeInput(date) });
    };

    const buttonSize = isMobile ? 'sm' : 'md';

    return (
        <Card px={{ base: 3, md: 5 }} py={{ base: 4, md: 5 }}>
            <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'stretch', md: 'center' }} gap={3} mb={4}>
                <Stack spacing={1}>
                    <Wrap spacing={3} align="center">
                        {LEGEND.map((item) => (
                            <WrapItem key={item.label}>
                                <HStack spacing={1.5}>
                                    <Box w="10px" h="10px" borderRadius="full" bg={item.color} flexShrink={0} />
                                    <Text fontSize="sm">{item.label}</Text>
                                </HStack>
                            </WrapItem>
                        ))}
                        {(tasks.isLoading || meetings.isLoading) && <WrapItem><Spinner size="sm" /></WrapItem>}
                    </Wrap>
                    <Text fontSize="xs" color="gray.500">
                        Bấm vào một ngày để thêm công việc hoặc đặt lịch hẹn, bấm vào một mục để xem chi tiết.
                    </Text>
                </Stack>
                <HStack spacing={2}>
                    <Button size={buttonSize} flex={{ base: 1, md: 'none' }} leftIcon={<MdAddTask />} onClick={() => openTaskForm(undefined)}>
                        Thêm công việc
                    </Button>
                    <Button size={buttonSize} flex={{ base: 1, md: 'none' }} leftIcon={<MdEventAvailable />} variant="brand" onClick={() => openMeetingForm(undefined)}>
                        Đặt lịch hẹn
                    </Button>
                </HStack>
            </Flex>

            <Box sx={styles}>
                {initialView ? (
                    <FullCalendar
                        plugins={PLUGINS}
                        locale={viLocale}
                        initialView={initialView}
                        headerToolbar={HEADER_TOOLBAR}
                        buttonText={BUTTON_TEXT}
                        buttonHints={BUTTON_HINTS}
                        moreLinkHint={moreLinkHint}
                        closeHint="Đóng"
                        timeHint="Giờ"
                        eventHint="Nội dung"
                        noEventsText="Không có công việc hay lịch hẹn nào"
                        views={VIEWS}
                        height="auto"
                        events={events}
                        dateClick={handleDateClick}
                        eventClick={handleEventClick}
                        dayMaxEvents={3}
                        nowIndicator
                        eventTimeFormat={TIME_FORMAT}
                        slotLabelFormat={TIME_FORMAT}
                        slotMinTime="06:00:00"
                        slotMaxTime="23:00:00"
                    />
                ) : (
                    <Flex justify="center" py={10}><Spinner /></Flex>
                )}
            </Box>

            <Modal isOpen={isChooserOpen && Boolean(picked)} onClose={closeChooser} isCentered size="xs" returnFocusOnClose={false}>
                <ModalOverlay />
                <ModalContent mx={4}>
                    <ModalHeader pr={12} fontSize="md">
                        {picked ? longDateTime(picked.allDay ? toDateInput(picked.date) : picked.date) : ''}
                    </ModalHeader>
                    <ModalCloseButton aria-label="Đóng" />
                    <ModalBody pb={5}>
                        <Stack spacing={3}>
                            <Button leftIcon={<MdAddTask />} variant="outline" onClick={() => addOnPickedDay('task')}>Thêm công việc</Button>
                            <Button leftIcon={<MdEventAvailable />} variant="brand" onClick={() => addOnPickedDay('meeting')}>Đặt lịch hẹn</Button>
                        </Stack>
                    </ModalBody>
                </ModalContent>
            </Modal>

            <TaskForm isOpen={taskForm.isOpen} onClose={taskForm.onClose} defaults={taskDefaults} onSaved={tasks.reload} />
            <MeetingForm isOpen={meetingForm.isOpen} onClose={meetingForm.onClose} defaults={meetingDefaults} onSaved={meetings.reload} />
        </Card>
    );
}
