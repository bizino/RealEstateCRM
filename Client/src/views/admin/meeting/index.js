import { AddIcon } from '@chakra-ui/icons';
import { Box, Button, Flex, HStack, Icon, Link, Stack, Text, useDisclosure } from '@chakra-ui/react';
import ConfirmDialog from 'components/crm/ConfirmDialog';
import DataTable from 'components/crm/DataTable';
import StatusBadge from 'components/crm/StatusBadge';
import { MEETING_STATUSES, MEETING_TYPES, labelOf } from 'constants/realEstate';
import useApiData from 'hooks/useApiData';
import { useMemo, useState } from 'react';
import { MdHome, MdPeople, MdPlace } from 'react-icons/md';
import { Link as RouterLink } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiDeleteMany } from 'services/crm';
import { formatDateTime, parseDate } from 'utils/format';
import { dayLabel } from 'views/admin/calender/calendarUtils';
import MeetingForm from './MeetingForm';
import {
    MEETING_TIME_FILTERS, attendeesText, isMeetingLate, meetingPropertyText, meetingStatusOf, meetingTimeTags,
} from './meetingFields';

const INITIAL_SORT = [{ id: 'dateTime', desc: true }];

const timeOf = (meeting) => parseDate(meeting.dateTime)?.getTime() ?? null;

const searchTextOf = (m) => [
    m.agenda, m.location, attendeesText(m), meetingPropertyText(m), m.createdByName, labelOf(MEETING_TYPES, m.meetingType),
    formatDateTime(m.dateTime), m.result, m.notes,
].join(' ');

function MeetingTime({ meeting }) {
    const date = parseDate(meeting.dateTime);
    if (!date) return <Text as="span" color="gray.400">—</Text>;
    const label = dayLabel(date);
    const isToday = label === 'Hôm nay';
    return (
        <Box whiteSpace="nowrap">
            <Text fontWeight="700">{formatDateTime(meeting.dateTime)}</Text>
            <Text fontSize="xs" color={isToday ? 'brand.500' : 'gray.500'} fontWeight={isToday ? '700' : '500'}>{label}</Text>
        </Box>
    );
}

function MeetingTitle({ meeting }) {
    return (
        <Box minW={{ md: '200px' }}>
            <Link as={RouterLink} to={`/meetings/${meeting._id}`} fontWeight="700" color="brand.500">
                {meeting.agenda || 'Lịch hẹn'}
            </Link>
            {meeting.location && <Text fontSize="xs" color="gray.500" noOfLines={1}>{meeting.location}</Text>}
        </Box>
    );
}

function MeetingStatus({ meeting }) {
    return (
        <Stack spacing={1} align="flex-start">
            <StatusBadge options={MEETING_STATUSES} value={meetingStatusOf(meeting)} />
            {isMeetingLate(meeting) && <Text fontSize="xs" color="orange.600" whiteSpace="nowrap">Chưa ghi kết quả</Text>}
        </Stack>
    );
}

const InfoLine = ({ icon, children }) => (
    <HStack spacing={2} align="start" fontSize="sm" color="gray.500">
        <Icon as={icon} mt="3px" flexShrink={0} />
        <Text>{children}</Text>
    </HStack>
);

function MeetingCard({ meeting }) {
    const attendees = attendeesText(meeting);
    const property = meetingPropertyText(meeting);
    return (
        <Stack spacing={1.5}>
            <Flex justify="space-between" align="start" gap={2}>
                <MeetingTime meeting={meeting} />
                <MeetingStatus meeting={meeting} />
            </Flex>
            <Link as={RouterLink} to={`/meetings/${meeting._id}`} fontWeight="700" color="brand.500">
                {meeting.agenda || 'Lịch hẹn'}
            </Link>
            {attendees && <InfoLine icon={MdPeople}>{attendees}</InfoLine>}
            {property && <InfoLine icon={MdHome}>{property}</InfoLine>}
            {meeting.location && <InfoLine icon={MdPlace}>{meeting.location}</InfoLine>}
        </Stack>
    );
}

export default function Meetings() {
    const { data, isLoading, reload } = useApiData('api/meeting/');
    const form = useDisclosure();
    const [toDelete, setToDelete] = useState(null);

    const columns = useMemo(() => [
        { Header: 'Thời gian', id: 'dateTime', accessor: timeOf, Cell: ({ row }) => <MeetingTime meeting={row.original} /> },
        { Header: 'Nội dung', accessor: 'agenda', Cell: ({ row }) => <MeetingTitle meeting={row.original} /> },
        { Header: 'Loại', id: 'meetingType', accessor: (m) => labelOf(MEETING_TYPES, m.meetingType) },
        {
            Header: 'Khách', id: 'attendees', accessor: attendeesText,
            Cell: ({ value }) => (value ? <Text minW="140px">{value}</Text> : <Text as="span" color="gray.400">—</Text>),
        },
        {
            Header: 'BĐS', id: 'property', accessor: meetingPropertyText,
            Cell: ({ row, value }) => {
                if (!value) return null;
                return row.original.property
                    ? <Link as={RouterLink} to={`/properties/${row.original.property}`} color="brand.500">{value}</Link>
                    : value;
            },
        },
        { Header: 'Trạng thái', id: 'status', accessor: meetingStatusOf, Cell: ({ row }) => <MeetingStatus meeting={row.original} /> },
        { Header: 'Người tạo', accessor: 'createdByName', hideOnMobile: true },
    ], []);

    const exportColumns = useMemo(() => [
        { Header: 'Thời gian', accessor: (m) => formatDateTime(m.dateTime) },
        { Header: 'Nội dung', accessor: 'agenda' },
        { Header: 'Loại', accessor: (m) => labelOf(MEETING_TYPES, m.meetingType) },
        { Header: 'Trạng thái', accessor: (m) => labelOf(MEETING_STATUSES, meetingStatusOf(m)) },
        { Header: 'Khách', accessor: attendeesText },
        { Header: 'BĐS', accessor: meetingPropertyText },
        { Header: 'Địa điểm', accessor: 'location' },
        { Header: 'Kết quả', accessor: 'result' },
        { Header: 'Ghi chú', accessor: 'notes' },
        { Header: 'Người tạo', accessor: 'createdByName' },
    ], []);

    const filters = useMemo(() => [
        { id: 'status', label: 'Trạng thái', options: MEETING_STATUSES, getValue: meetingStatusOf },
        { id: 'meetingType', label: 'Loại', options: MEETING_TYPES },
        { id: 'time', label: 'Thời gian', options: MEETING_TIME_FILTERS, getValue: (m) => meetingTimeTags(m) },
    ], []);

    const deleteSelected = (ids, clearSelection) => setToDelete({ ids, clearSelection });

    const confirmDelete = async () => {
        try {
            await apiDeleteMany('api/meeting/deleteMany', toDelete.ids);
            toast.success(`Đã xóa ${toDelete.ids.length} lịch hẹn`);
            toDelete.clearSelection();
            reload();
        } catch (e) {
            toast.error(e.message);
            throw e;
        }
    };

    return (
        <>
            <DataTable
                title="Lịch hẹn"
                columns={columns}
                exportColumns={exportColumns}
                data={data}
                isLoading={isLoading}
                filters={filters}
                searchPlaceholder="Tìm nội dung, khách, BĐS, địa điểm..."
                getSearchText={searchTextOf}
                selectable
                onDeleteSelected={deleteSelected}
                exportFileName="lich-hen"
                emptyText="Chưa có lịch hẹn nào. Bấm “Đặt lịch hẹn” để hẹn khách xem nhà."
                initialSortBy={INITIAL_SORT}
                toolbar={<Button leftIcon={<AddIcon />} variant="brand" onClick={form.onOpen}>Đặt lịch hẹn</Button>}
                renderCard={(m) => <MeetingCard meeting={m} />}
            />
            <MeetingForm isOpen={form.isOpen} onClose={form.onClose} onSaved={reload} />
            <ConfirmDialog
                isOpen={Boolean(toDelete)}
                onClose={() => setToDelete(null)}
                onConfirm={confirmDelete}
                title="Xóa lịch hẹn"
                message={`Xóa ${toDelete?.ids.length || 0} lịch hẹn đã chọn?`}
                confirmLabel="Xóa"
            />
        </>
    );
}
