import { AddIcon } from '@chakra-ui/icons';
import { Box, Button, Flex, HStack, Link, Text, useDisclosure } from '@chakra-ui/react';
import ConfirmDialog from 'components/crm/ConfirmDialog';
import ContactActions from 'components/crm/ContactActions';
import DataTable from 'components/crm/DataTable';
import ImportModal from 'components/crm/ImportModal';
import StatusBadge from 'components/crm/StatusBadge';
import { CUSTOMER_TYPES, LEAD_SOURCES, LEAD_STATUSES, PROPERTY_TYPES, labelOf, selectable } from 'constants/realEstate';
import useApiData from 'hooks/useApiData';
import { useMemo, useState } from 'react';
import { MdUploadFile } from 'react-icons/md';
import { Link as RouterLink } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiDeleteMany, currentUser } from 'services/crm';
import { formatDate, formatPhone, userName } from 'utils/format';
import { budgetText } from 'views/admin/contact/contactFields';
import LeadForm from './LeadForm';
import { followUpState, leadImportFields } from './leadFields';

const FOLLOW_UP_COLORS = { overdue: 'red.500', today: 'orange.500', upcoming: 'inherit', none: 'gray.400' };

const needText = (lead) => [labelOf(CUSTOMER_TYPES, lead.customerType), labelOf(PROPERTY_TYPES, lead.interestedPropertyType)].filter(Boolean).join(' · ');

const NameCell = ({ lead }) => (
    <Box minW="150px">
        <Link as={RouterLink} to={`/leads/${lead._id}`} fontWeight="700" color="brand.500">{lead.leadName || '(không tên)'}</Link>
        {lead.leadCampaign && <Text fontSize="xs" color="gray.500" noOfLines={1}>{lead.leadCampaign}</Text>}
    </Box>
);

const FollowUp = ({ lead }) => {
    const state = followUpState(lead);
    if (!lead.leadFollowUpDate) return <Text color="gray.400">—</Text>;
    return (
        <Text color={FOLLOW_UP_COLORS[state]} fontWeight={state === 'overdue' || state === 'today' ? '700' : 'normal'} whiteSpace="nowrap">
            {formatDate(lead.leadFollowUpDate)}{state === 'overdue' ? ' (quá hạn)' : state === 'today' ? ' (hôm nay)' : ''}
        </Text>
    );
};

export default function Leads() {
    const isAdmin = currentUser()?.role === 'admin';
    const { data, isLoading, reload } = useApiData('api/lead/');
    const form = useDisclosure();
    const importer = useDisclosure();
    const [toDelete, setToDelete] = useState(null);

    const columns = useMemo(() => [
        { Header: 'Họ tên', accessor: 'leadName', Cell: ({ row }) => <NameCell lead={row.original} /> },
        {
            Header: 'Điện thoại', id: 'phone', accessor: 'leadPhoneNumber', disableSortBy: true,
            Cell: ({ row }) => (
                <HStack spacing={1} whiteSpace="nowrap">
                    <Text>{formatPhone(row.original.leadPhoneNumber)}</Text>
                    <ContactActions phone={row.original.leadPhoneNumber} />
                </HStack>
            ),
        },
        { Header: 'Nguồn', id: 'source', accessor: (l) => labelOf(LEAD_SOURCES, l.leadSource) },
        {
            Header: 'Nhu cầu', id: 'need', accessor: needText, hideOnMobile: true,
            Cell: ({ row, value }) => (
                <Box>
                    <Text>{value || '—'}</Text>
                    <Text fontSize="xs" color="gray.500">{budgetText(row.original)}</Text>
                </Box>
            ),
        },
        { Header: 'Tình trạng', accessor: 'leadStatus', Cell: ({ value }) => <StatusBadge options={LEAD_STATUSES} value={value || 'new'} /> },
        { Header: 'Hẹn liên hệ lại', id: 'followUp', accessor: 'leadFollowUpDate', Cell: ({ row }) => <FollowUp lead={row.original} /> },
        ...(isAdmin ? [{ Header: 'Phụ trách', id: 'owner', accessor: (l) => userName(l.createBy), hideOnMobile: true }] : []),
        { Header: 'Ngày nhận', id: 'created', accessor: 'createdDate', Cell: ({ value }) => formatDate(value), hideOnMobile: true },
    ], [isAdmin]);

    const exportColumns = useMemo(() => [
        { Header: 'Họ và tên', accessor: 'leadName' },
        { Header: 'Số điện thoại', accessor: (l) => l.leadPhoneNumber || '' },
        { Header: 'Email', accessor: 'leadEmail' },
        { Header: 'Địa chỉ', accessor: 'leadAddress' },
        { Header: 'Nguồn', accessor: (l) => labelOf(LEAD_SOURCES, l.leadSource) },
        { Header: 'Chiến dịch', accessor: 'leadCampaign' },
        { Header: 'Nhu cầu', accessor: (l) => labelOf(CUSTOMER_TYPES, l.customerType) },
        { Header: 'Loại BĐS quan tâm', accessor: (l) => labelOf(PROPERTY_TYPES, l.interestedPropertyType) },
        { Header: 'Ngân sách từ', accessor: (l) => l.budgetFrom ?? '' },
        { Header: 'Ngân sách đến', accessor: (l) => l.budgetTo ?? '' },
        { Header: 'Khu vực quan tâm', accessor: 'interestedArea' },
        { Header: 'Tình trạng', accessor: (l) => labelOf(LEAD_STATUSES, l.leadStatus || 'new') },
        { Header: 'Hẹn liên hệ lại', accessor: (l) => formatDate(l.leadFollowUpDate) },
        { Header: 'Ghi chú', accessor: 'leadNotes' },
        { Header: 'Phụ trách', accessor: (l) => userName(l.createBy) },
        { Header: 'Ngày nhận', accessor: (l) => formatDate(l.createdDate) },
    ], []);

    const filters = useMemo(() => [
        { id: 'leadStatus', label: 'Tình trạng', options: selectable(LEAD_STATUSES), getValue: (l) => l.leadStatus || 'new' },
        { id: 'leadSource', label: 'Nguồn', options: selectable(LEAD_SOURCES) },
        {
            id: 'followUp', label: 'Hẹn liên hệ', getValue: followUpState,
            options: [{ value: 'overdue', label: 'Quá hạn' }, { value: 'today', label: 'Hôm nay' }, { value: 'upcoming', label: 'Sắp tới' }],
        },
    ], []);

    const confirmDelete = async () => {
        try {
            await apiDeleteMany('api/lead/deleteMany', toDelete.ids);
            toast.success(`Đã xóa ${toDelete.ids.length} khách tiềm năng`);
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
                title="Khách tiềm năng"
                columns={columns}
                exportColumns={exportColumns}
                data={data}
                isLoading={isLoading}
                filters={filters}
                searchPlaceholder="Tìm tên, SĐT, email, chiến dịch..."
                getSearchText={(l) => [l.leadName, l.leadPhoneNumber, l.leadEmail, l.leadCampaign, l.interestedArea, l.leadNotes].join(' ')}
                selectable
                onDeleteSelected={(ids, clearSelection) => setToDelete({ ids, clearSelection })}
                exportFileName="khach-tiem-nang"
                emptyText="Chưa có khách tiềm năng. Thêm mới hoặc nhập danh sách từ quảng cáo, sự kiện."
                toolbar={(
                    <HStack>
                        <Button leftIcon={<MdUploadFile />} variant="outline" onClick={importer.onOpen}>Nhập Excel</Button>
                        <Button leftIcon={<AddIcon />} variant="brand" onClick={form.onOpen}>Thêm mới</Button>
                    </HStack>
                )}
                renderCard={(l) => (
                    <Flex direction="column" gap={1}>
                        <Flex justify="space-between" align="start" gap={2}>
                            <NameCell lead={l} />
                            <StatusBadge options={LEAD_STATUSES} value={l.leadStatus || 'new'} />
                        </Flex>
                        <Flex justify="space-between" align="center">
                            <Text fontWeight="600">{formatPhone(l.leadPhoneNumber)}</Text>
                            <ContactActions phone={l.leadPhoneNumber} email={l.leadEmail} />
                        </Flex>
                        <Flex justify="space-between" fontSize="sm" color="gray.600">
                            <Text>{labelOf(LEAD_SOURCES, l.leadSource)}</Text>
                            {l.leadFollowUpDate && <FollowUp lead={l} />}
                        </Flex>
                    </Flex>
                )}
            />
            <LeadForm isOpen={form.isOpen} onClose={form.onClose} onSaved={reload} />
            <ImportModal
                isOpen={importer.isOpen}
                onClose={importer.onClose}
                title="Nhập khách tiềm năng từ file Excel (CSV)"
                fields={leadImportFields}
                endpoint="api/lead/import"
                templateName="mau-nhap-khach-tiem-nang"
                onImported={reload}
            />
            <ConfirmDialog
                isOpen={Boolean(toDelete)}
                onClose={() => setToDelete(null)}
                onConfirm={confirmDelete}
                title="Xóa khách tiềm năng"
                message={`Xóa ${toDelete?.ids.length || 0} khách tiềm năng đã chọn?`}
                confirmLabel="Xóa"
            />
        </>
    );
}
