import { Box, Button, Flex, HStack, Icon, Link, Text, useDisclosure } from '@chakra-ui/react';
import ContactActions from 'components/crm/ContactActions';
import DataTable from 'components/crm/DataTable';
import StatusBadge from 'components/crm/StatusBadge';
import { CALL_RESULTS, labelOf, selectable } from 'constants/realEstate';
import useApiData from 'hooks/useApiData';
import { useMemo } from 'react';
import { MdAddIcCall } from 'react-icons/md';
import { Link as RouterLink } from 'react-router-dom';
import { isAdminUser } from 'services/crm';
import { formatPhone } from 'utils/format';
import CallForm from './CallForm';
import {
    CustomerLink, activityTime, customerKindLabel, formatActivityDate, formatCallDuration, periodFilter, senderFilter,
} from './components/activity';

const CallTime = ({ call }) => (
    <Link as={RouterLink} to={`/calls/${call._id}`} color="brand.500" fontWeight="600" whiteSpace="nowrap">
        {formatActivityDate(call) || 'Xem'}
    </Link>
);

export default function Calls() {
    const isAdmin = isAdminUser();
    const { data, isLoading, reload } = useApiData('api/phoneCall/');
    const form = useDisclosure();
    const calls = useMemo(() => (Array.isArray(data) ? data : []), [data]);

    const columns = useMemo(() => [
        { Header: 'Thời gian', id: 'time', accessor: activityTime, Cell: ({ row }) => <CallTime call={row.original} /> },
        { Header: 'Khách', accessor: 'createByName', Cell: ({ row }) => <CustomerLink item={row.original} /> },
        {
            Header: 'Số điện thoại', id: 'phone', accessor: (call) => formatPhone(call.recipient),
            Cell: ({ row, value }) => (
                <HStack spacing={1}>
                    <Text whiteSpace="nowrap">{value}</Text>
                    <ContactActions phone={row.original.recipient} />
                </HStack>
            ),
        },
        {
            Header: 'Kết quả', id: 'result', accessor: (call) => labelOf(CALL_RESULTS, call.callResult),
            Cell: ({ row }) => <StatusBadge options={CALL_RESULTS} value={row.original.callResult} empty="—" />,
        },
        {
            Header: 'Nội dung', accessor: 'callNotes', disableSortBy: true,
            Cell: ({ value }) => <Text noOfLines={2} maxW="320px" minW="160px" title={value || undefined}>{value}</Text>,
        },
        { Header: 'Nhân viên', accessor: 'senderName', hideOnMobile: true },
    ], []);

    const exportColumns = useMemo(() => [
        { Header: 'Thời gian', accessor: formatActivityDate },
        { Header: 'Khách', accessor: (call) => call.createByName || '' },
        { Header: 'Loại khách', accessor: customerKindLabel },
        { Header: 'Số điện thoại', accessor: (call) => formatPhone(call.recipient) },
        { Header: 'Kết quả', accessor: (call) => labelOf(CALL_RESULTS, call.callResult) },
        { Header: 'Thời lượng', accessor: (call) => formatCallDuration(call.callDuration) },
        { Header: 'Nội dung trao đổi', accessor: (call) => call.callNotes || '' },
        { Header: 'Nhân viên', accessor: (call) => call.senderName || '' },
    ], []);

    const filters = useMemo(() => [
        { id: 'callResult', label: 'Kết quả', options: selectable(CALL_RESULTS) },
        periodFilter,
        ...(isAdmin ? [senderFilter(calls)] : []),
    ], [isAdmin, calls]);

    return (
        <>
            <DataTable
                title="Cuộc gọi"
                columns={columns}
                exportColumns={exportColumns}
                data={calls}
                isLoading={isLoading}
                filters={filters}
                searchPlaceholder="Tìm tên khách, số điện thoại, nội dung..."
                getSearchText={(call) => [
                    call.createByName, call.recipient, formatPhone(call.recipient), call.callNotes, call.senderName,
                    labelOf(CALL_RESULTS, call.callResult),
                ].join(' ')}
                exportFileName="cuoc-goi"
                initialSortBy={[{ id: 'time', desc: true }]}
                emptyText="Chưa có cuộc gọi nào. Sau mỗi lần gọi khách, bấm “Ghi cuộc gọi” để lưu lại nội dung trao đổi."
                toolbar={<Button leftIcon={<Icon as={MdAddIcCall} />} variant="brand" onClick={form.onOpen}>Ghi cuộc gọi</Button>}
                renderCard={(call) => (
                    <Flex direction="column" gap={2}>
                        <Flex justify="space-between" align="start" gap={2}>
                            <CustomerLink item={call} />
                            <StatusBadge options={CALL_RESULTS} value={call.callResult} />
                        </Flex>
                        <Flex justify="space-between" align="center" gap={2}>
                            <Box>
                                <Text fontWeight="600">{formatPhone(call.recipient)}</Text>
                                <Text fontSize="sm" color="gray.500">
                                    {[formatActivityDate(call), formatCallDuration(call.callDuration)].filter(Boolean).join(' · ')}
                                </Text>
                            </Box>
                            <ContactActions phone={call.recipient} size="md" />
                        </Flex>
                        {call.callNotes && <Text fontSize="sm" noOfLines={3}>{call.callNotes}</Text>}
                        <Flex justify="space-between" align="center" gap={2}>
                            <Text fontSize="xs" color="gray.500">{isAdmin && call.senderName ? `Nhân viên: ${call.senderName}` : ''}</Text>
                            <Link as={RouterLink} to={`/calls/${call._id}`} fontSize="sm" color="brand.500" fontWeight="600">Xem chi tiết</Link>
                        </Flex>
                    </Flex>
                )}
            />
            <CallForm isOpen={form.isOpen} onClose={form.onClose} onSaved={reload} />
        </>
    );
}
