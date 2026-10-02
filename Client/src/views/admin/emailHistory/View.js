import {
    Alert, AlertIcon, Box, Button, Flex, Heading, Icon, Link, Spinner, Stack, Text, useColorModeValue, useDisclosure, Wrap, WrapItem,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import DetailGrid from 'components/crm/DetailGrid';
import useApiData from 'hooks/useApiData';
import { MdArrowBack, MdOutlineEmail, MdPerson, MdSend } from 'react-icons/md';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { currentUser } from 'services/crm';
import { formatDateTime, userName } from 'utils/format';
import {
    CustomerLink, customerKindLabel, customerPath, formatActivityDate, isLeadActivity,
} from 'views/admin/phoneCall/components/activity';
import EmailForm from './EmailForm';

export default function EmailView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const me = currentUser();
    const isAdmin = me?.role === 'admin';
    const { data: email, isLoading, error } = useApiData(`api/email/view/${id}`, { initial: null });
    // The detail endpoint only gives the login email of the employee: admins get the name from the list of employees
    const { data: users } = useApiData('api/user/options', { enabled: isAdmin });
    const form = useDisclosure();
    const messageBg = useColorModeValue('gray.50', 'whiteAlpha.100');

    if (isLoading && !email) return <Flex justify="center" py={20}><Spinner /></Flex>;
    if (error || !email?._id) {
        return (
            <Alert status="warning" borderRadius="md" flexWrap="wrap" gap={2}>
                <AlertIcon />
                {error && error.status !== 404 ? 'Không tải được email.' : 'Không tìm thấy email (có thể đã bị xóa hoặc bạn không có quyền xem).'}
                <Button ml="auto" size="sm" onClick={() => navigate('/emails')}>Về danh sách</Button>
            </Alert>
        );
    }

    const sender = String(email.sender || '') === me?._id ? me : (Array.isArray(users) ? users : []).find((user) => user._id === String(email.sender));
    const senderName = email.senderName || userName(sender) || email.senderEmail || '';
    const path = customerPath(email);

    return (
        <Stack spacing={5}>
            <Card>
                <Flex direction={{ base: 'column', lg: 'row' }} justify="space-between" gap={4}>
                    <Stack spacing={2} minW={0}>
                        <Text fontSize="sm" color="gray.500">{formatActivityDate(email)}</Text>
                        <Heading size="lg" wordBreak="break-word">{email.subject || '(không có tiêu đề)'}</Heading>
                        <Text color="gray.600" wordBreak="break-all">Gửi tới: {email.recipient || '—'}</Text>
                    </Stack>
                    <Wrap spacing={2} align="center">
                        {email.recipient && (
                            <WrapItem>
                                <Button as="a" href={`mailto:${email.recipient}`} leftIcon={<Icon as={MdSend} />} variant="outline">Gửi email</Button>
                            </WrapItem>
                        )}
                        <WrapItem>
                            <Button leftIcon={<Icon as={MdOutlineEmail} />} variant="brand" onClick={form.onOpen}>Ghi email mới</Button>
                        </WrapItem>
                        {path && (
                            <WrapItem>
                                <Button as={RouterLink} to={path} leftIcon={<Icon as={MdPerson} />} variant="outline">
                                    {isLeadActivity(email) ? 'Xem khách tiềm năng' : 'Xem khách hàng'}
                                </Button>
                            </WrapItem>
                        )}
                        <WrapItem>
                            <Button leftIcon={<Icon as={MdArrowBack} />} variant="ghost" onClick={() => navigate('/emails')}>Danh sách email</Button>
                        </WrapItem>
                    </Wrap>
                </Flex>
            </Card>

            <Card>
                <Stack spacing={6}>
                    <DetailGrid
                        title="Thông tin"
                        items={[
                            { label: 'Khách', value: <CustomerLink item={email} showKind={false} /> },
                            { label: 'Loại khách', value: customerKindLabel(email) },
                            { label: 'Gửi tới', value: email.recipient ? <Link href={`mailto:${email.recipient}`} color="brand.500">{email.recipient}</Link> : '' },
                            { label: 'Thời gian gửi', value: formatActivityDate(email) },
                            { label: 'Nhân viên', value: senderName },
                            { label: 'Ghi nhận lúc', value: formatDateTime(email.timestamp) },
                        ]}
                    />
                    <Box>
                        <Heading size="sm" mb={3} color="gray.600">Nội dung</Heading>
                        {email.message ? (
                            <Box bg={messageBg} borderRadius="12px" p={4} whiteSpace="pre-wrap" wordBreak="break-word">{email.message}</Box>
                        ) : (
                            <Text color="gray.400">Không có nội dung</Text>
                        )}
                    </Box>
                </Stack>
            </Card>

            <EmailForm
                isOpen={form.isOpen}
                onClose={form.onClose}
                defaults={{ createBy: email.createBy, createByLead: email.createByLead, recipient: email.recipient }}
                onSaved={(created) => { if (created?._id) navigate(`/emails/${created._id}`); }}
            />
        </Stack>
    );
}
