import { Box, Button, Checkbox, Icon, Input, Tooltip, Wrap, WrapItem } from '@chakra-ui/react';
import FormFields from 'components/crm/FormFields';
import FormModal from 'components/crm/FormModal';
import SearchSelect from 'components/crm/SearchSelect';
import { TASK_PRIORITIES, TASK_STATUSES } from 'constants/realEstate';
import { useFormik } from 'formik';
import useApiData from 'hooks/useApiData';
import { useMemo } from 'react';
import { MdCheck } from 'react-icons/md';
import { toast } from 'react-toastify';
import { apiPost, apiPut } from 'services/crm';
import { contactOptions, leadOptions } from 'utils/options';
import { idOf, listOf, readableTextColor } from 'views/admin/calender/calendarUtils';
import { TASK_CATEGORIES, TASK_COLORS, switchAllDay, taskInitialValues, taskPayload, taskSchema } from './taskFields';

// The contact or lead of the task may not be in the lists of the caller: its
// name (sent with the task) still shows
const withCurrent = (options, id, name) => (
    id && name && !options.some((option) => option.value === id) ? [{ value: id, label: name }, ...options] : options
);

function ColorPicker({ value, onChange }) {
    const current = (value || '').toLowerCase();
    return (
        <Wrap spacing={2} align="center">
            <WrapItem>
                <Button size="sm" variant={current ? 'outline' : 'solid'} onClick={() => onChange('')}>Mặc định</Button>
            </WrapItem>
            {TASK_COLORS.map((color) => {
                const isSelected = current === color.value.toLowerCase();
                return (
                    <WrapItem key={color.value}>
                        <Tooltip label={color.label} hasArrow>
                            <Box
                                as="button"
                                type="button"
                                aria-label={`Màu ${color.label.toLowerCase()}`}
                                aria-pressed={isSelected}
                                onClick={() => onChange(color.value)}
                                w="30px"
                                h="30px"
                                borderRadius="full"
                                bg={color.value}
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                borderWidth="2px"
                                borderColor={isSelected ? 'gray.700' : 'transparent'}
                            >
                                {isSelected && <Icon as={MdCheck} color={readableTextColor(color.value)} boxSize={4} />}
                            </Box>
                        </Tooltip>
                    </WrapItem>
                );
            })}
            <WrapItem>
                <Tooltip label="Chọn màu khác" hasArrow>
                    <Input type="color" aria-label="Chọn màu khác" value={value || '#422afb'} onChange={(e) => onChange(e.target.value)} w="48px" h="32px" p={1} cursor="pointer" />
                </Tooltip>
            </WrapItem>
        </Wrap>
    );
}

// Create (task undefined) or edit a task (from the list or the detail endpoint).
// defaults (create only): { assignmentTo, assignmentToLead, start, title }
// title (optional) replaces the title of the dialog.
export default function TaskForm({ isOpen, onClose, task, defaults, onSaved, title }) {
    const isEdit = Boolean(task?._id);
    const initialValues = useMemo(() => taskInitialValues(isEdit ? task : null, defaults), [isEdit, task, defaults]);

    const formik = useFormik({
        initialValues,
        enableReinitialize: true,
        validationSchema: taskSchema,
        onSubmit: async (values, { resetForm }) => {
            try {
                const payload = taskPayload(values, isEdit ? task : null);
                let saved;
                if (isEdit) {
                    saved = await apiPut(`api/task/edit/${task._id}`, payload);
                    toast.success('Đã cập nhật công việc');
                } else {
                    saved = await apiPost('api/task/add', payload);
                    toast.success('Đã thêm công việc');
                }
                resetForm();
                onSaved?.(saved);
                onClose();
            } catch (e) {
                toast.error(e.message);
            }
        },
    });

    // Contacts and leads are only loaded when the task is about one of them
    const { category, allDay } = formik.values;
    const { data: contacts, isLoading: contactsLoading } = useApiData('api/contact/', { enabled: isOpen && category === 'contact' });
    const { data: leads, isLoading: leadsLoading } = useApiData('api/lead/', { enabled: isOpen && category === 'lead' });

    const contactChoices = useMemo(
        () => withCurrent(contactOptions(listOf(contacts)), isEdit && idOf(task.assignmentTo), task?.assignmentToName),
        [contacts, isEdit, task],
    );
    const leadChoices = useMemo(
        () => withCurrent(leadOptions(listOf(leads)), isEdit && idOf(task.assignmentToLead), task?.assignmentToName),
        [leads, isEdit, task],
    );

    const picker = (name, options, isLoading, placeholder, emptyText) => (form) => (
        <SearchSelect
            name={name}
            options={options}
            value={form.values[name]}
            onChange={(value) => form.setFieldValue(name, value)}
            onBlur={() => form.setFieldTouched(name, true)}
            placeholder={placeholder}
            isInvalid={Boolean(form.touched[name] && form.errors[name])}
            emptyText={isLoading ? 'Đang tải...' : emptyText}
        />
    );

    const fields = [
        { name: 'title', label: 'Tiêu đề', required: true, span: 2, placeholder: 'VD: Gọi lại chị Lan báo giá căn 2PN' },
        { name: 'category', label: 'Liên quan đến', type: 'select', options: TASK_CATEGORIES, placeholder: false },
        {
            name: 'assignmentTo',
            label: 'Khách hàng',
            required: true,
            hidden: (values) => values.category !== 'contact',
            render: picker('assignmentTo', contactChoices, contactsLoading, 'Chọn khách hàng', 'Không có khách hàng phù hợp'),
        },
        {
            name: 'assignmentToLead',
            label: 'Khách tiềm năng',
            required: true,
            hidden: (values) => values.category !== 'lead',
            render: picker('assignmentToLead', leadChoices, leadsLoading, 'Chọn khách tiềm năng', 'Không có khách tiềm năng phù hợp'),
        },
        { name: 'priority', label: 'Ưu tiên', type: 'select', options: TASK_PRIORITIES, placeholder: false },
        { name: 'status', label: 'Trạng thái', type: 'select', options: TASK_STATUSES, placeholder: false },
        {
            name: 'allDay',
            type: 'checkbox',
            span: 2,
            render: (form) => (
                <Checkbox isChecked={form.values.allDay} onChange={(e) => form.setValues(switchAllDay(form.values, e.target.checked))}>
                    Cả ngày (không cần giờ cụ thể)
                </Checkbox>
            ),
        },
        { name: 'start', label: 'Bắt đầu', type: allDay ? 'date' : 'datetime' },
        { name: 'end', label: 'Hạn hoàn thành', type: allDay ? 'date' : 'datetime', help: 'Quá hạn mà chưa xong sẽ được tô đỏ' },
        { name: 'description', label: 'Mô tả', type: 'textarea', span: 2, rows: 3 },
        { name: 'notes', label: 'Ghi chú', type: 'textarea', span: 2, rows: 2 },
        {
            name: 'backgroundColor',
            label: 'Màu hiển thị trên lịch',
            span: 2,
            render: (form) => <ColorPicker value={form.values.backgroundColor} onChange={(color) => form.setFieldValue('backgroundColor', color)} />,
        },
    ];

    return (
        <FormModal
            isOpen={isOpen}
            onClose={() => { formik.resetForm(); onClose(); }}
            title={title || (isEdit ? 'Sửa công việc' : 'Thêm công việc')}
            onSubmit={formik.handleSubmit}
            isSubmitting={formik.isSubmitting}
            submitLabel={isEdit ? 'Lưu' : 'Thêm công việc'}
        >
            <FormFields formik={formik} fields={fields} />
        </FormModal>
    );
}
