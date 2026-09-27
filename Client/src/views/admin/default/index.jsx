import { CheckIcon } from '@chakra-ui/icons';
import {
    Box, Button, ButtonGroup, Flex, Grid, GridItem, Heading, HStack, Icon, IconButton, Link, SimpleGrid, Stack, Text, Tooltip,
    useColorModeValue,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import Chart, { countAxis } from 'components/crm/Chart';
import StatusBadge from 'components/crm/StatusBadge';
import { CONTACT_STATUSES, LEAD_SOURCES, MEETING_TYPES, TASK_PRIORITIES, labelOf } from 'constants/realEstate';
import useApiData from 'hooks/useApiData';
import { useMemo, useState } from 'react';
import { FaHandshake } from 'react-icons/fa';
import { LuBuilding2 } from 'react-icons/lu';
import { MdAttachMoney, MdEventNote, MdPersonAdd, MdSavings } from 'react-icons/md';
import { Link as RouterLink } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiPut, currentUser } from 'services/crm';
import { formatDate, formatDateTime, formatPriceShort, parseDate, userName } from 'utils/format';
import { PERIODS, periodQuery, periodRange } from 'utils/period';
import { followUpState } from 'views/admin/lead/leadFields';

const monthLabel = (month) => {
    const [year, number] = month.split('-');
    return `T${Number(number)}/${year.slice(2)}`;
};

function Kpi({ icon, label, value, help, color = 'brand.500', to }) {
    const iconBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');
    const content = (
        <Card py={4} px={5} h="100%" _hover={to ? { boxShadow: 'lg' } : undefined}>
            <HStack spacing={4} align="center">
                <Flex boxSize="52px" borderRadius="full" bg={iconBg} align="center" justify="center" flexShrink={0}>
                    <Icon as={icon} boxSize={6} color={color} />
                </Flex>
                <Box minW={0}>
                    <Text fontSize="sm" color="gray.500" noOfLines={1}>{label}</Text>
                    <Text fontSize={{ base: 'xl', md: '2xl' }} fontWeight="800" lineHeight="1.2">{value}</Text>
                    {help && <Text fontSize="xs" color="gray.500" noOfLines={1}>{help}</Text>}
                </Box>
            </HStack>
        </Card>
    );
    return to ? <Link as={RouterLink} to={to} _hover={{ textDecoration: 'none' }}>{content}</Link> : content;
}

function Panel({ title, action, children }) {
    return (
        <Card h="100%">
            <Flex justify="space-between" align="center" mb={3}>
                <Heading size="sm">{title}</Heading>
                {action}
            </Flex>
            {children}
        </Card>
    );
}

export default function Dashboard() {
    const me = currentUser();
    const isAdmin = me?.role === 'admin';
    const [period, setPeriod] = useState('month');
    const range = useMemo(() => periodRange(period), [period]);
    const { data: summary } = useApiData(`api/dashboard/summary?${periodQuery(range)}`, { initial: null });
    const { data: meetings } = useApiData('api/meeting/');
    const { data: tasks, reload: reloadTasks } = useApiData('api/task/');
    const { data: leads } = useApiData('api/lead/');
    const { data: deals } = useApiData('api/deal/');

    // Loaded once with the page: the lists below are relative to this moment
    const now = useMemo(() => new Date(), []);
    const upcomingMeetings = useMemo(() => (meetings || [])
        .filter((meeting) => meeting.status !== 'cancelled' && meeting.status !== 'done')
        .filter((meeting) => {
            const date = parseDate(meeting.dateTime);
            return date && date >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && date <= new Date(now.getTime() + 7 * 86400000);
        })
        .sort((a, b) => parseDate(a.dateTime) - parseDate(b.dateTime))
        .slice(0, 6), [meetings, now]);

    const dueTasks = useMemo(() => (tasks || [])
        .filter((task) => task.status !== 'done')
        .filter((task) => {
            const due = parseDate(task.end || task.start);
            return due && due <= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        })
        .sort((a, b) => parseDate(a.end || a.start) - parseDate(b.end || b.start))
        .slice(0, 8), [tasks, now]);

    const followUps = useMemo(() => (leads || [])
        .filter((lead) => ['overdue', 'today'].includes(followUpState(lead)))
        .sort((a, b) => parseDate(a.leadFollowUpDate) - parseDate(b.leadFollowUpDate))
        .slice(0, 6), [leads]);

    const pendingContracts = useMemo(() => (deals || [])
        .filter((deal) => deal.status === 'deposit' && deal.contractDueDate)
        .filter((deal) => parseDate(deal.contractDueDate) <= new Date(now.getTime() + 7 * 86400000))
        .sort((a, b) => parseDate(a.contractDueDate) - parseDate(b.contractDueDate))
        .slice(0, 6), [deals, now]);

    const completeTask = async (task) => {
        try {
            await apiPut(`api/task/edit/${task._id}`, { status: 'done' });
            toast.success('Đã hoàn thành công việc');
            reloadTasks();
        } catch (e) {
            toast.error(e.message);
        }
    };

    const monthly = summary?.monthly || [];
    const sources = summary?.leadSources || [];
    const shares = summary?.commissionBySale || [];
    const statuses = (summary?.contactStatuses || []).filter((row) => row.count > 0);
    const properties = summary?.properties;
    const dealStats = summary?.deals;

    return (
        <Stack spacing={5}>
            <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={3}>
                <Box>
                    <Heading size="md">Xin chào, {userName(me)}</Heading>
                    <Text color="gray.500" fontSize="sm">{isAdmin ? 'Số liệu toàn công ty' : 'Số liệu của bạn'} · {formatDate(range.from)} – {formatDate(range.to)}</Text>
                </Box>
                <ButtonGroup size="sm" isAttached variant="outline" flexWrap="wrap">
                    {PERIODS.map((option) => (
                        <Button key={option.value} onClick={() => setPeriod(option.value)} variant={period === option.value ? 'brand' : 'outline'}>{option.label}</Button>
                    ))}
                </ButtonGroup>
            </Flex>

            <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} spacing={{ base: 3, md: 5 }}>
                <Kpi icon={MdAttachMoney} label="Doanh số" value={formatPriceShort(dealStats?.salesValue, { empty: '0' })} help={`${dealStats?.closed || 0} giao dịch đã ký`} to="/deals" />
                <Kpi icon={MdSavings} color="green.500" label="Hoa hồng" value={formatPriceShort(dealStats?.commission, { empty: '0' })} help={`Đã thu ${formatPriceShort(dealStats?.commissionReceived, { empty: '0' })}`} to="/deals" />
                <Kpi icon={MdPersonAdd} color="orange.500" label="Khách mới" value={(summary?.contacts.new || 0) + (summary?.leads.new || 0)} help={`${summary?.contacts.new || 0} khách hàng · ${summary?.leads.new || 0} tiềm năng`} to="/leads" />
                <Kpi icon={FaHandshake} color="purple.500" label="Đặt cọc trong kỳ" value={dealStats?.depositCount || 0} help={formatPriceShort(dealStats?.depositAmount, { empty: 'Chưa có tiền cọc' })} to="/deals" />
            </SimpleGrid>

            <Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap={5}>
                <GridItem minW={0}>
                    <Panel title="Giao dịch 12 tháng gần nhất" action={<Link as={RouterLink} to="/reports" fontSize="sm" color="brand.500">Xem báo cáo</Link>}>
                        <Chart
                            type="bar"
                            height={300}
                            empty={!monthly.some((row) => row.deals)}
                            emptyText="Chưa có giao dịch đã ký trong 12 tháng"
                            series={[
                                { name: 'Hoa hồng', type: 'column', data: monthly.map((row) => row.commission) },
                                { name: 'Số giao dịch', type: 'line', data: monthly.map((row) => row.deals) },
                            ]}
                            options={{
                                chart: { type: 'line', stacked: false },
                                colors: ['#422AFB', '#01B574'],
                                labels: monthly.map((row) => monthLabel(row.month)),
                                dataLabels: { enabled: false },
                                stroke: { width: [0, 3], curve: 'straight' },
                                yaxis: [
                                    { min: 0, labels: { formatter: (value) => formatPriceShort(value, { empty: '0' }) } },
                                    { opposite: true, ...countAxis(monthly.map((row) => row.deals)) },
                                ],
                                tooltip: { y: { formatter: (value, { seriesIndex }) => (seriesIndex === 0 ? formatPriceShort(value, { empty: '0' }) : `${value} giao dịch`) } },
                                legend: { position: 'top' },
                            }}
                        />
                    </Panel>
                </GridItem>
                <GridItem minW={0}>
                    <Panel title="Nguồn khách trong kỳ">
                        <Chart
                            type="donut"
                            height={300}
                            empty={!sources.length}
                            emptyText="Chưa có khách mới trong kỳ"
                            series={sources.map((row) => row.count)}
                            options={{ labels: sources.map((row) => labelOf(LEAD_SOURCES, row.source) || 'Khác'), legend: { position: 'bottom' }, dataLabels: { enabled: false } }}
                        />
                    </Panel>
                </GridItem>
            </Grid>

            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={5}>
                <Panel title="Lịch hẹn 7 ngày tới" action={<Link as={RouterLink} to="/calendar" fontSize="sm" color="brand.500">Xem lịch</Link>}>
                    {upcomingMeetings.length === 0 ? <Text fontSize="sm" color="gray.500">Không có lịch hẹn sắp tới</Text> : (
                        <Stack spacing={3}>
                            {upcomingMeetings.map((meeting) => (
                                <Flex key={meeting._id} gap={3} align="start">
                                    <Icon as={MdEventNote} color="purple.500" mt={1} />
                                    <Box minW={0}>
                                        <Link as={RouterLink} to={`/meetings/${meeting._id}`} fontWeight="700" noOfLines={1}>{meeting.agenda}</Link>
                                        <Text fontSize="sm" color="gray.500" noOfLines={1}>
                                            {[formatDateTime(meeting.dateTime), labelOf(MEETING_TYPES, meeting.meetingType), (meeting.attendesArray || []).join(', '), meeting.propertyCode].filter(Boolean).join(' · ')}
                                        </Text>
                                    </Box>
                                </Flex>
                            ))}
                        </Stack>
                    )}
                </Panel>
                <Panel title="Công việc đến hạn" action={<Link as={RouterLink} to="/tasks" fontSize="sm" color="brand.500">Tất cả</Link>}>
                    {dueTasks.length === 0 ? <Text fontSize="sm" color="gray.500">Không có việc đến hạn. Tốt lắm!</Text> : (
                        <Stack spacing={2}>
                            {dueTasks.map((task) => {
                                const overdue = parseDate(task.end || task.start) < new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                return (
                                    <Flex key={task._id} gap={2} align="center" justify="space-between">
                                        <Box minW={0}>
                                            <Link as={RouterLink} to={`/tasks/${task._id}`} fontWeight="600" noOfLines={1}>{task.title}</Link>
                                            <Text fontSize="xs" color={overdue ? 'red.500' : 'gray.500'}>
                                                {overdue ? 'Quá hạn · ' : 'Hôm nay · '}{formatDateTime(task.end || task.start)}{task.assignmentToName ? ` · ${task.assignmentToName}` : ''}
                                            </Text>
                                        </Box>
                                        <HStack flexShrink={0}>
                                            {task.priority && <StatusBadge options={TASK_PRIORITIES} value={task.priority} />}
                                            <Tooltip label="Đánh dấu hoàn thành" hasArrow>
                                                <IconButton size="sm" variant="outline" colorScheme="green" icon={<CheckIcon />} aria-label="Hoàn thành" onClick={() => completeTask(task)} />
                                            </Tooltip>
                                        </HStack>
                                    </Flex>
                                );
                            })}
                        </Stack>
                    )}
                </Panel>
                <Panel title="Khách tiềm năng cần liên hệ lại" action={<Link as={RouterLink} to="/leads" fontSize="sm" color="brand.500">Tất cả</Link>}>
                    {followUps.length === 0 ? <Text fontSize="sm" color="gray.500">Không có khách cần gọi lại hôm nay</Text> : (
                        <Stack spacing={2}>
                            {followUps.map((lead) => (
                                <Flex key={lead._id} justify="space-between" gap={2}>
                                    <Link as={RouterLink} to={`/leads/${lead._id}`} fontWeight="600" noOfLines={1}>{lead.leadName}</Link>
                                    <Text fontSize="sm" color={followUpState(lead) === 'overdue' ? 'red.500' : 'orange.500'} whiteSpace="nowrap">{formatDate(lead.leadFollowUpDate)}</Text>
                                </Flex>
                            ))}
                        </Stack>
                    )}
                </Panel>
                <Panel title="Giao dịch sắp đến hạn ký hợp đồng" action={<Link as={RouterLink} to="/deals" fontSize="sm" color="brand.500">Tất cả</Link>}>
                    {pendingContracts.length === 0 ? <Text fontSize="sm" color="gray.500">Không có giao dịch cọc sắp đến hạn ký</Text> : (
                        <Stack spacing={2}>
                            {pendingContracts.map((deal) => {
                                const late = parseDate(deal.contractDueDate) < new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                return (
                                    <Flex key={deal._id} justify="space-between" gap={2}>
                                        <Link as={RouterLink} to={`/deals/${deal._id}`} fontWeight="600" noOfLines={1}>{deal.code} · {deal.title}</Link>
                                        <Text fontSize="sm" color={late ? 'red.500' : 'orange.500'} whiteSpace="nowrap">{formatDate(deal.contractDueDate)}</Text>
                                    </Flex>
                                );
                            })}
                        </Stack>
                    )}
                </Panel>
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={5}>
                <Panel title={isAdmin ? 'Hoa hồng theo nhân viên' : 'Hoa hồng của bạn'}>
                    {shares.length === 0 ? <Text fontSize="sm" color="gray.500">Chưa có hoa hồng trong kỳ</Text> : (
                        <Stack spacing={2}>
                            {shares.slice(0, 8).map((share, index) => (
                                <Flex key={share.userId} justify="space-between" gap={2}>
                                    <Text noOfLines={1}>{index + 1}. {share.name}</Text>
                                    <Text fontWeight="700" whiteSpace="nowrap">{formatPriceShort(share.commission, { empty: '0' })}</Text>
                                </Flex>
                            ))}
                        </Stack>
                    )}
                </Panel>
                <Panel title="Khách hàng theo tình trạng">
                    <Chart
                        type="bar"
                        height={240}
                        empty={!statuses.length}
                        series={[{ name: 'Khách hàng', data: statuses.map((row) => row.count) }]}
                        options={{
                            plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
                            colors: ['#422AFB'],
                            // the counts are written on the bars
                            xaxis: { categories: statuses.map((row) => labelOf(CONTACT_STATUSES, row.status)), labels: { show: false }, axisTicks: { show: false } },
                            grid: { show: false },
                            dataLabels: { enabled: true },
                            tooltip: { y: { formatter: (value) => `${value} khách` } },
                        }}
                    />
                </Panel>
                <Panel title={isAdmin ? 'Bất động sản của công ty' : 'Bất động sản bạn phụ trách'} action={<Icon as={LuBuilding2} color="brand.500" />}>
                    <Stack spacing={2}>
                        {[
                            ['Còn hàng', properties?.byStatus.available, 'green.500'],
                            ['Đã đặt cọc', properties?.byStatus.deposited, 'orange.500'],
                            ['Đã bán', properties?.byStatus.sold, 'red.500'],
                            ['Đã cho thuê', properties?.byStatus.rented, 'purple.500'],
                            ['Tạm ngưng', properties?.byStatus.paused, 'gray.500'],
                        ].map(([label, count, color]) => (
                            <Flex key={label} justify="space-between">
                                <Text>{label}</Text>
                                <Text fontWeight="700" color={color}>{count || 0}</Text>
                            </Flex>
                        ))}
                        <Flex justify="space-between" borderTopWidth="1px" pt={2}>
                            <Text fontWeight="600">Tổng</Text>
                            <Text fontWeight="800">{properties?.total || 0}</Text>
                        </Flex>
                    </Stack>
                </Panel>
            </SimpleGrid>
        </Stack>
    );
}
