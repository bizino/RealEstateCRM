import {
    Avatar, Badge, Box, Button, Flex, HStack, Icon, Link, Text, useDisclosure,
} from '@chakra-ui/react';
import ConfirmDialog from 'components/crm/ConfirmDialog';
import ContactActions from 'components/crm/ContactActions';
import DataTable from 'components/crm/DataTable';
import useApiData from 'hooks/useApiData';
import { useMemo, useState } from 'react';
import { MdPersonAdd } from 'react-icons/md';
import { Link as RouterLink } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiDeleteMany, currentUser } from 'services/crm';
import { formatDate, formatPhone, userName } from 'utils/format';
import UserForm from './UserForm';
import { ROLES, RoleBadge, roleLabel, roleOf } from './userFields';

const UserTitle = ({ user, isMe, showPosition = false }) => (
    <HStack spacing={3} minW={{ md: '200px' }}>
        <Avatar size="sm" name={userName(user)} bg="brand.500" color="white" />
        <Box>
            <Link as={RouterLink} to={`/users/${user._id}`} fontWeight="700" color="brand.500">
                {userName(user) || '(chưa có tên)'}
            </Link>
            {isMe && <Badge ml={2} colorScheme="green" variant="subtle" textTransform="none">Bạn</Badge>}
            {showPosition && user.position && <Text fontSize="xs" color="gray.500">{user.position}</Text>}
        </Box>
    </HStack>
);

const MissingCertificate = () => <Text as="span" color="orange.500" fontSize="sm">Chưa cập nhật</Text>;

export default function Users() {
    const me = currentUser();
    const myId = me?._id;
    const { data, isLoading, reload } = useApiData('api/user/');
    const form = useDisclosure();
    const [toDelete, setToDelete] = useState(null);
    // GET api/user/ answers { user: [...] }
    const users = useMemo(() => (Array.isArray(data) ? data : data?.user || []), [data]);

    const columns = useMemo(() => [
        { Header: 'Họ tên', id: 'name', accessor: (user) => userName(user), Cell: ({ row }) => <UserTitle user={row.original} isMe={row.original._id === myId} /> },
        { Header: 'Email đăng nhập', accessor: 'username', Cell: ({ value }) => <Text wordBreak="break-all">{value}</Text> },
        {
            Header: 'Điện thoại', id: 'phone', accessor: (user) => formatPhone(user.phoneNumber),
            Cell: ({ row, value }) => (value ? (
                <HStack spacing={1}>
                    <Text whiteSpace="nowrap">{value}</Text>
                    <ContactActions phone={row.original.phoneNumber} />
                </HStack>
            ) : null),
        },
        { Header: 'Chức danh', accessor: 'position', hideOnMobile: true },
        { Header: 'Vai trò', id: 'role', accessor: (user) => roleLabel(user), Cell: ({ row }) => <RoleBadge user={row.original} /> },
        {
            Header: 'Chứng chỉ môi giới', accessor: 'brokerCertificate', hideOnMobile: true,
            Cell: ({ value }) => (value ? <Text>{value}</Text> : <MissingCertificate />),
        },
    ], [myId]);

    const exportColumns = useMemo(() => [
        { Header: 'Họ tên', accessor: (user) => userName(user) },
        { Header: 'Email đăng nhập', accessor: (user) => user.username || '' },
        { Header: 'Điện thoại', accessor: (user) => formatPhone(user.phoneNumber) },
        { Header: 'Chức danh', accessor: (user) => user.position || '' },
        { Header: 'Vai trò', accessor: (user) => roleLabel(user) },
        { Header: 'Số chứng chỉ hành nghề môi giới', accessor: (user) => user.brokerCertificate || '' },
        { Header: 'Cuộc gọi đã ghi', accessor: (user) => user.outboundcall ?? 0 },
        { Header: 'Email đã ghi', accessor: (user) => user.emailsent ?? 0 },
        { Header: 'Ngày tạo', accessor: (user) => formatDate(user.createdDate) },
    ], []);

    const filters = useMemo(() => [
        { id: 'role', label: 'Vai trò', options: ROLES.map(({ value, label }) => ({ value, label })), getValue: roleOf },
        {
            id: 'certificate', label: 'Chứng chỉ',
            options: [{ value: 'yes', label: 'Đã có chứng chỉ' }, { value: 'no', label: 'Chưa có chứng chỉ' }],
            getValue: (user) => (user.brokerCertificate ? 'yes' : 'no'),
        },
    ], []);

    // Admin accounts (and your own) cannot be deleted
    const deletableIds = (ids) => ids.filter((id) => {
        const user = users.find((item) => item._id === id);
        return user && roleOf(user) !== 'admin' && user._id !== myId;
    });
    const deleteCount = toDelete ? deletableIds(toDelete.ids).length : 0;
    const keptCount = toDelete ? toDelete.ids.length - deleteCount : 0;

    const askDelete = (ids, clearSelection) => {
        if (!deletableIds(ids).length) {
            toast.error('Không thể xóa tài khoản quản trị viên hoặc tài khoản của bạn');
            return;
        }
        setToDelete({ ids, clearSelection });
    };

    const confirmDelete = async () => {
        const ids = deletableIds(toDelete.ids);
        try {
            await apiDeleteMany('api/user/deleteMany', ids);
            toast.success(`Đã xóa ${ids.length} nhân viên`);
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
                title="Nhân viên"
                columns={columns}
                exportColumns={exportColumns}
                data={users}
                isLoading={isLoading}
                filters={filters}
                searchPlaceholder="Tìm tên, email, số điện thoại, chức danh..."
                getSearchText={(user) => [userName(user), user.username, user.phoneNumber, formatPhone(user.phoneNumber), user.position, user.brokerCertificate].join(' ')}
                selectable
                onDeleteSelected={askDelete}
                exportFileName="nhan-vien"
                initialSortBy={[{ id: 'name', desc: false }]}
                emptyText="Chưa có nhân viên nào. Bấm “Thêm nhân viên” để tạo tài khoản."
                toolbar={<Button leftIcon={<Icon as={MdPersonAdd} />} variant="brand" onClick={form.onOpen}>Thêm nhân viên</Button>}
                renderCard={(user) => (
                    <Flex direction="column" gap={2}>
                        <Flex justify="space-between" align="start" gap={2}>
                            <UserTitle user={user} isMe={user._id === myId} showPosition />
                            <RoleBadge user={user} />
                        </Flex>
                        <Text fontSize="sm" color="gray.600" wordBreak="break-all">{user.username}</Text>
                        <Flex justify="space-between" align="center" gap={2}>
                            <Box>
                                <Text fontSize="sm" fontWeight="600">{formatPhone(user.phoneNumber) || 'Chưa có số điện thoại'}</Text>
                                <Text fontSize="xs" color="gray.500">
                                    Chứng chỉ môi giới: {user.brokerCertificate || <MissingCertificate />}
                                </Text>
                            </Box>
                            <ContactActions phone={user.phoneNumber} email={user.username} size="md" />
                        </Flex>
                    </Flex>
                )}
            />
            <UserForm isOpen={form.isOpen} onClose={form.onClose} onSaved={reload} />
            <ConfirmDialog
                isOpen={Boolean(toDelete)}
                onClose={() => setToDelete(null)}
                onConfirm={confirmDelete}
                title="Xóa nhân viên"
                message={`Xóa ${deleteCount} nhân viên đã chọn?${keptCount ? ` ${keptCount} tài khoản quản trị viên (hoặc tài khoản của bạn) sẽ được giữ lại.` : ''} Nhân viên bị xóa sẽ không đăng nhập được nữa và khách hàng, dữ liệu do họ phụ trách sẽ không còn hiển thị. Nên chuyển khách hàng cho người khác trước khi xóa.`}
                confirmLabel="Xóa"
            />
        </>
    );
}
