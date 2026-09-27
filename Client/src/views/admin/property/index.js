import { AddIcon } from '@chakra-ui/icons';
import { Box, Button, Flex, HStack, Link, Text, useDisclosure } from '@chakra-ui/react';
import ConfirmDialog from 'components/crm/ConfirmDialog';
import DataTable from 'components/crm/DataTable';
import StatusBadge from 'components/crm/StatusBadge';
import { LISTING_STATUSES, PROPERTY_TYPES, PROVINCES, TRANSACTION_TYPES, labelOf, selectable } from 'constants/realEstate';
import useApiData from 'hooks/useApiData';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiDeleteMany, currentUser } from 'services/crm';
import { formatArea, formatPriceShort, propertyAddress, toNumber, userName } from 'utils/format';
import PropertyForm from './PropertyForm';

const LEGACY_STATUS = { active: 'available', pending: 'deposited' };
const statusOf = (property) => LEGACY_STATUS[property.listingStatus] || property.listingStatus || 'available';
const priceOf = (property) => property.price ?? toNumber(property.listingPrice);
const areaOf = (property) => property.area ?? toNumber(property.squareFootage);
const isRent = (property) => property.transactionType === 'rent';

const PropertyTitle = ({ property }) => (
    <Box minW="220px">
        <Link as={RouterLink} to={`/properties/${property._id}`} fontWeight="700" color="brand.500">
            {property.title || propertyAddress(property) || labelOf(PROPERTY_TYPES, property.propertyType) || 'Chưa có tiêu đề'}
        </Link>
        <Text fontSize="xs" color="gray.500">
            {[property.code, labelOf(TRANSACTION_TYPES, property.transactionType), labelOf(PROPERTY_TYPES, property.propertyType)].filter(Boolean).join(' · ')}
        </Text>
    </Box>
);

export default function Properties() {
    const me = currentUser();
    const { data, isLoading, reload } = useApiData('api/property/');
    const form = useDisclosure();
    const [toDelete, setToDelete] = useState(null);

    const columns = useMemo(() => [
        { Header: 'Bất động sản', accessor: 'title', Cell: ({ row }) => <PropertyTitle property={row.original} /> },
        { Header: 'Mã', accessor: 'code', hideOnMobile: true },
        {
            Header: 'Giá', id: 'price', accessor: (p) => priceOf(p), isNumeric: true,
            Cell: ({ row }) => <Text fontWeight="700" whiteSpace="nowrap">{formatPriceShort(priceOf(row.original), { rent: isRent(row.original) })}</Text>,
        },
        { Header: 'Diện tích', id: 'area', accessor: (p) => areaOf(p), isNumeric: true, Cell: ({ value }) => formatArea(value) },
        { Header: 'Khu vực', id: 'location', accessor: (p) => [p.ward, p.province].filter(Boolean).join(', ') || p.oldAddress || propertyAddress(p), hideOnMobile: true },
        { Header: 'Tình trạng', id: 'status', accessor: statusOf, Cell: ({ value }) => <StatusBadge options={LISTING_STATUSES} value={value} /> },
        { Header: 'Phụ trách', id: 'owner', accessor: (p) => userName(p.createBy), hideOnMobile: true },
    ], []);

    const exportColumns = useMemo(() => [
        { Header: 'Mã', accessor: 'code' },
        { Header: 'Tiêu đề', accessor: 'title' },
        { Header: 'Hình thức', accessor: (p) => labelOf(TRANSACTION_TYPES, p.transactionType) },
        { Header: 'Loại BĐS', accessor: (p) => labelOf(PROPERTY_TYPES, p.propertyType) },
        { Header: 'Giá (VNĐ)', accessor: (p) => priceOf(p) ?? '' },
        { Header: 'Diện tích (m²)', accessor: (p) => areaOf(p) ?? '' },
        { Header: 'Địa chỉ', accessor: propertyAddress },
        { Header: 'Địa chỉ cũ', accessor: 'oldAddress' },
        { Header: 'Dự án', accessor: 'projectName' },
        { Header: 'Tình trạng', accessor: (p) => labelOf(LISTING_STATUSES, statusOf(p)) },
        { Header: 'Phụ trách', accessor: (p) => userName(p.createBy) },
    ], []);

    const filters = useMemo(() => [
        { id: 'transactionType', label: 'Hình thức', options: TRANSACTION_TYPES },
        { id: 'propertyType', label: 'Loại', options: PROPERTY_TYPES },
        { id: 'status', label: 'Tình trạng', options: selectable(LISTING_STATUSES), getValue: statusOf },
        { id: 'province', label: 'Tỉnh/TP', options: PROVINCES },
        {
            id: 'mine', label: 'Phụ trách',
            options: [{ value: 'mine', label: 'BĐS của tôi' }, { value: 'others', label: 'Của đồng nghiệp' }],
            getValue: (p) => ((p.createBy?._id || p.createBy) === me?._id ? 'mine' : 'others'),
        },
    ], [me?._id]);

    const deleteSelected = (ids, clearSelection) => setToDelete({ ids, clearSelection });

    const confirmDelete = async () => {
        try {
            const editable = toDelete.ids.filter((id) => data.find((p) => p._id === id)?.canEdit);
            if (!editable.length) {
                toast.error('Bạn chỉ có thể xóa bất động sản do mình phụ trách');
                return;
            }
            await apiDeleteMany('api/property/deleteMany', editable);
            toast.success(`Đã xóa ${editable.length} bất động sản`);
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
                title="Bất động sản"
                columns={columns}
                exportColumns={exportColumns}
                data={data}
                isLoading={isLoading}
                filters={filters}
                searchPlaceholder="Tìm mã, tiêu đề, địa chỉ, dự án..."
                getSearchText={(p) => [p.code, p.title, propertyAddress(p), p.oldAddress, p.projectName, p.unitCode, p.ownerName, p.ownerPhone, labelOf(PROPERTY_TYPES, p.propertyType)].join(' ')}
                selectable
                onDeleteSelected={deleteSelected}
                exportFileName="bat-dong-san"
                emptyText="Chưa có bất động sản nào. Bấm “Thêm BĐS” để nhập hàng."
                toolbar={<Button leftIcon={<AddIcon />} variant="brand" onClick={form.onOpen}>Thêm BĐS</Button>}
                renderCard={(p) => (
                    <Flex direction="column" gap={1}>
                        <Flex justify="space-between" gap={2} align="start">
                            <PropertyTitle property={p} />
                            <StatusBadge options={LISTING_STATUSES} value={statusOf(p)} />
                        </Flex>
                        <HStack spacing={4}>
                            <Text fontWeight="700" color="red.500">{formatPriceShort(priceOf(p), { rent: isRent(p) })}</Text>
                            <Text fontSize="sm">{formatArea(areaOf(p))}</Text>
                        </HStack>
                        <Text fontSize="sm" color="gray.600">{propertyAddress(p)}</Text>
                    </Flex>
                )}
            />
            <PropertyForm isOpen={form.isOpen} onClose={form.onClose} onSaved={reload} />
            <ConfirmDialog
                isOpen={Boolean(toDelete)}
                onClose={() => setToDelete(null)}
                onConfirm={confirmDelete}
                title="Xóa bất động sản"
                message={`Xóa ${toDelete?.ids.length || 0} bất động sản đã chọn? Chỉ những BĐS do bạn phụ trách mới được xóa.`}
                confirmLabel="Xóa"
            />
        </>
    );
}
