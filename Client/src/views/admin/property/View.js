import { AddIcon, DeleteIcon, EditIcon } from '@chakra-ui/icons';
import {
    Alert, AlertIcon, Badge, Box, Button, Flex, Grid, Heading, HStack, IconButton, Image, Link, SimpleGrid, Spinner, Stack,
    Tab, TabList, TabPanel, TabPanels, Tabs, Text, Tooltip, useDisclosure, Wrap, WrapItem,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import ConfirmDialog from 'components/crm/ConfirmDialog';
import ContactActions from 'components/crm/ContactActions';
import DataTable from 'components/crm/DataTable';
import DetailGrid from 'components/crm/DetailGrid';
import StatusBadge from 'components/crm/StatusBadge';
import {
    CONTACT_STATUSES, DEAL_STATUSES, DIRECTIONS, FURNITURE, LEGAL_STATUSES, LISTING_STATUSES, PROPERTY_TYPES, SOURCE_TYPES,
    TRANSACTION_TYPES, YES_NO, labelOf,
} from 'constants/realEstate';
import useApiData from 'hooks/useApiData';
import { useMemo, useState } from 'react';
import { MdContentCopy, MdEventAvailable, MdHandshake, MdMap } from 'react-icons/md';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiDelete, apiPost, currentUser, downloadFile } from 'services/crm';
import {
    displayName, formatArea, formatDate, formatNumber, formatPhone, formatPriceShort, formatPricePerM2, propertyAddress, toNumber, userName,
} from 'utils/format';
import { listingText } from 'utils/listingText';
import DealForm from 'views/admin/deal/DealForm';
import MeetingForm from 'views/admin/meeting/MeetingForm';
import MediaUpload, { MEDIA_KINDS } from './components/MediaUpload';
import PropertyForm from './PropertyForm';

const LEGACY_STATUS = { active: 'available', pending: 'deposited' };

const copyText = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
    } catch (e) {
        // Browsers without the clipboard API (http pages)
        const area = document.createElement('textarea');
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
    }
};

function MediaSection({ property, kind, canEdit, onChanged }) {
    const upload = useDisclosure();
    const [toRemove, setToRemove] = useState(null);
    const items = property[kind.field] || [];

    const openPrivate = async (item) => {
        try {
            await downloadFile(`api/property/property-documents/${encodeURIComponent(item.filename)}`, item.filename);
        } catch (e) {
            toast.error(e.message);
        }
    };

    const remove = async () => {
        try {
            await apiPost(`api/property/remove-media/${property._id}/${kind.field}`, { img: toRemove.img });
            toast.success('Đã xóa tệp');
            onChanged();
        } catch (e) {
            toast.error(e.message);
            throw e;
        }
    };

    return (
        <Box>
            <Flex justify="space-between" align="center" mb={3}>
                <Heading size="sm">{kind.label} ({items.length})</Heading>
                {canEdit && <Button size="sm" leftIcon={<AddIcon />} onClick={upload.onOpen}>Tải lên</Button>}
            </Flex>
            {items.length === 0 ? (
                <Text fontSize="sm" color="gray.500">Chưa có tệp nào</Text>
            ) : kind.images ? (
                <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={3}>
                    {items.map((item) => (
                        <Box key={item.img} position="relative" borderRadius="10px" overflow="hidden" borderWidth="1px">
                            <Link href={item.img} isExternal>
                                <Image src={item.img} alt={kind.label} objectFit="cover" w="100%" h="140px" />
                            </Link>
                            {canEdit && (
                                <IconButton size="xs" colorScheme="red" icon={<DeleteIcon />} aria-label="Xóa ảnh" position="absolute" top={1} right={1} onClick={() => setToRemove(item)} />
                            )}
                        </Box>
                    ))}
                </SimpleGrid>
            ) : (
                <Stack spacing={2}>
                    {items.map((item, index) => (
                        <Flex key={item.img} justify="space-between" align="center" borderWidth="1px" borderRadius="8px" px={3} py={2}>
                            {kind.private && item.filename ? (
                                // Legal papers are served with the session token only
                                <Link as="button" textAlign="left" color="brand.500" noOfLines={1} onClick={() => openPrivate(item)}>
                                    {item.filename}
                                </Link>
                            ) : (
                                <Link href={item.img} isExternal color="brand.500" noOfLines={1}>
                                    {item.filename || `${kind.label} ${index + 1}`}
                                </Link>
                            )}
                            <HStack>
                                <Text fontSize="xs" color="gray.500">{formatDate(item.createOn)}</Text>
                                {canEdit && <IconButton size="xs" variant="ghost" colorScheme="red" icon={<DeleteIcon />} aria-label="Xóa tệp" onClick={() => setToRemove(item)} />}
                            </HStack>
                        </Flex>
                    ))}
                </Stack>
            )}
            <MediaUpload isOpen={upload.isOpen} onClose={upload.onClose} propertyId={property._id} kind={kind} onUploaded={onChanged} />
            <ConfirmDialog
                isOpen={Boolean(toRemove)}
                onClose={() => setToRemove(null)}
                onConfirm={remove}
                title="Xóa tệp"
                message="Xóa tệp này khỏi bất động sản?"
                confirmLabel="Xóa"
            />
        </Box>
    );
}

export default function PropertyView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const me = currentUser();
    const { data, isLoading, error, reload } = useApiData(`api/property/view/${id}`, { initial: null });
    const edit = useDisclosure();
    const remove = useDisclosure();
    const dealForm = useDisclosure();
    const meetingForm = useDisclosure();
    const [tabIndex, setTabIndex] = useState(0);

    const property = data?.property;
    const contactColumns = useMemo(() => [
        { Header: 'Khách hàng', id: 'name', accessor: (c) => displayName(c), Cell: ({ row, value }) => <Link as={RouterLink} to={`/contacts/${row.original._id}`} color="brand.500" fontWeight="700">{value || '(không tên)'}</Link> },
        { Header: 'Điện thoại', id: 'phone', accessor: (c) => formatPhone(c.phoneNumber) },
        { Header: 'Tình trạng', accessor: 'leadStatus', Cell: ({ value }) => <StatusBadge options={CONTACT_STATUSES} value={value} /> },
        { Header: '', id: 'actions', disableSortBy: true, Cell: ({ row }) => <ContactActions phone={row.original.phoneNumber} zalo={row.original.zalo} /> },
    ], []);
    const dealColumns = useMemo(() => [
        { Header: 'Mã', accessor: 'code', Cell: ({ row, value }) => <Link as={RouterLink} to={`/deals/${row.original._id}`} color="brand.500" fontWeight="700">{value || 'Xem'}</Link> },
        { Header: 'Khách hàng', id: 'contact', accessor: (d) => displayName(d.contact) },
        { Header: 'Giá chốt', id: 'price', accessor: 'price', isNumeric: true, Cell: ({ value }) => formatPriceShort(value, { empty: '' }) },
        { Header: 'Trạng thái', accessor: 'status', Cell: ({ value }) => <StatusBadge options={DEAL_STATUSES} value={value} /> },
        { Header: 'Phụ trách', id: 'owner', accessor: (d) => userName(d.createBy) },
    ], []);

    if (isLoading && !data) return <Flex justify="center" py={20}><Spinner /></Flex>;
    if (error || !property) {
        return (
            <Alert status="warning" borderRadius="md">
                <AlertIcon />
                {error?.status === 404 ? 'Không tìm thấy bất động sản (có thể đã bị xóa).' : 'Không tải được bất động sản.'}
                <Button ml="auto" size="sm" onClick={() => navigate('/properties')}>Về danh sách</Button>
            </Alert>
        );
    }

    const canEdit = property.canEdit;
    const rent = property.transactionType === 'rent';
    const price = property.price ?? toNumber(property.listingPrice);
    const area = property.area ?? toNumber(property.squareFootage);
    const status = LEGACY_STATUS[property.listingStatus] || property.listingStatus || 'available';
    const kinds = MEDIA_KINDS.filter((kind) => !kind.private || canEdit);

    const deleteProperty = async () => {
        try {
            await apiDelete(`api/property/delete/${property._id}`);
            toast.success('Đã xóa bất động sản');
            navigate('/properties');
        } catch (e) {
            toast.error(e.message);
            throw e;
        }
    };

    const copyListing = async () => {
        await copyText(listingText(property, me));
        toast.success('Đã sao chép tin đăng, dán vào Zalo / Facebook để gửi khách');
    };

    const cover = property.propertyPhotos?.[0]?.img;

    return (
        <Stack spacing={5}>
            <Card>
                <Grid templateColumns={{ base: '1fr', lg: cover ? '280px 1fr' : '1fr' }} gap={5}>
                    {cover && <Image src={cover} alt={property.title} borderRadius="12px" objectFit="cover" w="100%" h={{ base: '200px', lg: '100%' }} maxH="240px" />}
                    <Stack spacing={3}>
                        <Wrap spacing={2}>
                            {property.code && <WrapItem><Badge variant="outline" colorScheme="gray">{property.code}</Badge></WrapItem>}
                            <WrapItem><Badge colorScheme={rent ? 'purple' : 'blue'}>{labelOf(TRANSACTION_TYPES, property.transactionType) || 'Bán'}</Badge></WrapItem>
                            <WrapItem><StatusBadge options={LISTING_STATUSES} value={status} /></WrapItem>
                            {property.sourceType && <WrapItem><Badge colorScheme="teal">{labelOf(SOURCE_TYPES, property.sourceType)}</Badge></WrapItem>}
                        </Wrap>
                        <Heading size="lg">{property.title || propertyAddress(property) || labelOf(PROPERTY_TYPES, property.propertyType)}</Heading>
                        <Text color="gray.600">{[propertyAddress(property), property.oldAddress && `(${property.oldAddress} cũ)`].filter(Boolean).join(' ')}</Text>
                        <HStack spacing={6} flexWrap="wrap">
                            <Box>
                                <Text fontSize="sm" color="gray.500">{rent ? 'Giá thuê' : 'Giá bán'}</Text>
                                <Text fontSize="2xl" fontWeight="800" color="red.500">{formatPriceShort(price, { rent })}</Text>
                            </Box>
                            {area ? (
                                <Box>
                                    <Text fontSize="sm" color="gray.500">Diện tích</Text>
                                    <Text fontSize="xl" fontWeight="700">{formatArea(area)}</Text>
                                </Box>
                            ) : null}
                            {!rent && formatPricePerM2(price, area) && (
                                <Box>
                                    <Text fontSize="sm" color="gray.500">Đơn giá</Text>
                                    <Text fontSize="xl" fontWeight="700">{formatPricePerM2(price, area)}</Text>
                                </Box>
                            )}
                        </HStack>
                        <Wrap spacing={2} pt={1}>
                            <WrapItem><Button leftIcon={<MdContentCopy />} onClick={copyListing}>Sao chép tin đăng</Button></WrapItem>
                            <WrapItem><Button leftIcon={<MdEventAvailable />} onClick={meetingForm.onOpen}>Đặt lịch dẫn xem</Button></WrapItem>
                            <WrapItem><Button leftIcon={<MdHandshake />} colorScheme="green" onClick={dealForm.onOpen}>Tạo giao dịch</Button></WrapItem>
                            {property.mapUrl && <WrapItem><Button as="a" href={property.mapUrl} target="_blank" rel="noopener noreferrer" leftIcon={<MdMap />} variant="outline">Bản đồ</Button></WrapItem>}
                            {canEdit && <WrapItem><Button leftIcon={<EditIcon />} variant="brand" onClick={edit.onOpen}>Sửa</Button></WrapItem>}
                            {canEdit && (
                                <WrapItem>
                                    <Tooltip label="Xóa bất động sản" hasArrow>
                                        <IconButton icon={<DeleteIcon />} colorScheme="red" variant="outline" aria-label="Xóa" onClick={remove.onOpen} />
                                    </Tooltip>
                                </WrapItem>
                            )}
                        </Wrap>
                    </Stack>
                </Grid>
            </Card>

            <Card>
                <Tabs index={tabIndex} onChange={setTabIndex} colorScheme="brand" isLazy>
                    <TabList overflowX="auto" overflowY="hidden">
                        <Tab whiteSpace="nowrap">Thông tin</Tab>
                        <Tab whiteSpace="nowrap">Hình ảnh, tài liệu</Tab>
                        <Tab whiteSpace="nowrap">Khách quan tâm ({data.filteredContacts?.length || 0})</Tab>
                        <Tab whiteSpace="nowrap">Giao dịch ({data.deals?.length || 0})</Tab>
                    </TabList>
                    <TabPanels>
                        <TabPanel px={0}>
                            <Stack spacing={6}>
                                <DetailGrid
                                    title="Đặc điểm"
                                    items={[
                                        { label: 'Loại bất động sản', value: labelOf(PROPERTY_TYPES, property.propertyType) },
                                        { label: 'Dự án', value: [property.projectName, property.block && `Tòa ${property.block}`, property.unitCode && `Căn ${property.unitCode}`, property.floorNumber && `Tầng ${property.floorNumber}`].filter(Boolean).join(' · '), optional: true },
                                        { label: 'Diện tích sử dụng', value: formatArea(property.usableArea), optional: true },
                                        { label: 'Kích thước', value: property.width && property.length ? `${formatNumber(property.width)} x ${formatNumber(property.length)} m` : '', optional: true },
                                        { label: 'Đường trước nhà', value: property.roadWidth ? `${formatNumber(property.roadWidth)} m` : '', optional: true },
                                        { label: 'Số tầng', value: property.floors, optional: true },
                                        { label: 'Phòng ngủ', value: property.numberofBedrooms, optional: true },
                                        { label: 'Phòng tắm / WC', value: property.numberofBathrooms, optional: true },
                                        { label: 'Hướng nhà', value: labelOf(DIRECTIONS, property.direction), optional: true },
                                        { label: 'Hướng ban công', value: labelOf(DIRECTIONS, property.balconyDirection), optional: true },
                                        { label: 'Pháp lý', value: labelOf(LEGAL_STATUSES, property.legalStatus) },
                                        { label: 'Nội thất', value: labelOf(FURNITURE, property.furniture), optional: true },
                                        { label: 'Chỗ đậu ô tô', value: labelOf(YES_NO, property.parkingAvailability), optional: true },
                                        { label: 'Năm xây dựng', value: property.yearBuilt, optional: true },
                                        { label: 'Phí môi giới', value: property.commissionRate ? `${formatNumber(property.commissionRate)}%` : '', optional: true },
                                        { label: 'Tiện ích xung quanh', value: property.communityAmenities, span: 2, optional: true },
                                        { label: 'Mô tả', value: property.propertyDescription, span: 2 },
                                    ]}
                                />
                                {canEdit && (
                                    <DetailGrid
                                        title="Chủ nhà và nội bộ (chỉ người phụ trách và quản trị xem được)"
                                        items={[
                                            { label: 'Chủ nhà', value: property.ownerName },
                                            {
                                                label: 'SĐT chủ nhà',
                                                value: property.ownerPhone ? <HStack><Text>{formatPhone(property.ownerPhone)}</Text><ContactActions phone={property.ownerPhone} /></HStack> : '',
                                            },
                                            { label: 'Ngày nhận hàng', value: formatDate(property.listingDate), optional: true },
                                            { label: 'Hạn HĐ ký gửi / độc quyền', value: formatDate(property.contractExpiry), optional: true },
                                            { label: 'Thỏa thuận phí', value: property.commissionNote, span: 2, optional: true },
                                            { label: 'Ghi chú nội bộ', value: property.internalNotesOrComments, span: 2, optional: true },
                                        ]}
                                    />
                                )}
                                <DetailGrid
                                    title="Quản lý"
                                    items={[
                                        { label: 'Nhân viên phụ trách', value: userName(property.createBy) },
                                        { label: 'Điện thoại', value: formatPhone(property.createBy?.phoneNumber), optional: true },
                                        { label: 'Ngày tạo', value: formatDate(property.createdDate) },
                                        { label: 'Cập nhật', value: formatDate(property.updatedDate) },
                                    ]}
                                />
                            </Stack>
                        </TabPanel>
                        <TabPanel px={0}>
                            <Stack spacing={8}>
                                {kinds.map((kind) => (
                                    <MediaSection key={kind.field} property={property} kind={kind} canEdit={canEdit} onChanged={reload} />
                                ))}
                            </Stack>
                        </TabPanel>
                        <TabPanel px={0}>
                            <DataTable
                                card={false}
                                columns={contactColumns}
                                data={data.filteredContacts || []}
                                emptyText="Chưa có khách hàng nào của bạn quan tâm BĐS này"
                                initialPageSize={10}
                            />
                        </TabPanel>
                        <TabPanel px={0}>
                            <DataTable
                                card={false}
                                columns={dealColumns}
                                data={data.deals || []}
                                emptyText="Chưa có giao dịch"
                                toolbar={<Button leftIcon={<AddIcon />} size="sm" onClick={dealForm.onOpen}>Tạo giao dịch</Button>}
                            />
                        </TabPanel>
                    </TabPanels>
                </Tabs>
            </Card>

            {canEdit && <PropertyForm isOpen={edit.isOpen} onClose={edit.onClose} property={property} onSaved={reload} />}
            <DealForm isOpen={dealForm.isOpen} onClose={dealForm.onClose} defaults={{ property: property._id, dealType: property.transactionType === 'rent' ? 'rent' : 'sale', price, commissionRate: property.commissionRate }} onSaved={reload} />
            <MeetingForm isOpen={meetingForm.isOpen} onClose={meetingForm.onClose} defaults={{ property: property._id, meetingType: 'viewing', agenda: `Dẫn xem ${property.code || property.title || 'nhà'}`, location: propertyAddress(property) }} />
            <ConfirmDialog
                isOpen={remove.isOpen}
                onClose={remove.onClose}
                onConfirm={deleteProperty}
                title="Xóa bất động sản"
                message={`Xóa bất động sản ${property.code || ''}? Thao tác này không thể hoàn tác trên giao diện.`}
                confirmLabel="Xóa"
            />
        </Stack>
    );
}
