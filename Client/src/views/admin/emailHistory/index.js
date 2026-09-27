import { Button, Flex, Icon, Link, Text, useDisclosure } from '@chakra-ui/react';
import DataTable from 'components/crm/DataTable';
import useApiData from 'hooks/useApiData';
import { useMemo } from 'react';
import { MdOutlineEmail } from 'react-icons/md';
import { Link as RouterLink } from 'react-router-dom';
import { isAdminUser } from 'services/crm';
import {
    CustomerLink, activityTime, customerKindLabel, formatActivityDate, periodFilter, senderFilter,
} from 'views/admin/phoneCall/components/activity';
import EmailForm from './EmailForm';

const EmailSubject = ({ email }) => (
    <Link as={RouterLink} to={`/emails/${email._id}`} color="brand.500" fontWeight="600" noOfLines={2} minW="160px" maxW="360px">
        {email.subject || '(không có tiêu đề)'}
    </Link>
);

export default function Emails() {
    const isAdmin = isAdminUser();
    const { data, isLoading, reload } = useApiData('api/email/');
    const form = useDisclosure();
    const emails = useMemo(() => (Array.isArray(data) ? data : []), [data]);

    const columns = useMemo(() => [
        {
            Header: 'Thời gian', id: 'time', accessor: activityTime,
            Cell: ({ row }) => (
                <Link as={RouterLink} to={`/emails/${row.original._id}`} whiteSpace="nowrap">{formatActivityDate(row.original) || 'Xem'}</Link>
            ),
        },
        { Header: 'Khách', accessor: 'createByName', Cell: ({ row }) => <CustomerLink item={row.original} /> },
        {
            Header: 'Email', accessor: 'recipient',
            Cell: ({ value }) => (value ? <Link href={`mailto:${value}`} wordBreak="break-all">{value}</Link> : null),
        },
        { Header: 'Tiêu đề', accessor: 'subject', Cell: ({ row }) => <EmailSubject email={row.original} /> },
        { Header: 'Nhân viên', accessor: 'senderName', hideOnMobile: true },
    ], []);

    const exportColumns = useMemo(() => [
        { Header: 'Thời gian', accessor: formatActivityDate },
        { Header: 'Khách', accessor: (email) => email.createByName || '' },
        { Header: 'Loại khách', accessor: customerKindLabel },
        { Header: 'Email', accessor: (email) => email.recipient || '' },
        { Header: 'Tiêu đề', accessor: (email) => email.subject || '' },
        { Header: 'Nội dung', accessor: (email) => email.message || '' },
        { Header: 'Nhân viên', accessor: (email) => email.senderName || '' },
    ], []);

    const filters = useMemo(() => [periodFilter, ...(isAdmin ? [senderFilter(emails)] : [])], [isAdmin, emails]);

    return (
        <>
            <DataTable
                title="Email"
                columns={columns}
                exportColumns={exportColumns}
                data={emails}
                isLoading={isLoading}
                filters={filters}
                searchPlaceholder="Tìm tên khách, email, tiêu đề, nội dung..."
                getSearchText={(email) => [email.createByName, email.recipient, email.subject, email.message, email.senderName].join(' ')}
                exportFileName="email"
                initialSortBy={[{ id: 'time', desc: true }]}
                emptyText="Chưa có email nào. Sau khi gửi email cho khách, bấm “Ghi email” để lưu vào lịch sử chăm sóc."
                toolbar={<Button leftIcon={<Icon as={MdOutlineEmail} />} variant="brand" onClick={form.onOpen}>Ghi email</Button>}
                renderCard={(email) => (
                    <Flex direction="column" gap={1.5}>
                        <Flex justify="space-between" align="start" gap={2}>
                            <CustomerLink item={email} />
                            <Text fontSize="xs" color="gray.500" whiteSpace="nowrap">{formatActivityDate(email)}</Text>
                        </Flex>
                        <EmailSubject email={email} />
                        {email.recipient && <Text fontSize="sm" color="gray.600" wordBreak="break-all">Gửi tới: {email.recipient}</Text>}
                        {email.message && <Text fontSize="sm" noOfLines={2} color="gray.600">{email.message}</Text>}
                        {isAdmin && email.senderName && <Text fontSize="xs" color="gray.500">Nhân viên: {email.senderName}</Text>}
                    </Flex>
                )}
            />
            <EmailForm isOpen={form.isOpen} onClose={form.onClose} onSaved={reload} />
        </>
    );
}
