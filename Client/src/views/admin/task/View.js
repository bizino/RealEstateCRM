import { DeleteIcon, EditIcon } from '@chakra-ui/icons';
import {
    Alert, AlertIcon, Badge, Box, Button, Flex, Heading, HStack, Icon, IconButton, Link, Spinner, Stack, Text, Tooltip,
    useDisclosure, Wrap, WrapItem,
} from '@chakra-ui/react';
import Card from 'components/card/Card';
import ConfirmDialog from 'components/crm/ConfirmDialog';
import DetailGrid from 'components/crm/DetailGrid';
import StatusBadge from 'components/crm/StatusBadge';
import { TASK_PRIORITIES, TASK_STATUSES, colorOf, labelOf } from 'constants/realEstate';
import useApiData from 'hooks/useApiData';
import { useState } from 'react';
import { MdAccessTime, MdCheckCircle, MdPerson, MdReplay } from 'react-icons/md';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiDelete, apiPut } from 'services/crm';
import { formatDateTime } from 'utils/format';
import { isHexColor, longDateTime, nearDayLabel } from 'views/admin/calender/calendarUtils';
import TaskForm from './TaskForm';
import { isTaskDone, isTaskOverdue, taskDue, taskPriorityOf, taskRelated, taskStatusOf } from './taskFields';

export default function TaskView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: task, isLoading, error, reload } = useApiData(`api/task/view/${id}`, { initial: null });
    const edit = useDisclosure();
    const remove = useDisclosure();
    const [isSaving, setIsSaving] = useState(false);

    if (isLoading && (!task || task._id !== id)) return <Flex justify="center" py={20}><Spinner /></Flex>;
    if (error || !task) {
        return (
            <Alert status="warning" borderRadius="md">
                <AlertIcon />
                {[400, 404].includes(error?.status) ? 'Không tìm thấy công việc (có thể đã bị xóa).' : 'Không tải được công việc.'}
                <Button ml="auto" size="sm" onClick={() => navigate('/tasks')}>Về danh sách</Button>
            </Alert>
        );
    }

    const done = isTaskDone(task);
    const overdue = isTaskOverdue(task);
    const related = taskRelated(task);
    const due = taskDue(task);
    const priority = taskPriorityOf(task);
    const near = due ? nearDayLabel(due.date) : '';
    const link = /^https?:\/\//i.test(task.url || '') ? task.url : '';

    const setStatus = async (status) => {
        setIsSaving(true);
        try {
            await apiPut(`api/task/edit/${task._id}`, { status });
            toast.success(status === 'done' ? 'Đã đánh dấu hoàn thành' : 'Đã mở lại công việc');
            reload();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteTask = async () => {
        try {
            await apiDelete(`api/task/delete/${task._id}`);
            toast.success('Đã xóa công việc');
            navigate('/tasks');
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
                        <WrapItem><StatusBadge options={TASK_STATUSES} value={taskStatusOf(task)} /></WrapItem>
                        <WrapItem>
                            <Badge colorScheme={colorOf(TASK_PRIORITIES, priority)} variant="outline" textTransform="none" px={2} py={0.5}>
                                Ưu tiên {labelOf(TASK_PRIORITIES, priority).toLowerCase()}
                            </Badge>
                        </WrapItem>
                        {overdue && <WrapItem><Badge colorScheme="red" variant="solid" textTransform="none" px={2} py={0.5}>Quá hạn</Badge></WrapItem>}
                    </Wrap>
                    <Heading size="lg" color={done ? 'gray.500' : undefined} textDecoration={done ? 'line-through' : undefined}>
                        {task.title || '(chưa có tiêu đề)'}
                    </Heading>
                    <Stack spacing={1.5}>
                        {due && (
                            <HStack spacing={2} align="start">
                                <Icon as={MdAccessTime} mt="3px" color={overdue ? 'red.500' : 'gray.500'} />
                                <Text fontWeight="600" color={overdue ? 'red.500' : undefined}>
                                    Hạn: {longDateTime(due.value)}{near ? ` (${near.toLowerCase()})` : ''}
                                </Text>
                            </HStack>
                        )}
                        {related && (
                            <HStack spacing={2} align="start">
                                <Icon as={MdPerson} mt="3px" color="gray.500" />
                                <Text>
                                    <Link as={RouterLink} to={related.path} color="brand.500" fontWeight="600">{related.name}</Link>
                                    <Text as="span" color="gray.500"> · {related.kind}</Text>
                                </Text>
                            </HStack>
                        )}
                    </Stack>
                    <Wrap spacing={2} pt={1}>
                        <WrapItem>
                            {done ? (
                                <Button leftIcon={<MdReplay />} onClick={() => setStatus('todo')} isLoading={isSaving}>Làm lại</Button>
                            ) : (
                                <Button leftIcon={<MdCheckCircle />} colorScheme="green" onClick={() => setStatus('done')} isLoading={isSaving}>Hoàn thành</Button>
                            )}
                        </WrapItem>
                        <WrapItem><Button leftIcon={<EditIcon />} variant="brand" onClick={edit.onOpen}>Sửa</Button></WrapItem>
                        <WrapItem>
                            <Tooltip label="Xóa công việc" hasArrow>
                                <IconButton icon={<DeleteIcon />} colorScheme="red" variant="outline" aria-label="Xóa công việc" onClick={remove.onOpen} />
                            </Tooltip>
                        </WrapItem>
                    </Wrap>
                </Stack>
            </Card>

            <Card>
                <DetailGrid
                    title="Chi tiết"
                    items={[
                        {
                            label: 'Liên quan đến',
                            value: related ? (
                                <Box>
                                    <Link as={RouterLink} to={related.path} color="brand.500">{related.name}</Link>
                                    <Text as="span" color="gray.500" fontWeight="normal"> ({related.kind})</Text>
                                </Box>
                            ) : 'Không liên kết',
                        },
                        { label: 'Trạng thái', value: labelOf(TASK_STATUSES, taskStatusOf(task)) },
                        { label: 'Bắt đầu', value: formatDateTime(task.start) },
                        {
                            label: 'Hạn hoàn thành',
                            value: task.end ? <Text as="span" color={overdue ? 'red.500' : undefined}>{formatDateTime(task.end)}</Text> : '',
                        },
                        { label: 'Hoàn thành lúc', value: done ? formatDateTime(task.completedDate) : '', optional: true },
                        { label: 'Ưu tiên', value: labelOf(TASK_PRIORITIES, priority) },
                        { label: 'Mô tả', value: task.description, span: 2 },
                        { label: 'Ghi chú', value: task.notes, span: 2, optional: true },
                        {
                            label: 'Màu trên lịch',
                            value: isHexColor(task.backgroundColor) ? <Box w="24px" h="24px" borderRadius="full" bg={task.backgroundColor} borderWidth="1px" /> : '',
                            optional: true,
                        },
                        { label: 'Liên kết', value: link ? <Link href={link} isExternal color="brand.500">{link}</Link> : '', optional: true },
                        { label: 'Người tạo', value: task.createByName },
                        { label: 'Ngày tạo', value: formatDateTime(task.createdDate) },
                    ]}
                />
            </Card>

            <TaskForm isOpen={edit.isOpen} onClose={edit.onClose} task={task} onSaved={reload} />
            <ConfirmDialog
                isOpen={remove.isOpen}
                onClose={remove.onClose}
                onConfirm={deleteTask}
                title="Xóa công việc"
                message={`Xóa công việc “${task.title || ''}”? Thao tác này không thể hoàn tác trên giao diện.`}
                confirmLabel="Xóa"
            />
        </Stack>
    );
}
