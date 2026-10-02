import { DeleteIcon, EditIcon, LockIcon } from '@chakra-ui/icons';
import {
    Alert, AlertIcon, Avatar, Badge, Box, Button, Flex, Heading, HStack, Icon, SimpleGrid, Spinner, Stack, Stat, StatHelpText,
    StatLabel, StatNumber, Text, useDisclosure, Wrap, WrapItem,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import ConfirmDialog from 'components/crm/ConfirmDialog';
import ContactActions from 'components/crm/ContactActions';
import DetailGrid from 'components/crm/DetailGrid';
import useApiData from 'hooks/useApiData';
import { MdArrowBack } from 'react-icons/md';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiDelete, currentUser } from 'services/crm';
import { formatDate, formatDateTime, formatNumber, formatPhone, userName } from 'utils/format';
import ChangePassword from './ChangePassword';
import UserForm from './UserForm';
import { CERTIFICATE_HELP, RoleBadge, roleLabel, roleOf } from './userFields';

function Counter({ label, value, help }) {
    return (
        <Stat borderWidth="1px" borderRadius="12px" px={4} py={3}>
            <StatLabel color="gray.500">{label}</StatLabel>
            <StatNumber fontSize="2xl">{formatNumber(value || 0, 0) || '0'}</StatNumber>
            {help && <StatHelpText mb={0}>{help}</StatHelpText>}
        </Stat>
    );
}

// Profile of an employee: admins see and manage everyone, users their own profile
export default function UserView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const me = currentUser();
    const isAdmin = me?.role === 'admin';
    const isSelf = me?._id === id;
    const { data: user, isLoading, error, reload } = useApiData(`api/user/view/${id}`, { initial: null });
    const edit = useDisclosure();
    const password = useDisclosure();
    const remove = useDisclosure();

    if (isLoading && !user) return <Flex justify="center" py={20}><Spinner /></Flex>;
    if (error || !user?._id) {
        const message = error?.status === 403
            ? 'Bạn không có quyền xem hồ sơ này.'
            : error && error.status !== 404 ? 'Không tải được hồ sơ nhân viên.' : 'Không tìm thấy nhân viên (có thể đã bị xóa).';
        return (
            <Alert status="warning" borderRadius="md" flexWrap="wrap" gap={2}>
                <AlertIcon />
                {message}
                <Button ml="auto" size="sm" onClick={() => navigate(isAdmin ? '/users' : '/dashboard')}>
                    {isAdmin ? 'Về danh sách nhân viên' : 'Về trang tổng quan'}
                </Button>
            </Alert>
        );
    }

    const name = userName(user);
    const isDeleted = Boolean(user.deleted);
    const canEdit = !isDeleted && (isSelf || isAdmin);
    const canDelete = !isDeleted && isAdmin && !isSelf && roleOf(user) !== 'admin';

    const afterEdit = () => {
        reload();
        // The top bar reads the stored user when the page changes: refresh it
        if (isSelf) navigate(location.pathname, { replace: true });
    };

    const deleteUser = async () => {
        try {
            await apiDelete(`api/user/delete/${user._id}`);
            toast.success(`Đã xóa nhân viên ${name}`);
            navigate('/users');
        } catch (e) {
            toast.error(e.message);
            throw e;
        }
    };

    return (
        <Stack spacing={5}>
            {isDeleted && (
                <Alert status="warning" borderRadius="md">
                    <AlertIcon />
                    Tài khoản này đã bị xóa và không đăng nhập được nữa.
                </Alert>
            )}
            <Card>
                <Flex direction={{ base: 'column', md: 'row' }} gap={5} align={{ base: 'flex-start', md: 'center' }}>
                    <Avatar size="xl" name={name} bg="brand.500" color="white" />
                    <Stack spacing={1} flex="1" minW={0}>
                        <Wrap spacing={2}>
                            <WrapItem><RoleBadge user={user} /></WrapItem>
                            {isSelf && <WrapItem><Badge colorScheme="green" variant="subtle" textTransform="none">Tài khoản của bạn</Badge></WrapItem>}
                        </Wrap>
                        <Heading size="lg" wordBreak="break-word">{name || '(chưa có tên)'}</Heading>
                        <Text color="gray.500">{user.position || 'Chưa có chức danh'}</Text>
                        <HStack spacing={3} flexWrap="wrap">
                            {user.phoneNumber && <Text fontWeight="600">{formatPhone(user.phoneNumber)}</Text>}
                            <ContactActions phone={user.phoneNumber} email={user.username} />
                        </HStack>
                    </Stack>
                    <Wrap spacing={2} justify={{ base: 'flex-start', md: 'flex-end' }}>
                        {canEdit && (
                            <WrapItem><Button leftIcon={<EditIcon />} variant="brand" onClick={edit.onOpen}>Sửa</Button></WrapItem>
                        )}
                        {canEdit && (
                            <WrapItem>
                                <Button leftIcon={<LockIcon />} variant="outline" onClick={password.onOpen}>
                                    {isSelf ? 'Đổi mật khẩu' : 'Đặt lại mật khẩu'}
                                </Button>
                            </WrapItem>
                        )}
                        {canDelete && (
                            <WrapItem><Button leftIcon={<DeleteIcon />} colorScheme="red" variant="outline" onClick={remove.onOpen}>Xóa</Button></WrapItem>
                        )}
                        {isAdmin && (
                            <WrapItem>
                                <Button leftIcon={<Icon as={MdArrowBack} />} variant="ghost" onClick={() => navigate('/users')}>Danh sách nhân viên</Button>
                            </WrapItem>
                        )}
                    </Wrap>
                </Flex>
            </Card>

            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={5}>
                <Box gridColumn={{ lg: 'span 2' }}>
                    <Card>
                        <DetailGrid
                            title="Thông tin nhân viên"
                            items={[
                                { label: 'Họ và tên', value: name },
                                { label: 'Email đăng nhập', value: user.username },
                                { label: 'Điện thoại', value: formatPhone(user.phoneNumber) },
                                { label: 'Chức danh', value: user.position },
                                { label: 'Vai trò', value: roleLabel(user) },
                                {
                                    label: 'Số chứng chỉ hành nghề môi giới',
                                    value: user.brokerCertificate || (
                                        <Text as="span" color="orange.500" fontWeight="normal" fontSize="sm">Chưa cập nhật. {CERTIFICATE_HELP}.</Text>
                                    ),
                                },
                                { label: 'Ngày tạo tài khoản', value: formatDate(user.createdDate) },
                                { label: 'Cập nhật lần cuối', value: formatDateTime(user.updatedDate) },
                            ]}
                        />
                    </Card>
                </Box>
                <Card>
                    <Heading size="sm" mb={3} color="gray.600">Hoạt động chăm sóc khách</Heading>
                    <Stack spacing={3}>
                        <Counter label="Cuộc gọi đã ghi nhận" value={user.outboundcall} help="Tổng số cuộc gọi đã ghi" />
                        <Counter label="Email đã ghi nhận" value={user.emailsent} help="Tổng số email đã lưu" />
                    </Stack>
                </Card>
            </SimpleGrid>

            {canEdit && <UserForm isOpen={edit.isOpen} onClose={edit.onClose} user={user} onSaved={afterEdit} />}
            {canEdit && <ChangePassword isOpen={password.isOpen} onClose={password.onClose} id={user._id} name={name} />}
            <ConfirmDialog
                isOpen={remove.isOpen}
                onClose={remove.onClose}
                onConfirm={deleteUser}
                title="Xóa nhân viên"
                message={`Xóa nhân viên ${name}? Nhân viên sẽ không đăng nhập được nữa và khách hàng, dữ liệu do họ phụ trách sẽ không còn hiển thị. Nên chuyển khách hàng cho người khác trước khi xóa.`}
                confirmLabel="Xóa"
            />
        </Stack>
    );
}
