import {
    Alert, AlertIcon, Box, Button, Flex, Heading, HStack, Icon, Spinner, Stack, Text, useDisclosure, Wrap, WrapItem,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import ContactActions from 'components/crm/ContactActions';
import DetailGrid from 'components/crm/DetailGrid';
import StatusBadge from 'components/crm/StatusBadge';
import { CALL_RESULTS } from 'constants/realEstate';
import useApiData from 'hooks/useApiData';
import { MdAddIcCall, MdArrowBack, MdPerson, MdPhone } from 'react-icons/md';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { formatDateTime, formatPhone, telLink } from 'utils/format';
import CallForm from './CallForm';
import {
    CustomerLink, customerKindLabel, customerPath, formatActivityDate, formatCallDuration, isLeadActivity,
} from './components/activity';

export default function CallView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: call, isLoading, error } = useApiData(`api/phoneCall/view/${id}`, { initial: null });
    const form = useDisclosure();

    if (isLoading && !call) return <Flex justify="center" py={20}><Spinner /></Flex>;
    if (error || !call?._id) {
        return (
            <Alert status="warning" borderRadius="md" flexWrap="wrap" gap={2}>
                <AlertIcon />
                {error && error.status !== 404 ? 'Không tải được cuộc gọi.' : 'Không tìm thấy cuộc gọi (có thể đã bị xóa hoặc bạn không có quyền xem).'}
                <Button ml="auto" size="sm" onClick={() => navigate('/calls')}>Về danh sách</Button>
            </Alert>
        );
    }

    const path = customerPath(call);
    const customerName = call.createByName || 'khách';

    return (
        <Stack spacing={5}>
            <Card>
                <Flex direction={{ base: 'column', lg: 'row' }} justify="space-between" gap={4}>
                    <Stack spacing={2}>
                        <HStack spacing={3} flexWrap="wrap">
                            <StatusBadge options={CALL_RESULTS} value={call.callResult} />
                            <Text fontSize="sm" color="gray.500">{formatActivityDate(call)}</Text>
                        </HStack>
                        <Heading size="lg">Cuộc gọi với {customerName}</Heading>
                        {call.recipient && <Text fontSize="lg" fontWeight="600">{formatPhone(call.recipient)}</Text>}
                    </Stack>
                    <Wrap spacing={2} align="center">
                        {telLink(call.recipient) && (
                            <WrapItem>
                                <Button as="a" href={telLink(call.recipient)} leftIcon={<Icon as={MdPhone} />} colorScheme="green">Gọi lại</Button>
                            </WrapItem>
                        )}
                        <WrapItem>
                            <Button leftIcon={<Icon as={MdAddIcCall} />} variant="brand" onClick={form.onOpen}>Ghi cuộc gọi mới</Button>
                        </WrapItem>
                        {path && (
                            <WrapItem>
                                <Button as={RouterLink} to={path} leftIcon={<Icon as={MdPerson} />} variant="outline">
                                    {isLeadActivity(call) ? 'Xem khách tiềm năng' : 'Xem khách hàng'}
                                </Button>
                            </WrapItem>
                        )}
                        <WrapItem>
                            <Button leftIcon={<Icon as={MdArrowBack} />} variant="ghost" onClick={() => navigate('/calls')}>Danh sách cuộc gọi</Button>
                        </WrapItem>
                    </Wrap>
                </Flex>
            </Card>

            <Card>
                <DetailGrid
                    title="Chi tiết cuộc gọi"
                    items={[
                        { label: 'Khách', value: <CustomerLink item={call} showKind={false} /> },
                        { label: 'Loại khách', value: customerKindLabel(call) },
                        {
                            label: 'Số điện thoại',
                            value: call.recipient ? (
                                <HStack spacing={1}>
                                    <Text>{formatPhone(call.recipient)}</Text>
                                    <ContactActions phone={call.recipient} />
                                </HStack>
                            ) : '',
                        },
                        { label: 'Kết quả', value: call.callResult ? <StatusBadge options={CALL_RESULTS} value={call.callResult} /> : '' },
                        { label: 'Thời gian gọi', value: formatActivityDate(call) },
                        { label: 'Thời lượng', value: formatCallDuration(call.callDuration) },
                        { label: 'Nhân viên', value: call.senderName },
                        { label: 'Ghi nhận lúc', value: formatDateTime(call.timestamp) },
                        {
                            label: 'Nội dung trao đổi',
                            value: call.callNotes ? <Box fontWeight="normal">{call.callNotes}</Box> : '',
                            span: 2,
                        },
                    ]}
                />
            </Card>

            <CallForm
                isOpen={form.isOpen}
                onClose={form.onClose}
                defaults={{ createBy: call.createBy, createByLead: call.createByLead, recipient: call.recipient }}
                onSaved={(created) => { if (created?._id) navigate(`/calls/${created._id}`); }}
            />
        </Stack>
    );
}
