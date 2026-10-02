import { AddIcon } from '@chakra-ui/icons';
import { Box, Button, Flex, Link, SimpleGrid, Stack, Stat, StatHelpText, StatLabel, StatNumber, Text, useDisclosure } from '@chakra-ui/react';
import Card from 'components/card/Card';
import ConfirmDialog from 'components/crm/ConfirmDialog';
import DataTable from 'components/crm/DataTable';
import StatusBadge from 'components/crm/StatusBadge';
import { COMMISSION_STATUSES, DEAL_STATUSES, DEAL_TYPES, labelOf } from 'constants/realEstate';
import useApiData from 'hooks/useApiData';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiDeleteMany } from 'services/crm';
import { displayName, formatDate, formatPhone, formatPriceShort, parseDate, propertyName, userName } from 'utils/format';
import DealForm from './DealForm';

// Date of the step reached by the deal
export const dealDate = (deal) => deal.completedDate || deal.contractDate || deal.depositDate || deal.createdDate;
const closed = (deal) => deal.status === 'contract' || deal.status === 'completed';

const periodOf = (deal) => {
    const date = parseDate(dealDate(deal));
    if (!date) return '';
    const now = new Date();
    if (date.getFullYear() !== now.getFullYear()) return 'older';
    return date.getMonth() === now.getMonth() ? 'thisMonth' : 'thisYear';
};

function Summary({ deals }) {
    const year = new Date().getFullYear();
    const thisYear = deals.filter((deal) => closed(deal) && parseDate(dealDate(deal))?.getFullYear() === year);
    const sales = thisYear.reduce((sum, deal) => sum + Number(deal.price || 0), 0);
    const commission = thisYear.reduce((sum, deal) => sum + Number(deal.commissionAmount || 0), 0);
    const deposits = deals.filter((deal) => deal.status === 'deposit');
    const unpaid = deals.filter((deal) => closed(deal) && deal.commissionStatus !== 'received')
        .reduce((sum, deal) => sum + Number(deal.commissionAmount || 0), 0);

    const items = [
        { label: `Doanh số ${year}`, value: formatPriceShort(sales, { empty: '0' }), help: `${thisYear.length} giao dịch đã ký` },
        { label: `Hoa hồng ${year}`, value: formatPriceShort(commission, { empty: '0' }), help: 'Của các giao dịch đã ký' },
        { label: 'Đang giữ cọc', value: deposits.length, help: formatPriceShort(deposits.reduce((sum, deal) => sum + Number(deal.depositAmount || 0), 0), { empty: '' }) },
        { label: 'Hoa hồng chưa thu', value: formatPriceShort(unpaid, { empty: '0' }), help: 'Giao dịch đã ký chưa thu đủ' },
    ];
    return (
        <SimpleGrid columns={{ base: 2, lg: 4 }} spacing={{ base: 3, md: 5 }}>
            {items.map((item) => (
                <Card key={item.label} py={4} px={5}>
                    <Stat>
                        <StatLabel color="gray.500">{item.label}</StatLabel>
                        <StatNumber fontSize={{ base: 'lg', md: '2xl' }}>{item.value}</StatNumber>
                        {item.help && <StatHelpText mb={0}>{item.help}</StatHelpText>}
                    </Stat>
                </Card>
            ))}
        </SimpleGrid>
    );
}

export default function Deals() {
    const { data, isLoading, reload } = useApiData('api/deal/');
    const form = useDisclosure();
    const [toDelete, setToDelete] = useState(null);

    const columns = useMemo(() => [
        {
            Header: 'Giao dịch', accessor: 'code',
            Cell: ({ row }) => (
                <Box minW="160px">
                    <Link as={RouterLink} to={`/deals/${row.original._id}`} fontWeight="700" color="brand.500">{row.original.code || 'Xem'}</Link>
                    <Text fontSize="xs" color="gray.500">{labelOf(DEAL_TYPES, row.original.dealType)} · {formatDate(dealDate(row.original))}</Text>
                </Box>
            ),
        },
        {
            Header: 'Khách hàng', id: 'contact', accessor: (d) => displayName(d.contact),
            Cell: ({ row, value }) => (
                <Box>
                    <Text fontWeight="600">{value}</Text>
                    <Text fontSize="xs" color="gray.500">{formatPhone(row.original.contact?.phoneNumber)}</Text>
                </Box>
            ),
        },
        {
            Header: 'Bất động sản', id: 'property', accessor: (d) => propertyName(d.property), hideOnMobile: true,
            Cell: ({ row, value }) => (row.original.property?._id
                ? <Link as={RouterLink} to={`/properties/${row.original.property._id}`} color="brand.500" noOfLines={2}>{value}</Link>
                : <Text color="gray.400">—</Text>),
        },
        { Header: 'Giá chốt', id: 'price', accessor: 'price', isNumeric: true, Cell: ({ row, value }) => <Text fontWeight="700">{formatPriceShort(value, { rent: row.original.dealType === 'rent', empty: '—' })}</Text> },
        {
            Header: 'Hoa hồng', id: 'commission', accessor: 'commissionAmount', isNumeric: true,
            Cell: ({ row, value }) => (
                <Box>
                    <Text>{formatPriceShort(value, { empty: '—' })}</Text>
                    {value ? <StatusBadge options={COMMISSION_STATUSES} value={row.original.commissionStatus} /> : null}
                </Box>
            ),
        },
        { Header: 'Trạng thái', accessor: 'status', Cell: ({ value }) => <StatusBadge options={DEAL_STATUSES} value={value} /> },
        { Header: 'Phụ trách', id: 'owner', accessor: (d) => userName(d.createBy), hideOnMobile: true },
    ], []);

    const exportColumns = useMemo(() => [
        { Header: 'Mã', accessor: 'code' },
        { Header: 'Loại', accessor: (d) => labelOf(DEAL_TYPES, d.dealType) },
        { Header: 'Trạng thái', accessor: (d) => labelOf(DEAL_STATUSES, d.status) },
        { Header: 'Khách hàng', accessor: (d) => displayName(d.contact) },
        { Header: 'SĐT khách', accessor: (d) => d.contact?.phoneNumber || '' },
        { Header: 'Bất động sản', accessor: (d) => propertyName(d.property) },
        { Header: 'Giá chốt (VNĐ)', accessor: (d) => d.price ?? '' },
        { Header: 'Tiền cọc (VNĐ)', accessor: (d) => d.depositAmount ?? '' },
        { Header: 'Ngày cọc', accessor: (d) => formatDate(d.depositDate) },
        { Header: 'Số hợp đồng', accessor: 'contractNumber' },
        { Header: 'Ngày ký HĐ', accessor: (d) => formatDate(d.contractDate) },
        { Header: 'Hoa hồng (VNĐ)', accessor: (d) => d.commissionAmount ?? '' },
        { Header: 'Thu hoa hồng', accessor: (d) => labelOf(COMMISSION_STATUSES, d.commissionStatus) },
        { Header: 'Phụ trách', accessor: (d) => userName(d.createBy) },
    ], []);

    const filters = useMemo(() => [
        { id: 'status', label: 'Trạng thái', options: DEAL_STATUSES },
        { id: 'dealType', label: 'Loại', options: DEAL_TYPES },
        { id: 'commissionStatus', label: 'Hoa hồng', options: COMMISSION_STATUSES },
        {
            id: 'period', label: 'Thời gian', getValue: periodOf,
            options: [{ value: 'thisMonth', label: 'Tháng này' }, { value: 'thisYear', label: 'Các tháng khác năm nay' }, { value: 'older', label: 'Năm trước' }],
        },
    ], []);

    const confirmDelete = async () => {
        try {
            const editable = toDelete.ids.filter((id) => data.find((deal) => deal._id === id)?.canEdit);
            if (!editable.length) {
                toast.error('Bạn chỉ có thể xóa giao dịch do mình phụ trách');
                return;
            }
            await apiDeleteMany('api/deal/deleteMany', editable);
            toast.success(`Đã xóa ${editable.length} giao dịch`);
            toDelete.clearSelection();
            reload();
        } catch (e) {
            toast.error(e.message);
            throw e;
        }
    };

    return (
        <Stack spacing={5}>
            <Summary deals={data || []} />
            <DataTable
                title="Giao dịch"
                columns={columns}
                exportColumns={exportColumns}
                data={data}
                isLoading={isLoading}
                filters={filters}
                searchPlaceholder="Tìm mã, khách hàng, BĐS, số HĐ..."
                getSearchText={(d) => [d.code, d.title, displayName(d.contact), d.contact?.phoneNumber, propertyName(d.property), d.contractNumber, userName(d.createBy)].join(' ')}
                selectable
                onDeleteSelected={(ids, clearSelection) => setToDelete({ ids, clearSelection })}
                exportFileName="giao-dich"
                emptyText="Chưa có giao dịch. Tạo giao dịch khi khách đặt cọc hoặc đang đàm phán."
                toolbar={<Button leftIcon={<AddIcon />} variant="brand" onClick={form.onOpen}>Tạo giao dịch</Button>}
                renderCard={(d) => (
                    <Stack spacing={1}>
                        <Flex justify="space-between" align="start" gap={2}>
                            <Box>
                                <Link as={RouterLink} to={`/deals/${d._id}`} fontWeight="700" color="brand.500">{d.code} · {displayName(d.contact)}</Link>
                                <Text fontSize="sm" color="gray.600" noOfLines={1}>{propertyName(d.property)}</Text>
                            </Box>
                            <StatusBadge options={DEAL_STATUSES} value={d.status} />
                        </Flex>
                        <Flex justify="space-between" fontSize="sm">
                            <Text fontWeight="700">{formatPriceShort(d.price, { rent: d.dealType === 'rent', empty: '—' })}</Text>
                            <Text color="gray.600">HH: {formatPriceShort(d.commissionAmount, { empty: '—' })}</Text>
                        </Flex>
                    </Stack>
                )}
            />
            <DealForm isOpen={form.isOpen} onClose={form.onClose} onSaved={reload} />
            <ConfirmDialog
                isOpen={Boolean(toDelete)}
                onClose={() => setToDelete(null)}
                onConfirm={confirmDelete}
                title="Xóa giao dịch"
                message={`Xóa ${toDelete?.ids.length || 0} giao dịch đã chọn? BĐS đang được giữ bởi giao dịch sẽ được mở bán lại.`}
                confirmLabel="Xóa"
            />
        </Stack>
    );
}
