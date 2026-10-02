import { ChevronDownIcon, DeleteIcon, EditIcon } from '@chakra-ui/icons';
import {
    Alert, AlertIcon, Button, Flex, Heading, HStack, IconButton, Link, Menu, MenuButton, MenuItem, MenuList, SimpleGrid,
    Spinner, Stack, Tab, TabList, TabPanel, TabPanels, Tabs, Text, Tooltip, useDisclosure, Wrap, WrapItem,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import ActivityTimeline, { activityItems } from 'components/crm/ActivityTimeline';
import ConfirmDialog from 'components/crm/ConfirmDialog';
import ContactActions from 'components/crm/ContactActions';
import DetailGrid from 'components/crm/DetailGrid';
import StatusBadge from 'components/crm/StatusBadge';
import { CUSTOMER_TYPES, LEAD_SOURCES, LEAD_STATUSES, PROPERTY_TYPES, labelOf, selectable } from 'constants/realEstate';
import useApiData from 'hooks/useApiData';
import { useState } from 'react';
import { MdCall, MdEmail, MdEventAvailable, MdPersonAdd, MdTaskAlt } from 'react-icons/md';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiDelete, apiPost, apiPut, downloadFile } from 'services/crm';
import { formatDate, formatPhone, userName } from 'utils/format';
import { budgetText } from 'views/admin/contact/contactFields';
import EmailForm from 'views/admin/emailHistory/EmailForm';
import MeetingForm from 'views/admin/meeting/MeetingForm';
import CallForm from 'views/admin/phoneCall/CallForm';
import TaskForm from 'views/admin/task/TaskForm';
import LeadForm from './LeadForm';
import { followUpState } from './leadFields';

// Documents are served with the session token only
const downloadDocument = async (file) => {
    try {
        await downloadFile(`api/document/download/${file._id}`, file.fileName);
    } catch (e) {
        toast.error(e.message);
    }
};

export default function LeadView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data, isLoading, error, reload } = useApiData(`api/lead/view/${id}`, { initial: null });
    const edit = useDisclosure();
    const remove = useDisclosure();
    const convert = useDisclosure();
    const callForm = useDisclosure();
    const emailForm = useDisclosure();
    const meetingForm = useDisclosure();
    const taskForm = useDisclosure();
    const [tabIndex, setTabIndex] = useState(0);

    if (isLoading && !data) return <Flex justify="center" py={20}><Spinner /></Flex>;
    if (error || !data?.lead) {
        return (
            <Alert status="warning" borderRadius="md">
                <AlertIcon />
                {error?.status === 404 ? 'Không tìm thấy khách tiềm năng (có thể đã bị xóa hoặc do nhân viên khác phụ trách).' : 'Không tải được khách tiềm năng.'}
                <Button ml="auto" size="sm" onClick={() => navigate('/leads')}>Về danh sách</Button>
            </Alert>
        );
    }

    const lead = data.lead;
    const name = lead.leadName || '(không tên)';
    const status = lead.leadStatus || 'new';
    const converted = status === 'converted' && lead.convertedContact;
    const activities = activityItems({ calls: data.phoneCall, emails: data.Email, meetings: data.meeting, tasks: data.task });
    const files = (data.Document || []).flatMap((folder) => (folder.files || []).map((file) => ({ ...file, folderName: folder.folderName })));
    const followUp = followUpState(lead);

    const changeStatus = async (value) => {
        try {
            await apiPut(`api/lead/edit/${lead._id}`, { leadStatus: value });
            toast.success(`Đã chuyển sang: ${labelOf(LEAD_STATUSES, value)}`);
            reload();
        } catch (e) {
            toast.error(e.message);
        }
    };

    const convertLead = async () => {
        try {
            const result = await apiPost(`api/lead/convert/${lead._id}`);
            toast.success(result.existing ? 'Đã gộp vào khách hàng có sẵn cùng số điện thoại' : 'Đã chuyển thành khách hàng');
            navigate(`/contacts/${result.contact._id}`);
        } catch (e) {
            toast.error(e.message);
            throw e;
        }
    };

    const deleteLead = async () => {
        try {
            await apiDelete(`api/lead/delete/${lead._id}`);
            toast.success('Đã xóa khách tiềm năng');
            navigate('/leads');
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
                            <Heading size="lg">{name}</Heading>
                            <StatusBadge options={LEAD_STATUSES} value={status} />
                        </HStack>
                        <HStack spacing={2}>
                            <Text fontSize="lg" fontWeight="600">{formatPhone(lead.leadPhoneNumber) || 'Chưa có SĐT'}</Text>
                            <ContactActions phone={lead.leadPhoneNumber} email={lead.leadEmail} size="md" />
                        </HStack>
                        <Text color="gray.600">
                            {[labelOf(LEAD_SOURCES, lead.leadSource), lead.leadCampaign, `nhận ngày ${formatDate(lead.createdDate)}`].filter(Boolean).join(' · ')}
                        </Text>
                        {lead.leadFollowUpDate && followUp !== 'none' && (
                            <Text color={followUp === 'overdue' ? 'red.500' : followUp === 'today' ? 'orange.500' : 'gray.600'} fontWeight="600">
                                Hẹn liên hệ lại: {formatDate(lead.leadFollowUpDate)}{lead.leadNextAction ? ` – ${lead.leadNextAction}` : ''}
                            </Text>
                        )}
                    </Stack>
                    <Stack spacing={2} align={{ base: 'stretch', lg: 'flex-end' }}>
                        <Wrap spacing={2} justify={{ lg: 'flex-end' }}>
                            {converted ? (
                                <WrapItem>
                                    <Button as={RouterLink} to={`/contacts/${lead.convertedContact}`} colorScheme="green" leftIcon={<MdPersonAdd />}>Xem khách hàng</Button>
                                </WrapItem>
                            ) : (
                                <WrapItem>
                                    <Button colorScheme="green" leftIcon={<MdPersonAdd />} onClick={convert.onOpen}>Chuyển thành khách hàng</Button>
                                </WrapItem>
                            )}
                        </Wrap>
                        <Wrap spacing={2} justify={{ lg: 'flex-end' }}>
                            <WrapItem><Button size="sm" leftIcon={<MdCall />} onClick={callForm.onOpen}>Ghi cuộc gọi</Button></WrapItem>
                            <WrapItem><Button size="sm" leftIcon={<MdEventAvailable />} onClick={meetingForm.onOpen}>Đặt lịch hẹn</Button></WrapItem>
                            <WrapItem><Button size="sm" leftIcon={<MdTaskAlt />} onClick={taskForm.onOpen}>Thêm việc</Button></WrapItem>
                            <WrapItem><Button size="sm" leftIcon={<MdEmail />} onClick={emailForm.onOpen}>Ghi email</Button></WrapItem>
                        </Wrap>
                        <Wrap spacing={2} justify={{ lg: 'flex-end' }}>
                            {!converted && (
                                <WrapItem>
                                    <Menu>
                                        <MenuButton as={Button} size="sm" rightIcon={<ChevronDownIcon />} variant="outline">Tình trạng</MenuButton>
                                        <MenuList>
                                            {selectable(LEAD_STATUSES).filter((option) => option.value !== 'converted').map((option) => (
                                                <MenuItem key={option.value} onClick={() => changeStatus(option.value)} fontWeight={option.value === status ? '700' : 'normal'}>
                                                    {option.label}
                                                </MenuItem>
                                            ))}
                                        </MenuList>
                                    </Menu>
                                </WrapItem>
                            )}
                            <WrapItem><Button size="sm" leftIcon={<EditIcon />} variant="brand" onClick={edit.onOpen}>Sửa</Button></WrapItem>
                            <WrapItem>
                                <Tooltip label="Xóa khách tiềm năng" hasArrow>
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
                                        { label: 'Số điện thoại', value: formatPhone(lead.leadPhoneNumber) },
                                        { label: 'Email', value: lead.leadEmail },
                                        { label: 'Địa chỉ', value: lead.leadAddress, span: 2 },
                                        { label: 'Nguồn', value: labelOf(LEAD_SOURCES, lead.leadSource) },
                                        { label: 'Chiến dịch', value: lead.leadCampaign },
                                        { label: 'Nhân viên phụ trách', value: userName(lead.createBy), optional: true },
                                        { label: 'Ngày nhận', value: formatDate(lead.createdDate) },
                                        { label: 'Ngày chuyển thành khách hàng', value: formatDate(lead.leadConversionDate), optional: true },
                                    ]}
                                />
                                <DetailGrid
                                    title="Nhu cầu và chăm sóc"
                                    items={[
                                        { label: 'Nhu cầu', value: labelOf(CUSTOMER_TYPES, lead.customerType) },
                                        { label: 'Loại BĐS quan tâm', value: labelOf(PROPERTY_TYPES, lead.interestedPropertyType) },
                                        { label: 'Ngân sách', value: budgetText(lead) },
                                        { label: 'Khu vực quan tâm', value: lead.interestedArea },
                                        { label: 'Hẹn liên hệ lại', value: formatDate(lead.leadFollowUpDate) },
                                        { label: 'Việc cần làm tiếp', value: lead.leadNextAction },
                                        { label: 'Ghi chú', value: lead.leadNotes, span: 2 },
                                    ]}
                                />
                            </SimpleGrid>
                        </TabPanel>
                        <TabPanel px={0}>
                            {files.length === 0 ? (
                                <Text fontSize="sm" color="gray.500">Chưa có tài liệu. Vào mục Tài liệu để tải lên và liên kết với khách tiềm năng.</Text>
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

            <LeadForm isOpen={edit.isOpen} onClose={edit.onClose} lead={lead} onSaved={reload} />
            <CallForm isOpen={callForm.isOpen} onClose={callForm.onClose} defaults={{ createByLead: lead._id, recipient: lead.leadPhoneNumber }} onSaved={reload} />
            <EmailForm isOpen={emailForm.isOpen} onClose={emailForm.onClose} defaults={{ createByLead: lead._id, recipient: lead.leadEmail }} onSaved={reload} />
            <MeetingForm isOpen={meetingForm.isOpen} onClose={meetingForm.onClose} defaults={{ attendesLead: [lead._id], meetingType: 'consulting', agenda: `Gặp ${name}` }} onSaved={reload} />
            <TaskForm isOpen={taskForm.isOpen} onClose={taskForm.onClose} defaults={{ assignmentToLead: lead._id, title: `Liên hệ lại ${name}` }} onSaved={reload} />
            <ConfirmDialog
                isOpen={convert.isOpen}
                onClose={convert.onClose}
                onConfirm={convertLead}
                title="Chuyển thành khách hàng"
                message={`Chuyển ${name} thành khách hàng? Nhu cầu, ghi chú và lịch sử chăm sóc được giữ lại. Nếu số điện thoại đã có khách hàng, hệ thống sẽ gộp vào khách hàng đó.`}
                confirmLabel="Chuyển"
                colorScheme="green"
            />
            <ConfirmDialog
                isOpen={remove.isOpen}
                onClose={remove.onClose}
                onConfirm={deleteLead}
                title="Xóa khách tiềm năng"
                message={`Xóa khách tiềm năng ${name}?`}
                confirmLabel="Xóa"
            />
        </Stack>
    );
}
