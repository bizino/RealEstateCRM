import { AddIcon } from '@chakra-ui/icons';
import {
    Box, Button, Flex, Icon, IconButton, Link, Stack, Text, Tooltip, useDisclosure, Wrap, WrapItem,
} from '@chakra-ui/react';
import ConfirmDialog from 'components/crm/ConfirmDialog';
import DataTable from 'components/crm/DataTable';
import StatusBadge from 'components/crm/StatusBadge';
import { TASK_PRIORITIES, TASK_STATUSES, labelOf } from 'constants/realEstate';
import useApiData from 'hooks/useApiData';
import { useCallback, useMemo, useState } from 'react';
import { MdCheckCircle, MdReplay } from 'react-icons/md';
import { Link as RouterLink } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiDeleteMany, apiPut } from 'services/crm';
import { formatDate, formatDateTime } from 'utils/format';
import { dayLabel } from 'views/admin/calender/calendarUtils';
import TaskForm from './TaskForm';
import {
    TASK_DUE_FILTERS, isTaskDone, isTaskOverdue, taskDue, taskDueTags, taskPriorityOf, taskRelated, taskStatusOf,
} from './taskFields';

// Sort orders: tasks in progress first, done last; high priority first;
// tasks without deadline after the others
const STATUS_ORDER = { inProgress: 1, todo: 2, done: 3 };
const PRIORITY_ORDER = { high: 1, normal: 2, low: 3 };
const NO_DUE = Number.MAX_SAFE_INTEGER;
const INITIAL_SORT = [{ id: 'status', desc: false }, { id: 'due', desc: false }];

const searchTextOf = (t) => [
    t.title, t.description, t.notes, t.assignmentToName, labelOf(TASK_STATUSES, taskStatusOf(t)),
    labelOf(TASK_PRIORITIES, taskPriorityOf(t)), formatDateTime(t.start), formatDateTime(t.end),
].join(' ');

function TaskTitle({ task }) {
    const done = isTaskDone(task);
    return (
        <Box minW={{ md: '200px' }}>
            <Link
                as={RouterLink}
                to={`/tasks/${task._id}`}
                fontWeight="700"
                color={done ? 'gray.500' : 'brand.500'}
                textDecoration={done ? 'line-through' : undefined}
            >
                {task.title || '(chưa có tiêu đề)'}
            </Link>
            {task.description && <Text fontSize="xs" color="gray.500" noOfLines={2}>{task.description}</Text>}
        </Box>
    );
}

function TaskRelated({ task }) {
    const related = taskRelated(task);
    if (!related) return <Text as="span" color="gray.400">—</Text>;
    return (
        <Box>
            <Link as={RouterLink} to={related.path} color="brand.500" fontWeight="600">{related.name}</Link>
            <Text fontSize="xs" color="gray.500">{related.kind}</Text>
        </Box>
    );
}

function TaskDue({ task, align }) {
    const due = taskDue(task);
    if (!due) return <Text as="span" color="gray.400">—</Text>;
    const overdue = isTaskOverdue(task);
    return (
        <Box whiteSpace="nowrap" textAlign={align}>
            <Text color={overdue ? 'red.500' : undefined} fontWeight={overdue ? '700' : '500'}>{formatDateTime(due.value)}</Text>
            <Text fontSize="xs" color={overdue ? 'red.500' : 'gray.500'}>{overdue ? 'Quá hạn' : dayLabel(due.date)}</Text>
        </Box>
    );
}

// Marks a task done, or opens it again
function DoneToggle({ task, onChanged }) {
    const [isLoading, setIsLoading] = useState(false);
    const done = isTaskDone(task);

    const toggle = async () => {
        const status = done ? 'todo' : 'done';
        setIsLoading(true);
        try {
            await apiPut(`api/task/edit/${task._id}`, { status });
            // The row may move to another page right after: stop loading first
            setIsLoading(false);
            toast.success(done ? `Đã mở lại “${task.title || 'công việc'}”` : `Đã hoàn thành “${task.title || 'công việc'}”`);
            onChanged(task._id, status);
        } catch (e) {
            setIsLoading(false);
            toast.error(e.message);
        }
    };

    return (
        <Tooltip label={done ? 'Làm lại' : 'Đánh dấu hoàn thành'} hasArrow>
            <IconButton
                size="sm"
                variant="ghost"
                colorScheme={done ? 'gray' : 'green'}
                icon={<Icon as={done ? MdReplay : MdCheckCircle} boxSize={5} />}
                aria-label={done ? 'Làm lại' : 'Đánh dấu hoàn thành'}
                onClick={toggle}
                isLoading={isLoading}
            />
        </Tooltip>
    );
}

function TaskCard({ task, onChanged }) {
    const priority = taskPriorityOf(task);
    return (
        <Stack spacing={2}>
            <Flex justify="space-between" align="start" gap={2}>
                <TaskTitle task={task} />
                <DoneToggle task={task} onChanged={onChanged} />
            </Flex>
            <Wrap spacing={2}>
                <WrapItem><StatusBadge options={TASK_STATUSES} value={taskStatusOf(task)} /></WrapItem>
                {priority !== 'normal' && <WrapItem><StatusBadge options={TASK_PRIORITIES} value={priority} /></WrapItem>}
            </Wrap>
            <Flex justify="space-between" align="end" gap={3} fontSize="sm">
                <TaskRelated task={task} />
                <TaskDue task={task} align="right" />
            </Flex>
        </Stack>
    );
}

export default function Tasks() {
    const { data, setData, isLoading, reload } = useApiData('api/task/');
    const form = useDisclosure();
    const [toDelete, setToDelete] = useState(null);

    // Quick status change: the list is updated without loading it again
    const markStatus = useCallback((id, status) => {
        setData((tasks) => (Array.isArray(tasks)
            ? tasks.map((t) => (t._id === id ? { ...t, status, completedDate: status === 'done' ? new Date().toISOString() : undefined } : t))
            : tasks));
    }, [setData]);

    const columns = useMemo(() => [
        { Header: 'Công việc', accessor: 'title', Cell: ({ row }) => <TaskTitle task={row.original} /> },
        { Header: 'Liên quan', id: 'related', accessor: (t) => t.assignmentToName || '', Cell: ({ row }) => <TaskRelated task={row.original} /> },
        { Header: 'Hạn', id: 'due', accessor: (t) => taskDue(t)?.date.getTime() ?? NO_DUE, Cell: ({ row }) => <TaskDue task={row.original} /> },
        {
            Header: 'Ưu tiên', id: 'priority', accessor: (t) => PRIORITY_ORDER[taskPriorityOf(t)] ?? 2,
            Cell: ({ row }) => <StatusBadge options={TASK_PRIORITIES} value={taskPriorityOf(row.original)} />,
        },
        {
            Header: 'Trạng thái', id: 'status', accessor: (t) => STATUS_ORDER[taskStatusOf(t)] ?? 2,
            Cell: ({ row }) => <StatusBadge options={TASK_STATUSES} value={taskStatusOf(row.original)} />,
        },
        { Header: '', id: 'actions', disableSortBy: true, Cell: ({ row }) => <DoneToggle task={row.original} onChanged={markStatus} /> },
    ], [markStatus]);

    const exportColumns = useMemo(() => [
        { Header: 'Công việc', accessor: 'title' },
        { Header: 'Mô tả', accessor: 'description' },
        { Header: 'Liên quan', accessor: (t) => taskRelated(t)?.name || '' },
        { Header: 'Loại liên quan', accessor: (t) => taskRelated(t)?.kind || '' },
        { Header: 'Bắt đầu', accessor: (t) => formatDateTime(t.start) },
        { Header: 'Hạn hoàn thành', accessor: (t) => formatDateTime(t.end) },
        { Header: 'Ưu tiên', accessor: (t) => labelOf(TASK_PRIORITIES, taskPriorityOf(t)) },
        { Header: 'Trạng thái', accessor: (t) => labelOf(TASK_STATUSES, taskStatusOf(t)) },
        { Header: 'Quá hạn', accessor: (t) => (isTaskOverdue(t) ? 'Có' : '') },
        { Header: 'Ngày hoàn thành', accessor: (t) => formatDateTime(t.completedDate) },
        { Header: 'Ghi chú', accessor: 'notes' },
        { Header: 'Ngày tạo', accessor: (t) => formatDate(t.createdDate) },
    ], []);

    const filters = useMemo(() => [
        { id: 'status', label: 'Trạng thái', options: TASK_STATUSES, getValue: taskStatusOf },
        { id: 'priority', label: 'Ưu tiên', options: TASK_PRIORITIES, getValue: taskPriorityOf },
        { id: 'due', label: 'Hạn', options: TASK_DUE_FILTERS, getValue: (t) => taskDueTags(t) },
    ], []);

    const deleteSelected = (ids, clearSelection) => setToDelete({ ids, clearSelection });

    const confirmDelete = async () => {
        try {
            await apiDeleteMany('api/task/deleteMany', toDelete.ids);
            toast.success(`Đã xóa ${toDelete.ids.length} công việc`);
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
                title="Công việc"
                columns={columns}
                exportColumns={exportColumns}
                data={data}
                isLoading={isLoading}
                filters={filters}
                searchPlaceholder="Tìm công việc, khách, ghi chú..."
                getSearchText={searchTextOf}
                selectable
                onDeleteSelected={deleteSelected}
                exportFileName="cong-viec"
                emptyText="Chưa có công việc nào. Bấm “Thêm công việc” để ghi việc cần làm."
                initialSortBy={INITIAL_SORT}
                toolbar={<Button leftIcon={<AddIcon />} variant="brand" onClick={form.onOpen}>Thêm công việc</Button>}
                renderCard={(t) => <TaskCard task={t} onChanged={markStatus} />}
            />
            <TaskForm isOpen={form.isOpen} onClose={form.onClose} onSaved={reload} />
            <ConfirmDialog
                isOpen={Boolean(toDelete)}
                onClose={() => setToDelete(null)}
                onConfirm={confirmDelete}
                title="Xóa công việc"
                message={`Xóa ${toDelete?.ids.length || 0} công việc đã chọn?`}
                confirmLabel="Xóa"
            />
        </>
    );
}
