import {
    Box, Button, ButtonGroup, Flex, FormControl, FormLabel, Heading, HStack, Input, SimpleGrid, Stack, Stat, StatHelpText,
    StatLabel, StatNumber, Text,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import Chart from 'components/crm/Chart';
import DataTable from 'components/crm/DataTable';
import { CONTACT_STATUSES, LEAD_SOURCES, labelOf } from 'constants/realEstate';
import useApiData from 'hooks/useApiData';
import { useMemo, useState } from 'react';
import { currentUser } from 'services/crm';
import { formatDate, formatNumber, formatPriceShort, parseDate, toDateInput, userName } from 'utils/format';
import { PERIODS, periodQuery, periodRange } from 'utils/period';

const idOf = (value) => (value && typeof value === 'object' ? value._id : value);

const inRange = (value, from, to) => {
    const date = parseDate(value);
    return Boolean(date && date >= from && date <= to);
};

const percent = (part, total) => (total ? `${formatNumber((part / total) * 100, 1)}%` : '—');

// Activity and results of each employee over the period
const performance = ({ users, contacts, leads, calls, meetings, shares, from, to }) => {
    const rows = new Map();
    const row = (id) => {
        const key = String(id);
        if (!rows.has(key)) rows.set(key, { userId: key, newContacts: 0, newLeads: 0, converted: 0, calls: 0, answered: 0, meetings: 0, deals: 0, commission: 0 });
        return rows.get(key);
    };
    contacts.filter((c) => inRange(c.createdDate, from, to)).forEach((c) => { row(idOf(c.createBy)).newContacts += 1; });
    leads.filter((l) => inRange(l.createdDate, from, to)).forEach((l) => { row(idOf(l.createBy)).newLeads += 1; });
    leads.filter((l) => inRange(l.leadConversionDate, from, to)).forEach((l) => { row(idOf(l.createBy)).converted += 1; });
    calls.filter((c) => inRange(c.startDate || c.timestamp, from, to)).forEach((c) => {
        const r = row(c.sender);
        r.calls += 1;
        if (c.callResult === 'answered' || c.callResult === 'callBack') r.answered += 1;
    });
    meetings.filter((m) => m.status === 'done' && inRange(m.dateTime || m.timestamp, from, to)).forEach((m) => { row(m.createdBy).meetings += 1; });
    shares.forEach((share) => {
        const r = row(share.userId);
        r.deals = share.deals;
        r.commission = share.commission;
    });
    const names = new Map(users.map((user) => [String(user._id), userName(user)]));
    return [...rows.values()]
        .filter((r) => names.has(r.userId))
        .map((r) => ({ ...r, _id: r.userId, name: names.get(r.userId) }))
        .sort((a, b) => b.commission - a.commission || b.newContacts + b.newLeads - (a.newContacts + a.newLeads));
};

export default function Reports() {
    const isAdmin = currentUser()?.role === 'admin';
    const initial = useMemo(() => periodRange('month'), []);
    const [fromText, setFromText] = useState(toDateInput(initial.from));
    const [toText, setToText] = useState(toDateInput(initial.to));

    const from = useMemo(() => parseDate(fromText) || initial.from, [fromText, initial]);
    const to = useMemo(() => {
        const date = parseDate(toText);
        return date ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999) : initial.to;
    }, [toText, initial]);

    const { data: summary, isLoading } = useApiData(`api/dashboard/summary?${periodQuery({ from, to })}`, { initial: null });
    const { data: users } = useApiData('api/user/options', { enabled: isAdmin });
    const { data: contacts } = useApiData('api/contact/');
    const { data: leads } = useApiData('api/lead/');
    const { data: calls } = useApiData('api/phoneCall/');
    const { data: meetings } = useApiData('api/meeting/');

    const setQuick = (value) => {
        const range = periodRange(value);
        setFromText(toDateInput(range.from));
        setToText(toDateInput(range.to));
    };

    const rows = useMemo(() => performance({
        users: isAdmin ? users || [] : [currentUser()].filter(Boolean),
        contacts: contacts || [],
        leads: leads || [],
        calls: calls || [],
        meetings: meetings || [],
        shares: summary?.commissionBySale || [],
        from,
        to,
    }), [isAdmin, users, contacts, leads, calls, meetings, summary, from, to]);

    const performanceColumns = useMemo(() => [
        { Header: 'Nhân viên', accessor: 'name' },
        { Header: 'Khách mới', id: 'newCustomers', accessor: (r) => r.newContacts + r.newLeads, isNumeric: true, csvHeader: 'Khách mới (KH + tiềm năng)' },
        { Header: 'Chuyển đổi', accessor: 'converted', isNumeric: true, csvHeader: 'Tiềm năng chuyển thành khách' },
        { Header: 'Cuộc gọi', accessor: 'calls', isNumeric: true },
        { Header: 'Nghe máy', id: 'answerRate', accessor: (r) => (r.calls ? r.answered / r.calls : 0), isNumeric: true, Cell: ({ row }) => percent(row.original.answered, row.original.calls), csv: (r) => percent(r.answered, r.calls) },
        { Header: 'Lịch hẹn đã gặp', accessor: 'meetings', isNumeric: true },
        { Header: 'Giao dịch', accessor: 'deals', isNumeric: true },
        { Header: 'Hoa hồng', accessor: 'commission', isNumeric: true, Cell: ({ value }) => <Text fontWeight="700">{formatPriceShort(value, { empty: '0' })}</Text>, csvHeader: 'Hoa hồng (VNĐ)' },
    ], []);

    const sources = summary?.leadSources || [];
    const sourceTotal = sources.reduce((sum, row) => sum + row.count, 0);
    const sourceRows = sources.map((row) => ({ ...row, _id: row.source, label: labelOf(LEAD_SOURCES, row.source) || 'Khác' }));
    const sourceColumns = useMemo(() => [
        { Header: 'Nguồn', accessor: 'label' },
        { Header: 'Số khách', accessor: 'count', isNumeric: true },
        { Header: 'Tỷ lệ', id: 'share', accessor: 'count', isNumeric: true, Cell: ({ value }) => percent(value, sourceTotal), csv: (r) => percent(r.count, sourceTotal) },
    ], [sourceTotal]);

    const monthly = (summary?.monthly || []).map((row) => ({ ...row, _id: row.month }));
    const monthlyColumns = useMemo(() => [
        { Header: 'Tháng', accessor: 'month', Cell: ({ value }) => value.split('-').reverse().join('/') },
        { Header: 'Số giao dịch', accessor: 'deals', isNumeric: true },
        { Header: 'Doanh số', accessor: 'salesValue', isNumeric: true, Cell: ({ value }) => formatPriceShort(value, { empty: '0' }), csvHeader: 'Doanh số (VNĐ)' },
        { Header: 'Hoa hồng', accessor: 'commission', isNumeric: true, Cell: ({ value }) => formatPriceShort(value, { empty: '0' }), csvHeader: 'Hoa hồng (VNĐ)' },
    ], []);

    const deals = summary?.deals;
    const funnel = (summary?.contactStatuses || []).filter((row) => row.count > 0);

    return (
        <Stack spacing={5}>
            <Card>
                <Flex gap={4} align={{ base: 'stretch', lg: 'flex-end' }} direction={{ base: 'column', lg: 'row' }} justify="space-between">
                    <HStack spacing={3} align="flex-end" flexWrap="wrap">
                        <FormControl w="auto">
                            <FormLabel fontSize="sm" mb={1}>Từ ngày</FormLabel>
                            <Input type="date" value={fromText} onChange={(e) => setFromText(e.target.value)} max={toText} />
                        </FormControl>
                        <FormControl w="auto">
                            <FormLabel fontSize="sm" mb={1}>Đến ngày</FormLabel>
                            <Input type="date" value={toText} onChange={(e) => setToText(e.target.value)} min={fromText} />
                        </FormControl>
                    </HStack>
                    <ButtonGroup size="sm" variant="outline" flexWrap="wrap" spacing={2}>
                        {PERIODS.map((option) => <Button key={option.value} onClick={() => setQuick(option.value)}>{option.label}</Button>)}
                    </ButtonGroup>
                </Flex>
                <Text mt={3} fontSize="sm" color="gray.500">
                    {isAdmin ? 'Số liệu toàn công ty' : 'Số liệu của bạn'} từ {formatDate(from)} đến {formatDate(to)}. Giao dịch được tính vào kỳ theo ngày ký hợp đồng.
                </Text>
            </Card>

            <SimpleGrid columns={{ base: 2, lg: 4 }} spacing={{ base: 3, md: 5 }}>
                {[
                    { label: 'Doanh số', value: formatPriceShort(deals?.salesValue, { empty: '0' }), help: `${deals?.closed || 0} giao dịch đã ký` },
                    { label: 'Hoa hồng', value: formatPriceShort(deals?.commission, { empty: '0' }), help: `Đã thu ${formatPriceShort(deals?.commissionReceived, { empty: '0' })}` },
                    { label: 'Khách mới', value: (summary?.contacts.new || 0) + (summary?.leads.new || 0), help: `Chuyển đổi ${summary?.leads.converted || 0} khách tiềm năng` },
                    { label: 'Đặt cọc', value: deals?.depositCount || 0, help: formatPriceShort(deals?.depositAmount, { empty: 'Chưa có' }) },
                ].map((item) => (
                    <Card key={item.label} py={4} px={5}>
                        <Stat>
                            <StatLabel color="gray.500">{item.label}</StatLabel>
                            <StatNumber fontSize={{ base: 'lg', md: '2xl' }}>{isLoading && !summary ? '…' : item.value}</StatNumber>
                            <StatHelpText mb={0}>{item.help}</StatHelpText>
                        </Stat>
                    </Card>
                ))}
            </SimpleGrid>

            <DataTable
                title="Hiệu suất nhân viên"
                columns={performanceColumns}
                data={rows}
                searchPlaceholder="Tìm nhân viên..."
                exportFileName="hieu-suat-nhan-vien"
                emptyText="Chưa có hoạt động trong kỳ"
                initialSortBy={[{ id: 'commission', desc: true }]}
            />

            <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={5}>
                <Card>
                    <Heading size="sm" mb={3}>Nguồn khách mới</Heading>
                    <Chart
                        type="pie"
                        height={260}
                        empty={!sources.length}
                        series={sources.map((row) => row.count)}
                        options={{ labels: sourceRows.map((row) => row.label), legend: { position: 'bottom' } }}
                    />
                    <Box mt={4}>
                        <DataTable card={false} columns={sourceColumns} data={sourceRows} exportFileName="nguon-khach" emptyText="Chưa có khách mới trong kỳ" />
                    </Box>
                </Card>
                <Card>
                    <Heading size="sm" mb={3}>Khách hàng theo tình trạng chăm sóc</Heading>
                    <Chart
                        type="bar"
                        height={260}
                        empty={!funnel.length}
                        series={[{ name: 'Khách hàng', data: funnel.map((row) => row.count) }]}
                        options={{
                            plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
                            colors: ['#01B574'],
                            // the counts are written on the bars
                            xaxis: { categories: funnel.map((row) => labelOf(CONTACT_STATUSES, row.status)), labels: { show: false }, axisTicks: { show: false } },
                            grid: { show: false },
                            tooltip: { y: { formatter: (value) => `${value} khách` } },
                        }}
                    />
                    <Text fontSize="sm" color="gray.500" mt={2}>Tính trên toàn bộ khách hàng hiện có (không theo kỳ).</Text>
                </Card>
            </SimpleGrid>

            <DataTable
                title="Giao dịch theo tháng (12 tháng đến hết kỳ)"
                columns={monthlyColumns}
                data={monthly}
                exportFileName="giao-dich-theo-thang"
                emptyText="Chưa có giao dịch"
                initialPageSize={20}
            />
        </Stack>
    );
}
