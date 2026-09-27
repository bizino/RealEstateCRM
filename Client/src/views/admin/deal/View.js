import { DeleteIcon, EditIcon } from '@chakra-ui/icons';
import {
    Alert, AlertIcon, Badge, Box, Button, Flex, Heading, HStack, Icon, IconButton, Link, SimpleGrid, Spinner, Stack,
    Table, Tbody, Td, Text, Th, Thead, Tooltip, Tr, useDisclosure, Wrap, WrapItem,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import ConfirmDialog from 'components/crm/ConfirmDialog';
import ContactActions from 'components/crm/ContactActions';
import DetailGrid from 'components/crm/DetailGrid';
import StatusBadge from 'components/crm/StatusBadge';
import { COMMISSION_STATUSES, DEAL_STATUSES, DEAL_TYPES, SPLIT_ROLES, labelOf } from 'constants/realEstate';
import useApiData from 'hooks/useApiData';
import { useState } from 'react';
import { MdArrowForward, MdCancel, MdCheckCircle } from 'react-icons/md';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiDelete, apiPut } from 'services/crm';
import { displayName, formatDate, formatMoney, formatNumber, formatPhone, formatPriceShort, parseDate, propertyName, userName } from 'utils/format';
import DealForm from './DealForm';

const STEPS = ['negotiating', 'deposit', 'contract', 'completed'];
const NEXT_LABEL = { negotiating: 'Khách đã đặt cọc', deposit: 'Đã ký hợp đồng', contract: 'Hoàn tất giao dịch' };

function Steps({ status }) {
    const current = STEPS.indexOf(status);
    return (
        <Wrap spacing={1} align="center">
            {STEPS.map((step, index) => (
                <WrapItem key={step} alignItems="center">
                    <Badge
                        px={2}
                        py={1}
                        borderRadius="md"
                        textTransform="none"
                        colorScheme={status === 'cancelled' ? 'gray' : index <= current ? 'green' : 'gray'}
                        variant={index === current ? 'solid' : 'subtle'}
                    >
                        {labelOf(DEAL_STATUSES, step)}
                    </Badge>
                    {index < STEPS.length - 1 && <Icon as={MdArrowForward} color="gray.400" mx={1} />}
                </WrapItem>
            ))}
            {status === 'cancelled' && <WrapItem><StatusBadge options={DEAL_STATUSES} value="cancelled" /></WrapItem>}
        </Wrap>
    );
}

const paymentState = (payment) => {
    if (payment.paidDate) return { label: 'Đã thanh toán', color: 'green' };
    const due = parseDate(payment.dueDate);
    if (due && due < new Date(new Date().toDateString())) return { label: 'Quá hạn', color: 'red' };
    return { label: 'Chưa đến hạn', color: 'gray' };
};

export default function DealView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: deal, isLoading, error, reload } = useApiData(`api/deal/view/${id}`, { initial: null });
    const edit = useDisclosure();
    const remove = useDisclosure();
    const [editDefaults, setEditDefaults] = useState(null);
    const [isMoving, setIsMoving] = useState(false);

    if (isLoading && !deal) return <Flex justify="center" py={20}><Spinner /></Flex>;
    if (error || !deal) {
        return (
            <Alert status="warning" borderRadius="md">
                <AlertIcon />
                {error?.status === 404 ? 'Không tìm thấy giao dịch (có thể đã bị xóa).' : 'Không tải được giao dịch.'}
                <Button ml="auto" size="sm" onClick={() => navigate('/deals')}>Về danh sách</Button>
            </Alert>
        );
    }

    const canEdit = deal.canEdit;
    const rent = deal.dealType === 'rent';
    const next = STEPS[STEPS.indexOf(deal.status) + 1];
    const commission = Number(deal.commissionAmount || 0);
    const splits = deal.commissionSplits || [];
    const splitPercent = splits.reduce((sum, split) => sum + Number(split.percent || 0), 0);
    const payments = deal.payments || [];
    const paid = payments.filter((payment) => payment.paidDate).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const scheduled = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    const moveTo = async (status) => {
        setIsMoving(true);
        try {
            await apiPut(`api/deal/edit/${deal._id}`, { status });
            toast.success(`Đã chuyển sang: ${labelOf(DEAL_STATUSES, status)}`);
            reload();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setIsMoving(false);
        }
    };

    const openEdit = (overrides = null) => {
        setEditDefaults(overrides);
        edit.onOpen();
    };

    const deleteDeal = async () => {
        try {
            await apiDelete(`api/deal/delete/${deal._id}`);
            toast.success('Đã xóa giao dịch');
            navigate('/deals');
        } catch (e) {
            toast.error(e.message);
            throw e;
        }
    };

    return (
        <Stack spacing={5}>
            <Card>
                <Stack spacing={3}>
                    <Wrap spacing={2}>
                        {deal.code && <WrapItem><Badge variant="outline">{deal.code}</Badge></WrapItem>}
                        <WrapItem><Badge colorScheme={rent ? 'purple' : 'blue'}>{labelOf(DEAL_TYPES, deal.dealType)}</Badge></WrapItem>
                        <WrapItem><StatusBadge options={DEAL_STATUSES} value={deal.status} /></WrapItem>
                    </Wrap>
                    <Heading size="lg">{deal.title || deal.code}</Heading>
                    <Steps status={deal.status} />
                    <HStack spacing={8} flexWrap="wrap">
                        <Box>
                            <Text fontSize="sm" color="gray.500">Giá chốt</Text>
                            <Text fontSize="2xl" fontWeight="800" color="red.500">{formatPriceShort(deal.price, { rent, empty: '—' })}</Text>
                        </Box>
                        <Box>
                            <Text fontSize="sm" color="gray.500">Hoa hồng công ty</Text>
                            <Text fontSize="xl" fontWeight="700">{formatPriceShort(commission, { empty: '—' })}</Text>
                        </Box>
                        {deal.depositAmount ? (
                            <Box>
                                <Text fontSize="sm" color="gray.500">Tiền cọc</Text>
                                <Text fontSize="xl" fontWeight="700">{formatPriceShort(deal.depositAmount)}</Text>
                            </Box>
                        ) : null}
                    </HStack>
                    {canEdit && (
                        <Wrap spacing={2}>
                            {next && deal.status !== 'cancelled' && (
                                <WrapItem>
                                    <Button colorScheme="green" leftIcon={<MdCheckCircle />} onClick={() => moveTo(next)} isLoading={isMoving}>{NEXT_LABEL[deal.status]}</Button>
                                </WrapItem>
                            )}
                            {deal.status !== 'cancelled' && deal.status !== 'completed' && (
                                <WrapItem>
                                    <Button variant="outline" colorScheme="orange" leftIcon={<MdCancel />} onClick={() => openEdit({ status: 'cancelled' })}>Hủy giao dịch</Button>
                                </WrapItem>
                            )}
                            <WrapItem><Button leftIcon={<EditIcon />} variant="brand" onClick={() => openEdit()}>Sửa</Button></WrapItem>
                            <WrapItem>
                                <Tooltip label="Xóa giao dịch" hasArrow>
                                    <IconButton icon={<DeleteIcon />} colorScheme="red" variant="outline" aria-label="Xóa" onClick={remove.onOpen} />
                                </Tooltip>
                            </WrapItem>
                        </Wrap>
                    )}
                </Stack>
            </Card>

            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={5}>
                <Card>
                    <DetailGrid
                        title="Khách hàng và bất động sản"
                        columns={1}
                        items={[
                            {
                                label: 'Khách hàng',
                                value: deal.contact ? (
                                    <HStack justify="space-between">
                                        <Link as={RouterLink} to={`/contacts/${deal.contact._id}`} color="brand.500">{displayName(deal.contact)}</Link>
                                        <HStack>
                                            <Text fontWeight="normal">{formatPhone(deal.contact.phoneNumber)}</Text>
                                            <ContactActions phone={deal.contact.phoneNumber} email={deal.contact.email} />
                                        </HStack>
                                    </HStack>
                                ) : '',
                            },
                            {
                                label: 'Bất động sản',
                                value: deal.property ? <Link as={RouterLink} to={`/properties/${deal.property._id}`} color="brand.500">{propertyName(deal.property)}</Link> : '',
                            },
                            { label: 'Nhân viên phụ trách', value: userName(deal.createBy) },
                            { label: 'Lý do hủy', value: deal.cancelReason, optional: true },
                            { label: 'Ghi chú', value: deal.notes, optional: true },
                        ]}
                    />
                </Card>
                <Card>
                    <DetailGrid
                        title="Đặt cọc và hợp đồng"
                        items={[
                            { label: 'Tiền đặt cọc', value: formatMoney(deal.depositAmount) },
                            { label: 'Ngày đặt cọc', value: formatDate(deal.depositDate) },
                            { label: 'Hạn ký HĐ / công chứng', value: formatDate(deal.contractDueDate) },
                            { label: 'Số hợp đồng', value: deal.contractNumber },
                            { label: 'Ngày ký hợp đồng', value: formatDate(deal.contractDate) },
                            { label: 'Ngày hoàn tất', value: formatDate(deal.completedDate) },
                            { label: 'Ngày tạo', value: formatDate(deal.createdDate) },
                            { label: 'Cập nhật', value: formatDate(deal.updatedDate) },
                        ]}
                    />
                </Card>
            </SimpleGrid>

            <Card>
                <Flex justify="space-between" align="center" mb={3} wrap="wrap" gap={2}>
                    <Heading size="sm" color="gray.600">Hoa hồng</Heading>
                    <HStack>
                        <StatusBadge options={COMMISSION_STATUSES} value={deal.commissionStatus} />
                        {deal.commissionReceivedDate && <Text fontSize="sm" color="gray.500">nhận ngày {formatDate(deal.commissionReceivedDate)}</Text>}
                    </HStack>
                </Flex>
                <Text mb={3}>
                    Tổng: <b>{formatMoney(commission) || '—'}</b>
                    {deal.commissionRate ? ` (${formatNumber(deal.commissionRate)}% giá chốt)` : ''}
                </Text>
                {splits.length === 0 ? (
                    <Text fontSize="sm" color="gray.500">Chưa chia hoa hồng cho nhân viên: toàn bộ được tính cho người phụ trách trong báo cáo.</Text>
                ) : (
                    <Box overflowX="auto">
                        <Table size="sm">
                            <Thead>
                                <Tr>
                                    <Th textTransform="none">Nhân viên</Th>
                                    <Th textTransform="none">Vai trò</Th>
                                    <Th textTransform="none" isNumeric>Tỷ lệ</Th>
                                    <Th textTransform="none" isNumeric>Số tiền</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {splits.map((split, index) => (
                                    <Tr key={index}>
                                        <Td>{userName(split.user)}</Td>
                                        <Td>{labelOf(SPLIT_ROLES, split.role)}</Td>
                                        <Td isNumeric>{formatNumber(split.percent)}%</Td>
                                        <Td isNumeric>{formatMoney(split.amount)}</Td>
                                    </Tr>
                                ))}
                                <Tr>
                                    <Td colSpan={2} fontWeight="600">Công ty giữ lại</Td>
                                    <Td isNumeric>{formatNumber(Math.max(0, 100 - splitPercent))}%</Td>
                                    <Td isNumeric>{formatMoney(Math.max(0, commission - splits.reduce((sum, split) => sum + Number(split.amount || 0), 0)))}</Td>
                                </Tr>
                            </Tbody>
                        </Table>
                    </Box>
                )}
            </Card>

            <Card>
                <Flex justify="space-between" align="center" mb={3} wrap="wrap" gap={2}>
                    <Heading size="sm" color="gray.600">Lịch thanh toán của khách</Heading>
                    {payments.length > 0 && <Text fontSize="sm">Đã thu {formatPriceShort(paid, { empty: '0' })} / {formatPriceShort(scheduled, { empty: '0' })}</Text>}
                </Flex>
                {payments.length === 0 ? (
                    <Text fontSize="sm" color="gray.500">Chưa có lịch thanh toán.</Text>
                ) : (
                    <Box overflowX="auto">
                        <Table size="sm">
                            <Thead>
                                <Tr>
                                    <Th textTransform="none">Đợt</Th>
                                    <Th textTransform="none">Hạn</Th>
                                    <Th textTransform="none" isNumeric>Số tiền</Th>
                                    <Th textTransform="none">Tình trạng</Th>
                                    <Th textTransform="none">Ghi chú</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {payments.map((payment, index) => {
                                    const state = paymentState(payment);
                                    return (
                                        <Tr key={payment._id || index}>
                                            <Td>{payment.name || `Đợt ${index + 1}`}</Td>
                                            <Td>{formatDate(payment.dueDate)}</Td>
                                            <Td isNumeric>{formatMoney(payment.amount)}</Td>
                                            <Td>
                                                <Badge colorScheme={state.color} textTransform="none">{state.label}</Badge>
                                                {payment.paidDate && <Text fontSize="xs" color="gray.500">{formatDate(payment.paidDate)}</Text>}
                                            </Td>
                                            <Td>{payment.note}</Td>
                                        </Tr>
                                    );
                                })}
                            </Tbody>
                        </Table>
                    </Box>
                )}
            </Card>

            {canEdit && (
                <DealForm
                    isOpen={edit.isOpen}
                    onClose={edit.onClose}
                    deal={editDefaults ? { ...deal, ...editDefaults } : deal}
                    onSaved={reload}
                />
            )}
            <ConfirmDialog
                isOpen={remove.isOpen}
                onClose={remove.onClose}
                onConfirm={deleteDeal}
                title="Xóa giao dịch"
                message={`Xóa giao dịch ${deal.code || ''}? Nếu BĐS đang được giữ bởi giao dịch này, BĐS sẽ được mở bán lại.`}
                confirmLabel="Xóa"
            />
        </Stack>
    );
}
