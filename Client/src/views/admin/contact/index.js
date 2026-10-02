import { AddIcon } from '@chakra-ui/icons';
import { Box, Button, Flex, HStack, Link, Text, useDisclosure } from '@chakra-ui/react';
import ConfirmDialog from 'components/crm/ConfirmDialog';
import ContactActions from 'components/crm/ContactActions';
import DataTable from 'components/crm/DataTable';
import ImportModal from 'components/crm/ImportModal';
import StatusBadge from 'components/crm/StatusBadge';
import { CONTACT_STATUSES, CUSTOMER_TYPES, LEAD_SOURCES, PROPERTY_TYPES, labelOf, selectable } from 'constants/realEstate';
import useApiData from 'hooks/useApiData';
import { useMemo, useState } from 'react';
import { MdUploadFile } from 'react-icons/md';
import { Link as RouterLink } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiDeleteMany, currentUser } from 'services/crm';
import { displayName, formatDate, formatPhone, userName } from 'utils/format';
import ContactForm from './ContactForm';
import { budgetText, contactImportFields, contactStatusOf, customerTypeOf } from './contactFields';

const needText = (contact) => [labelOf(CUSTOMER_TYPES, customerTypeOf(contact)), labelOf(PROPERTY_TYPES, contact.interestedPropertyType)].filter(Boolean).join(' · ');

const NameCell = ({ contact }) => (
    <Box minW="160px">
        <Link as={RouterLink} to={`/contacts/${contact._id}`} fontWeight="700" color="brand.500">
            {[contact.title, displayName(contact)].filter(Boolean).join(' ') || '(không tên)'}
        </Link>
        {contact.email && <Text fontSize="xs" color="gray.500" noOfLines={1}>{contact.email}</Text>}
    </Box>
);

export default function Contacts() {
    const isAdmin = currentUser()?.role === 'admin';
    const { data, isLoading, reload } = useApiData('api/contact/');
    const form = useDisclosure();
    const importer = useDisclosure();
    const [toDelete, setToDelete] = useState(null);

    const columns = useMemo(() => [
        { Header: 'Khách hàng', id: 'name', accessor: (c) => displayName(c), Cell: ({ row }) => <NameCell contact={row.original} /> },
        {
            Header: 'Điện thoại', id: 'phone', accessor: (c) => c.phoneNumber, disableSortBy: true,
            Cell: ({ row }) => (
                <HStack spacing={1} whiteSpace="nowrap">
                    <Text>{formatPhone(row.original.phoneNumber)}</Text>
                    <ContactActions phone={row.original.phoneNumber} zalo={row.original.zalo} />
                </HStack>
            ),
        },
        {
            Header: 'Nhu cầu', id: 'need', accessor: needText,
            Cell: ({ row, value }) => (
                <Box minW="140px">
                    <Text>{value || '—'}</Text>
                    <Text fontSize="xs" color="gray.500">{budgetText(row.original)}</Text>
                </Box>
            ),
        },
        { Header: 'Khu vực', accessor: 'interestedArea', hideOnMobile: true },
        { Header: 'Nguồn', id: 'source', accessor: (c) => labelOf(LEAD_SOURCES, c.leadSource), hideOnMobile: true },
        { Header: 'Tình trạng', id: 'status', accessor: contactStatusOf, Cell: ({ value }) => <StatusBadge options={CONTACT_STATUSES} value={value} /> },
        ...(isAdmin ? [{ Header: 'Phụ trách', id: 'owner', accessor: (c) => userName(c.createBy), hideOnMobile: true }] : []),
        { Header: 'Ngày tạo', id: 'created', accessor: 'createdDate', Cell: ({ value }) => formatDate(value), hideOnMobile: true },
    ], [isAdmin]);

    const exportColumns = useMemo(() => [
        { Header: 'Danh xưng', accessor: 'title' },
        { Header: 'Họ và tên', accessor: (c) => displayName(c) },
        { Header: 'Số điện thoại', accessor: (c) => c.phoneNumber || '' },
        { Header: 'SĐT khác', accessor: (c) => c.mobileNumber || '' },
        { Header: 'Zalo', accessor: 'zalo' },
        { Header: 'Email', accessor: 'email' },
        { Header: 'Địa chỉ', accessor: 'physicalAddress' },
        { Header: 'Nhu cầu', accessor: (c) => labelOf(CUSTOMER_TYPES, customerTypeOf(c)) },
        { Header: 'Loại BĐS quan tâm', accessor: (c) => labelOf(PROPERTY_TYPES, c.interestedPropertyType) },
        { Header: 'Ngân sách từ', accessor: (c) => c.budgetFrom ?? '' },
        { Header: 'Ngân sách đến', accessor: (c) => c.budgetTo ?? '' },
        { Header: 'Khu vực quan tâm', accessor: 'interestedArea' },
        { Header: 'Nguồn khách', accessor: (c) => labelOf(LEAD_SOURCES, c.leadSource) },
        { Header: 'Tình trạng', accessor: (c) => labelOf(CONTACT_STATUSES, contactStatusOf(c)) },
        { Header: 'Ghi chú', accessor: 'notesandComments' },
        { Header: 'Phụ trách', accessor: (c) => userName(c.createBy) },
        { Header: 'Ngày tạo', accessor: (c) => formatDate(c.createdDate) },
    ], []);

    const owners = useMemo(() => {
        const map = new Map();
        (data || []).forEach((c) => { if (c.createBy?._id) map.set(c.createBy._id, userName(c.createBy)); });
        return [...map.entries()].map(([value, label]) => ({ value, label }));
    }, [data]);

    const filters = useMemo(() => [
        { id: 'status', label: 'Tình trạng', options: selectable(CONTACT_STATUSES), getValue: contactStatusOf },
        { id: 'customerType', label: 'Nhu cầu', options: selectable(CUSTOMER_TYPES), getValue: customerTypeOf },
        { id: 'leadSource', label: 'Nguồn', options: selectable(LEAD_SOURCES) },
        ...(isAdmin && owners.length > 1 ? [{ id: 'owner', label: 'Phụ trách', options: owners, getValue: (c) => c.createBy?._id }] : []),
    ], [isAdmin, owners]);

    const confirmDelete = async () => {
        try {
            await apiDeleteMany('api/contact/deleteMany', toDelete.ids);
            toast.success(`Đã xóa ${toDelete.ids.length} khách hàng`);
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
                title="Khách hàng"
                columns={columns}
                exportColumns={exportColumns}
                data={data}
                isLoading={isLoading}
                filters={filters}
                searchPlaceholder="Tìm tên, SĐT, email, khu vực..."
                getSearchText={(c) => [displayName(c), c.phoneNumber, c.mobileNumber, c.zalo, c.email, c.interestedArea, c.physicalAddress, c.notesandComments].join(' ')}
                selectable
                onDeleteSelected={(ids, clearSelection) => setToDelete({ ids, clearSelection })}
                exportFileName="khach-hang"
                emptyText="Chưa có khách hàng. Thêm mới, nhập từ Excel hoặc chuyển từ khách tiềm năng."
                toolbar={(
                    <HStack>
                        <Button leftIcon={<MdUploadFile />} variant="outline" onClick={importer.onOpen}>Nhập Excel</Button>
                        <Button leftIcon={<AddIcon />} variant="brand" onClick={form.onOpen}>Thêm khách</Button>
                    </HStack>
                )}
                renderCard={(c) => (
                    <Flex direction="column" gap={1}>
                        <Flex justify="space-between" align="start" gap={2}>
                            <NameCell contact={c} />
                            <StatusBadge options={CONTACT_STATUSES} value={contactStatusOf(c)} />
                        </Flex>
                        <Flex justify="space-between" align="center">
                            <Text fontWeight="600">{formatPhone(c.phoneNumber)}</Text>
                            <ContactActions phone={c.phoneNumber} zalo={c.zalo} email={c.email} />
                        </Flex>
                        {(needText(c) || budgetText(c)) && <Text fontSize="sm" color="gray.600">{[needText(c), budgetText(c)].filter(Boolean).join(' · ')}</Text>}
                        {c.interestedArea && <Text fontSize="sm" color="gray.500">{c.interestedArea}</Text>}
                    </Flex>
                )}
            />
            <ContactForm isOpen={form.isOpen} onClose={form.onClose} onSaved={reload} />
            <ImportModal
                isOpen={importer.isOpen}
                onClose={importer.onClose}
                title="Nhập khách hàng từ file Excel (CSV)"
                fields={contactImportFields}
                endpoint="api/contact/import"
                templateName="mau-nhap-khach-hang"
                onImported={reload}
            />
            <ConfirmDialog
                isOpen={Boolean(toDelete)}
                onClose={() => setToDelete(null)}
                onConfirm={confirmDelete}
                title="Xóa khách hàng"
                message={`Xóa ${toDelete?.ids.length || 0} khách hàng đã chọn?`}
                confirmLabel="Xóa"
            />
        </>
    );
}
