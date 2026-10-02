import { AddIcon, ChevronDownIcon, DeleteIcon, EditIcon } from '@chakra-ui/icons';
import {
    Alert, AlertIcon, Badge, Box, Button, Flex, Heading, HStack, IconButton, Link, Menu, MenuButton, MenuItem, MenuList,
    SimpleGrid, Spinner, Stack, Tab, TabList, TabPanel, TabPanels, Tabs, Text, Tooltip, useDisclosure, Wrap, WrapItem,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import ActivityTimeline, { activityItems } from 'components/crm/ActivityTimeline';
import ConfirmDialog from 'components/crm/ConfirmDialog';
import ContactActions from 'components/crm/ContactActions';
import DataTable from 'components/crm/DataTable';
import DetailGrid from 'components/crm/DetailGrid';
import SearchSelect from 'components/crm/SearchSelect';
import StatusBadge from 'components/crm/StatusBadge';
import {
    CONTACT_STATUSES, CUSTOMER_TYPES, DEAL_STATUSES, GENDERS, LEAD_SOURCES, LISTING_STATUSES, PROPERTY_TYPES, labelOf, selectable,
} from 'constants/realEstate';
import useApiData from 'hooks/useApiData';
import { useMemo, useState } from 'react';
import { MdCall, MdEmail, MdEventAvailable, MdHandshake, MdTaskAlt } from 'react-icons/md';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiDelete, apiPost, apiPut, downloadFile } from 'services/crm';
import { displayName, formatDate, formatPhone, formatPriceShort, propertyAddress, propertyName, toNumber, userName } from 'utils/format';
import { matchProperties } from 'utils/matching';
import { propertyOptions } from 'utils/options';
import DealForm from 'views/admin/deal/DealForm';
import EmailForm from 'views/admin/emailHistory/EmailForm';
import MeetingForm from 'views/admin/meeting/MeetingForm';
import CallForm from 'views/admin/phoneCall/CallForm';
import TaskForm from 'views/admin/task/TaskForm';
import ContactForm from './ContactForm';
import { RATINGS, budgetText, contactStatusOf, customerTypeOf } from './contactFields';

const LEGACY_LISTING = { active: 'available', pending: 'deposited' };

function InterestedProperties({ contact, interested, onChanged }) {
    const { data: properties, isLoading } = useApiData('api/property/');
    const [adding, setAdding] = useState('');
    const ids = useMemo(() => interested.map((property) => property._id), [interested]);

    const save = async (next, message) => {
        try {
            await apiPost(`api/contact/add-property-interest/${contact._id}`, next);
            toast.success(message);
            onChanged();
        } catch (e) {
            toast.error(e.message);
        }
    };
    const add = (id) => id && !ids.includes(id) && save([...ids, id], 'Đã thêm BĐS quan tâm');
    const remove = (id) => save(ids.filter((x) => x !== id), 'Đã bỏ BĐS khỏi danh sách quan tâm');
    const suggestions = useMemo(() => matchProperties(contact, properties, { exclude: ids, limit: 8 }), [contact, properties, ids]);

    const row = (property, action) => (
        <Flex key={property._id} justify="space-between" align="center" gap={3} borderWidth="1px" borderRadius="10px" px={3} py={2}>
            <Box minW={0}>
                <Link as={RouterLink} to={`/properties/${property._id}`} fontWeight="700" color="brand.500" noOfLines={1}>{propertyName(property)}</Link>
                <Text fontSize="sm" color="gray.600" noOfLines={1}>
                    {[formatPriceShort(property.price ?? toNumber(property.listingPrice), { rent: property.transactionType === 'rent' }), propertyAddress(property)].filter(Boolean).join(' · ')}
                </Text>
            </Box>
            <HStack flexShrink={0}>
                <StatusBadge options={LISTING_STATUSES} value={LEGACY_LISTING[property.listingStatus] || property.listingStatus} />
                {action}
            </HStack>
        </Flex>
    );

    return (
        <Stack spacing={6}>
            <Box>
                <Heading size="sm" mb={3}>BĐS khách quan tâm ({interested.length})</Heading>
                <Stack spacing={2}>
                    {interested.length === 0 && <Text fontSize="sm" color="gray.500">Chưa có BĐS nào.</Text>}
                    {interested.map((property) => row(property, (
                        <Tooltip label="Bỏ khỏi danh sách" hasArrow>
                            <IconButton size="sm" variant="ghost" colorScheme="red" icon={<DeleteIcon />} aria-label="Bỏ" onClick={() => remove(property._id)} />
                        </Tooltip>
                    )))}
                </Stack>
                <Flex mt={3} gap={2} direction={{ base: 'column', md: 'row' }}>
                    <Box flex="1">
                        <SearchSelect options={propertyOptions((properties || []).filter((p) => !ids.includes(p._id)))} value={adding} onChange={setAdding} placeholder="Chọn BĐS để thêm (mã, tiêu đề, địa chỉ)" />
                    </Box>
                    <Button leftIcon={<AddIcon />} onClick={() => { add(adding); setAdding(''); }} isDisabled={!adding}>Thêm</Button>
                </Flex>
            </Box>
            <Box>
                <Heading size="sm" mb={1}>Gợi ý BĐS phù hợp nhu cầu</Heading>
                <Text fontSize="sm" color="gray.500" mb={3}>Dựa trên nhu cầu, loại BĐS, ngân sách và khu vực quan tâm của khách; chỉ gồm BĐS còn hàng.</Text>
                {isLoading ? <Spinner /> : (
                    <Stack spacing={2}>
                        {suggestions.length === 0 && <Text fontSize="sm" color="gray.500">Chưa tìm thấy BĐS phù hợp. Hãy bổ sung nhu cầu của khách hoặc nhập thêm hàng.</Text>}
                        {suggestions.map(({ property, reasons }) => row(property, (
                            <HStack>
                                {reasons.length > 0 && <Text fontSize="xs" color="green.500" display={{ base: 'none', md: 'block' }}>{reasons.join(', ')}</Text>}
                                <Button size="sm" onClick={() => add(property._id)}>Quan tâm</Button>
                            </HStack>
                        )))}
                    </Stack>
                )}
            </Box>
        </Stack>
    );
}

// Documents are served with the session token only
const downloadDocument = async (file) => {
    try {
        await downloadFile(`api/document/download/${file._id}`, file.fileName);
    } catch (e) {
        toast.error(e.message);
    }
};

export default function ContactView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data, isLoading, error, reload } = useApiData(`api/contact/view/${id}`, { initial: null });
    const edit = useDisclosure();
    const remove = useDisclosure();
    const callForm = useDisclosure();
    const emailForm = useDisclosure();
    const meetingForm = useDisclosure();
    const taskForm = useDisclosure();
    const dealForm = useDisclosure();
    const [tabIndex, setTabIndex] = useState(0);

    const dealColumns = useMemo(() => [
        { Header: 'Mã', accessor: 'code', Cell: ({ row, value }) => <Link as={RouterLink} to={`/deals/${row.original._id}`} color="brand.500" fontWeight="700">{value || 'Xem'}</Link> },
        { Header: 'Bất động sản', id: 'property', accessor: (d) => propertyName(d.property) },
        { Header: 'Giá chốt', accessor: 'price', isNumeric: true, Cell: ({ row, value }) => formatPriceShort(value, { rent: row.original.dealType === 'rent', empty: '—' }) },
        { Header: 'Trạng thái', accessor: 'status', Cell: ({ value }) => <StatusBadge options={DEAL_STATUSES} value={value} /> },
        { Header: 'Ngày', id: 'date', accessor: (d) => d.contractDate || d.depositDate || d.createdDate, Cell: ({ value }) => formatDate(value) },
    ], []);

    if (isLoading && !data) return <Flex justify="center" py={20}><Spinner /></Flex>;
    if (error || !data?.contact) {
        return (
            <Alert status="warning" borderRadius="md">
                <AlertIcon />
                {error?.status === 404 ? 'Không tìm thấy khách hàng (có thể đã bị xóa hoặc do nhân viên khác phụ trách).' : 'Không tải được khách hàng.'}
                <Button ml="auto" size="sm" onClick={() => navigate('/contacts')}>Về danh sách</Button>
            </Alert>
        );
    }

    const contact = data.contact;
    const name = displayName(contact) || '(không tên)';
    const status = contactStatusOf(contact);
    const interested = data.interestProperty?.interestProperty || [];
    const activities = activityItems({ calls: data.phoneCallHistory, emails: data.EmailHistory, meetings: data.meetingHistory, tasks: data.task });
    const files = (data.Document || []).flatMap((folder) => (folder.files || []).map((file) => ({ ...file, folderName: folder.folderName })));

    const changeStatus = async (value) => {
        try {
            await apiPut(`api/contact/edit/${contact._id}`, { leadStatus: value });
            toast.success(`Đã chuyển sang: ${labelOf(CONTACT_STATUSES, value)}`);
            reload();
        } catch (e) {
            toast.error(e.message);
        }
    };

    const deleteContact = async () => {
        try {
            await apiDelete(`api/contact/delete/${contact._id}`);
            toast.success('Đã xóa khách hàng');
            navigate('/contacts');
        } catch (e) {
            toast.error(e.message);
            throw e;
        }
    };

    return (
        <Stack spacing={5}>
            <Card>
                <Flex direction={{ base: 'column', lg: 'row' }} justify="space-between" gap={4}>
                    <Stack spacing={2}>
                        <HStack spacing={3} flexWrap="wrap">
                            <Heading size="lg">{[contact.title, name].filter(Boolean).join(' ')}</Heading>
                            <StatusBadge options={CONTACT_STATUSES} value={status} />
                            {contact.leadRating ? <Badge colorScheme="yellow">{labelOf(RATINGS, String(contact.leadRating)).split(' ')[0]}</Badge> : null}
                        </HStack>
                        <HStack spacing={2}>
                            <Text fontSize="lg" fontWeight="600">{formatPhone(contact.phoneNumber) || 'Chưa có SĐT'}</Text>
                            <ContactActions phone={contact.phoneNumber} zalo={contact.zalo} email={contact.email} size="md" />
                        </HStack>
                        <Text color="gray.600">
                            {[labelOf(CUSTOMER_TYPES, customerTypeOf(contact)), labelOf(PROPERTY_TYPES, contact.interestedPropertyType), budgetText(contact), contact.interestedArea].filter(Boolean).join(' · ') || 'Chưa ghi nhận nhu cầu'}
                        </Text>
                    </Stack>
                    <Stack spacing={2} align={{ base: 'stretch', lg: 'flex-end' }}>
                        <Wrap spacing={2} justify={{ lg: 'flex-end' }}>
                            <WrapItem><Button size="sm" leftIcon={<MdCall />} onClick={callForm.onOpen}>Ghi cuộc gọi</Button></WrapItem>
                            <WrapItem><Button size="sm" leftIcon={<MdEventAvailable />} onClick={meetingForm.onOpen}>Đặt lịch hẹn</Button></WrapItem>
                            <WrapItem><Button size="sm" leftIcon={<MdTaskAlt />} onClick={taskForm.onOpen}>Thêm việc</Button></WrapItem>
                            <WrapItem><Button size="sm" leftIcon={<MdEmail />} onClick={emailForm.onOpen}>Ghi email</Button></WrapItem>
                            <WrapItem><Button size="sm" leftIcon={<MdHandshake />} colorScheme="green" onClick={dealForm.onOpen}>Tạo giao dịch</Button></WrapItem>
                        </Wrap>
                        <Wrap spacing={2} justify={{ lg: 'flex-end' }}>
                            <WrapItem>
                                <Menu>
                                    <MenuButton as={Button} size="sm" rightIcon={<ChevronDownIcon />} variant="outline">Tình trạng</MenuButton>
                                    <MenuList>
                                        {selectable(CONTACT_STATUSES).map((option) => (
                                            <MenuItem key={option.value} onClick={() => changeStatus(option.value)} fontWeight={option.value === status ? '700' : 'normal'}>
                                                {option.label}
                                            </MenuItem>
                                        ))}
                                    </MenuList>
                                </Menu>
                            </WrapItem>
                            <WrapItem><Button size="sm" leftIcon={<EditIcon />} variant="brand" onClick={edit.onOpen}>Sửa</Button></WrapItem>
                            <WrapItem>
                                <Tooltip label="Xóa khách hàng" hasArrow>
                                    <IconButton size="sm" icon={<DeleteIcon />} colorScheme="red" variant="outline" aria-label="Xóa" onClick={remove.onOpen} />
                                </Tooltip>
                            </WrapItem>
                        </Wrap>
                    </Stack>
                </Flex>
            </Card>

            <Card>
                <Tabs index={tabIndex} onChange={setTabIndex} colorScheme="brand" isLazy>
                    <TabList overflowX="auto" overflowY="hidden">
                        <Tab whiteSpace="nowrap">Chăm sóc ({activities.length})</Tab>
                        <Tab whiteSpace="nowrap">Thông tin</Tab>
                        <Tab whiteSpace="nowrap">BĐS quan tâm ({interested.length})</Tab>
                        <Tab whiteSpace="nowrap">Giao dịch ({data.deals?.length || 0})</Tab>
                        <Tab whiteSpace="nowrap">Tài liệu ({files.length})</Tab>
                    </TabList>
                    <TabPanels>
                        <TabPanel px={0}>
                            <ActivityTimeline items={activities} />
                        </TabPanel>
                        <TabPanel px={0}>
                            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={8}>
                                <DetailGrid
                                    title="Liên hệ"
                                    items={[
                                        { label: 'Số điện thoại', value: formatPhone(contact.phoneNumber) },
                                        { label: 'Số điện thoại khác', value: formatPhone(contact.mobileNumber), optional: true },
                                        { label: 'Zalo', value: contact.zalo, optional: true },
                                        { label: 'Email', value: contact.email },
                                        { label: 'Địa chỉ', value: contact.physicalAddress, span: 2 },
                                        { label: 'Giới tính', value: labelOf(GENDERS, contact.gender), optional: true },
                                        { label: 'Ngày sinh', value: formatDate(contact.birthday), optional: true },
                                        { label: 'Nghề nghiệp', value: contact.occupation, optional: true },
                                        { label: 'Số CCCD', value: contact.idNumber, optional: true },
                                        { label: 'Facebook', value: contact.facebookProfile ? <Link href={contact.facebookProfile} isExternal color="brand.500">{contact.facebookProfile}</Link> : '', optional: true, span: 2 },
                                    ]}
                                />
                                <DetailGrid
                                    title="Nhu cầu và chăm sóc"
                                    items={[
                                        { label: 'Nhu cầu', value: labelOf(CUSTOMER_TYPES, customerTypeOf(contact)) },
                                        { label: 'Loại BĐS quan tâm', value: labelOf(PROPERTY_TYPES, contact.interestedPropertyType) },
                                        { label: 'Ngân sách', value: budgetText(contact) },
                                        { label: 'Khu vực quan tâm', value: contact.interestedArea },
                                        { label: 'Yêu cầu khác', value: contact.preferences, span: 2, optional: true },
                                        { label: 'Nguồn khách', value: labelOf(LEAD_SOURCES, contact.leadSource) },
                                        { label: 'Người giới thiệu', value: contact.referralSource, optional: true },
                                        { label: 'Chiến dịch', value: contact.campaignSource, optional: true },
                                        { label: 'Nhân viên phụ trách', value: userName(contact.createBy) || undefined, optional: true },
                                        { label: 'Ngày tạo', value: formatDate(contact.createdDate) },
                                        { label: 'Đồng ý xử lý dữ liệu', value: contact.dataConsent ? `Có${contact.dataConsentDate ? ` (${formatDate(contact.dataConsentDate)})` : ''}` : 'Chưa ghi nhận' },
                                        { label: 'Ghi chú', value: contact.notesandComments, span: 2 },
                                    ]}
                                />
                            </SimpleGrid>
                        </TabPanel>
                        <TabPanel px={0}>
                            <InterestedProperties contact={contact} interested={interested} onChanged={reload} />
                        </TabPanel>
                        <TabPanel px={0}>
                            <DataTable
                                card={false}
                                columns={dealColumns}
                                data={data.deals || []}
                                emptyText="Khách chưa có giao dịch"
                                toolbar={<Button size="sm" leftIcon={<AddIcon />} onClick={dealForm.onOpen}>Tạo giao dịch</Button>}
                            />
                        </TabPanel>
                        <TabPanel px={0}>
                            {files.length === 0 ? (
                                <Text fontSize="sm" color="gray.500">Chưa có tài liệu. Vào mục Tài liệu để tải lên và liên kết với khách hàng.</Text>
                            ) : (
                                <Stack spacing={2}>
                                    {files.map((file) => (
                                        <Flex key={file._id} justify="space-between" borderWidth="1px" borderRadius="8px" px={3} py={2}>
                                            <Link as="button" textAlign="left" color="brand.500" noOfLines={1} onClick={() => downloadDocument(file)}>{file.fileName}</Link>
                                            <Text fontSize="sm" color="gray.500">{file.folderName} · {formatDate(file.createOn)}</Text>
                                        </Flex>
                                    ))}
                                </Stack>
                            )}
                        </TabPanel>
                    </TabPanels>
                </Tabs>
            </Card>

            <ContactForm isOpen={edit.isOpen} onClose={edit.onClose} contact={contact} onSaved={reload} />
            <CallForm isOpen={callForm.isOpen} onClose={callForm.onClose} defaults={{ createBy: contact._id, recipient: contact.phoneNumber }} onSaved={reload} />
            <EmailForm isOpen={emailForm.isOpen} onClose={emailForm.onClose} defaults={{ createBy: contact._id, recipient: contact.email }} onSaved={reload} />
            <MeetingForm isOpen={meetingForm.isOpen} onClose={meetingForm.onClose} defaults={{ attendes: [contact._id], meetingType: 'viewing', agenda: `Gặp ${name}` }} onSaved={reload} />
            <TaskForm isOpen={taskForm.isOpen} onClose={taskForm.onClose} defaults={{ assignmentTo: contact._id, title: `Chăm sóc ${name}` }} onSaved={reload} />
            <DealForm isOpen={dealForm.isOpen} onClose={dealForm.onClose} defaults={{ contact: contact._id, dealType: customerTypeOf(contact) === 'renter' ? 'rent' : 'sale' }} onSaved={reload} />
            <ConfirmDialog
                isOpen={remove.isOpen}
                onClose={remove.onClose}
                onConfirm={deleteContact}
                title="Xóa khách hàng"
                message={`Xóa khách hàng ${name}? Lịch sử chăm sóc vẫn được giữ trong các mục tương ứng.`}
                confirmLabel="Xóa"
            />
        </Stack>
    );
}
