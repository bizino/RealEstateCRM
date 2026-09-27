import { DeleteIcon, EditIcon } from '@chakra-ui/icons';
import {
    Alert, AlertIcon, Badge, Box, Button, Flex, Heading, HStack, Icon, IconButton, Link, SimpleGrid, Spinner, Stack, Text,
    Tooltip, useDisclosure, Wrap, WrapItem,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import ConfirmDialog from 'components/crm/ConfirmDialog';
import ContactActions from 'components/crm/ContactActions';
import DetailGrid from 'components/crm/DetailGrid';
import StatusBadge from 'components/crm/StatusBadge';
import { MEETING_STATUSES, MEETING_TYPES, labelOf } from 'constants/realEstate';
import useApiData from 'hooks/useApiData';
import moment from 'moment';
import { useState } from 'react';
import { MdAccessTime, MdCheckCircle, MdMap, MdPlace } from 'react-icons/md';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiDelete } from 'services/crm';
import {
    displayName, formatDateTime, formatPhone, formatPriceShort, parseDate, propertyAddress, propertyName, toNumber,
} from 'utils/format';
import { listOf, longDateTime } from 'views/admin/calender/calendarUtils';
import MeetingForm from './MeetingForm';
import { isMeetingLate, meetingStatusOf } from './meetingFields';

const mapSearchUrl = (place) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

// A customer or lead attending the meeting, with call / Zalo / email buttons
function Attendee({ name, path, kind, color, phone, zalo, email, deleted }) {
    return (
        <Flex justify="space-between" align="center" gap={3} borderWidth="1px" borderRadius="10px" px={3} py={2}>
            <Box minW={0}>
                <Wrap spacing={2} align="center">
                    <WrapItem>
                        {deleted
                            ? <Text fontWeight="700" color="gray.500">{name} (đã xóa)</Text>
                            : <Link as={RouterLink} to={path} fontWeight="700" color="brand.500">{name}</Link>}
                    </WrapItem>
                    <WrapItem><Badge colorScheme={color} variant="subtle" textTransform="none" px={2} py={0.5}>{kind}</Badge></WrapItem>
                </Wrap>
                {(phone || email) && <Text fontSize="sm" color="gray.500">{[formatPhone(phone), email].filter(Boolean).join(' · ')}</Text>}
            </Box>
            {!deleted && <ContactActions phone={phone} zalo={zalo} email={email} />}
        </Flex>
    );
}

function PropertyLink({ property }) {
    const details = [
        formatPriceShort(property.price ?? toNumber(property.listingPrice), { rent: property.transactionType === 'rent', empty: '' }),
        propertyAddress(property),
    ].filter(Boolean).join(' · ');
    return (
        <Box>
            {property.deleted
                ? <Text as="span" color="gray.500">{propertyName(property) || 'Bất động sản'} (đã xóa)</Text>
                : <Link as={RouterLink} to={`/properties/${property._id}`} color="brand.500">{propertyName(property) || 'Bất động sản'}</Link>}
            {details && <Text fontSize="sm" color="gray.500" fontWeight="normal">{details}</Text>}
        </Box>
    );
}

export default function MeetingView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: meeting, isLoading, error, reload } = useApiData(`api/meeting/view/${id}`, { initial: null });
    const form = useDisclosure();
    const remove = useDisclosure();
    // Meeting given to the form: "Đã gặp" opens it with the status already set to done
    const [editing, setEditing] = useState({ meeting: null, title: undefined });

    if (isLoading && (!meeting || meeting._id !== id)) return <Flex justify="center" py={20}><Spinner /></Flex>;
    if (error || !meeting) {
        return (
            <Alert status="warning" borderRadius="md">
                <AlertIcon />
                {[400, 404].includes(error?.status) ? 'Không tìm thấy lịch hẹn (có thể đã bị xóa).' : 'Không tải được lịch hẹn.'}
                <Button ml="auto" size="sm" onClick={() => navigate('/meetings')}>Về danh sách</Button>
            </Alert>
        );
    }

    const status = meetingStatusOf(meeting);
    const date = parseDate(meeting.dateTime);
    const contacts = listOf(meeting.attendes);
    const leads = listOf(meeting.attendesLead);
    const property = meeting.property && typeof meeting.property === 'object' ? meeting.property : null;
    const propertyMap = /^https?:\/\//i.test(property?.mapUrl || '') ? property.mapUrl : '';
    const mapUrl = meeting.location ? mapSearchUrl(meeting.location) : propertyMap;

    const openForm = (overrides, formTitle) => {
        setEditing({ meeting: { ...meeting, ...overrides }, title: formTitle });
        form.onOpen();
    };

    const deleteMeeting = async () => {
        try {
            await apiDelete(`api/meeting/delete/${meeting._id}`);
            toast.success('Đã xóa lịch hẹn');
            navigate('/meetings');
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
                        <WrapItem><StatusBadge options={MEETING_STATUSES} value={status} /></WrapItem>
                        {meeting.meetingType && (
                            <WrapItem>
                                <Badge colorScheme="purple" variant="outline" textTransform="none" px={2} py={0.5}>{labelOf(MEETING_TYPES, meeting.meetingType)}</Badge>
                            </WrapItem>
                        )}
                        {isMeetingLate(meeting) && (
                            <WrapItem><Badge colorScheme="orange" textTransform="none" px={2} py={0.5}>Chưa ghi kết quả</Badge></WrapItem>
                        )}
                    </Wrap>
                    <Heading size="lg">{meeting.agenda || 'Lịch hẹn'}</Heading>
                    <Stack spacing={1.5}>
                        <HStack spacing={2} align="start">
                            <Icon as={MdAccessTime} mt="3px" color="gray.500" />
                            <Text fontWeight="600">
                                {date ? longDateTime(meeting.dateTime) : 'Chưa có thời gian'}
                                {date && <Text as="span" color="gray.500" fontWeight="normal"> ({moment(date).locale('vi').fromNow()})</Text>}
                            </Text>
                        </HStack>
                        {meeting.location && (
                            <HStack spacing={2} align="start">
                                <Icon as={MdPlace} mt="3px" color="gray.500" />
                                <Text>{meeting.location}</Text>
                            </HStack>
                        )}
                    </Stack>
                    <Wrap spacing={2} pt={1}>
                        {status !== 'done' && (
                            <WrapItem>
                                <Button leftIcon={<MdCheckCircle />} colorScheme="green" onClick={() => openForm({ status: 'done' }, 'Ghi kết quả buổi gặp')}>
                                    Đã gặp
                                </Button>
                            </WrapItem>
                        )}
                        <WrapItem><Button leftIcon={<EditIcon />} variant="brand" onClick={() => openForm({})}>Sửa</Button></WrapItem>
                        {mapUrl && (
                            <WrapItem>
                                <Button as="a" href={mapUrl} target="_blank" rel="noopener noreferrer" leftIcon={<MdMap />} variant="outline">Bản đồ</Button>
                            </WrapItem>
                        )}
                        <WrapItem>
                            <Tooltip label="Xóa lịch hẹn" hasArrow>
                                <IconButton icon={<DeleteIcon />} colorScheme="red" variant="outline" aria-label="Xóa lịch hẹn" onClick={remove.onOpen} />
                            </Tooltip>
                        </WrapItem>
                    </Wrap>
                </Stack>
            </Card>

            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={5}>
                <Card>
                    <Heading size="sm" mb={3}>Khách tham gia ({contacts.length + leads.length})</Heading>
                    {contacts.length + leads.length === 0 ? (
                        <Text fontSize="sm" color="gray.500">Chưa chọn khách cho lịch hẹn này.</Text>
                    ) : (
                        <Stack spacing={2}>
                            {contacts.map((contact) => (
                                <Attendee
                                    key={contact._id}
                                    name={displayName(contact) || formatPhone(contact.phoneNumber) || '(không tên)'}
                                    path={`/contacts/${contact._id}`}
                                    kind="Khách hàng"
                                    color="blue"
                                    phone={contact.phoneNumber}
                                    zalo={contact.zalo}
                                    email={contact.email}
                                    deleted={contact.deleted}
                                />
                            ))}
                            {leads.map((lead) => (
                                <Attendee
                                    key={lead._id}
                                    name={lead.leadName || formatPhone(lead.leadPhoneNumber) || '(không tên)'}
                                    path={`/leads/${lead._id}`}
                                    kind="Khách tiềm năng"
                                    color="purple"
                                    phone={lead.leadPhoneNumber}
                                    email={lead.leadEmail}
                                    deleted={lead.deleted}
                                />
                            ))}
                        </Stack>
                    )}
                </Card>
                <Card>
                    <DetailGrid
                        title="Thông tin"
                        columns={1}
                        items={[
                            { label: 'Loại lịch hẹn', value: labelOf(MEETING_TYPES, meeting.meetingType) },
                            { label: 'BĐS dẫn xem', value: property ? <PropertyLink property={property} /> : '' },
                            { label: 'Người tạo', value: meeting.createdByName },
                            { label: 'Ngày tạo', value: formatDateTime(meeting.timestamp) },
                        ]}
                    />
                </Card>
            </SimpleGrid>

            <Card>
                <DetailGrid
                    title="Kết quả và ghi chú"
                    columns={1}
                    items={[
                        {
                            label: 'Kết quả / phản hồi của khách',
                            value: meeting.result || (status === 'done' ? (
                                <Button size="sm" variant="outline" leftIcon={<EditIcon />} onClick={() => openForm({}, 'Ghi kết quả buổi gặp')}>Ghi kết quả</Button>
                            ) : ''),
                        },
                        { label: 'Ghi chú', value: meeting.notes },
                    ]}
                />
            </Card>

            <MeetingForm isOpen={form.isOpen} onClose={form.onClose} meeting={editing.meeting || meeting} title={editing.title} onSaved={reload} />
            <ConfirmDialog
                isOpen={remove.isOpen}
                onClose={remove.onClose}
                onConfirm={deleteMeeting}
                title="Xóa lịch hẹn"
                message={`Xóa lịch hẹn “${meeting.agenda || ''}”? Thao tác này không thể hoàn tác trên giao diện.`}
                confirmLabel="Xóa"
            />
        </Stack>
    );
}
