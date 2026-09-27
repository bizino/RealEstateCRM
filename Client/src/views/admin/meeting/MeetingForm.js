import FormFields from 'components/crm/FormFields';
import FormModal from 'components/crm/FormModal';
import MultiSearchSelect from 'components/crm/MultiSearchSelect';
import SearchSelect from 'components/crm/SearchSelect';
import { MEETING_STATUSES, MEETING_TYPES } from 'constants/realEstate';
import { useFormik } from 'formik';
import useApiData from 'hooks/useApiData';
import { useMemo } from 'react';
import { toast } from 'react-toastify';
import { apiPost, apiPut } from 'services/crm';
import { propertyAddress } from 'utils/format';
import { contactOptions, leadOptions, propertyOptions } from 'utils/options';
import { listOf } from 'views/admin/calender/calendarUtils';
import { meetingInitialValues, meetingPayload, meetingSchema } from './meetingFields';

// Records of the meeting sent as documents by the detail endpoint which are not
// in the lists of the caller: added to the options so their names still show
const withReferences = (options, references, toOptions) => {
    const missing = references.filter((item) => item && typeof item === 'object' && item._id && !options.some((option) => option.value === item._id));
    return missing.length ? [...options, ...toOptions(missing)] : options;
};

// Create (meeting undefined) or edit a meeting (from the list or the detail
// endpoint). defaults (create only):
// { attendes: [contactId], attendesLead: [leadId], property, meetingType, agenda, location, dateTime }
// title (optional) replaces the title of the dialog.
export default function MeetingForm({ isOpen, onClose, meeting, defaults, onSaved, title }) {
    const isEdit = Boolean(meeting?._id);
    const { data: contacts, isLoading: contactsLoading } = useApiData('api/contact/', { enabled: isOpen });
    const { data: leads, isLoading: leadsLoading } = useApiData('api/lead/', { enabled: isOpen });
    const { data: properties } = useApiData('api/property/', { enabled: isOpen });

    const initialValues = useMemo(() => meetingInitialValues(isEdit ? meeting : null, defaults), [isEdit, meeting, defaults]);

    const formik = useFormik({
        initialValues,
        enableReinitialize: true,
        validationSchema: meetingSchema,
        onSubmit: async (values, { resetForm }) => {
            try {
                const payload = meetingPayload(values, { isEdit });
                let saved;
                if (isEdit) {
                    saved = await apiPut(`api/meeting/edit/${meeting._id}`, payload);
                    toast.success('Đã cập nhật lịch hẹn');
                } else {
                    saved = await apiPost('api/meeting/add', payload);
                    toast.success('Đã đặt lịch hẹn');
                }
                resetForm();
                onSaved?.(saved);
                onClose();
            } catch (e) {
                toast.error(e.message);
            }
        },
    });

    const contactChoices = useMemo(
        () => withReferences(contactOptions(listOf(contacts)), isEdit ? listOf(meeting.attendes) : [], contactOptions),
        [contacts, isEdit, meeting],
    );
    const leadChoices = useMemo(
        () => withReferences(leadOptions(listOf(leads)), isEdit ? listOf(meeting.attendesLead) : [], leadOptions),
        [leads, isEdit, meeting],
    );
    const propertyChoices = useMemo(
        () => withReferences(propertyOptions(listOf(properties)), isEdit && meeting.property ? [meeting.property] : [], propertyOptions),
        [properties, isEdit, meeting],
    );

    // The address of the property is where the customer is taken, unless a place was typed
    const chooseProperty = (id) => {
        formik.setFieldValue('property', id);
        const property = listOf(properties).find((item) => item._id === id);
        if (property && !formik.values.location.trim()) formik.setFieldValue('location', propertyAddress(property));
    };

    const fields = [
        { name: 'agenda', label: 'Nội dung', required: true, span: 2, placeholder: 'VD: Dẫn khách xem căn hộ 2PN Vinhomes Grand Park' },
        { name: 'dateTime', label: 'Thời gian', type: 'datetime', required: true },
        { name: 'meetingType', label: 'Loại lịch hẹn', type: 'select', options: MEETING_TYPES },
        { name: 'status', label: 'Trạng thái', type: 'select', options: MEETING_STATUSES, placeholder: false, span: 2, hidden: () => !isEdit },
        {
            name: 'result',
            label: 'Kết quả / phản hồi của khách',
            type: 'textarea',
            span: 2,
            rows: 4,
            placeholder: 'Khách ưng / chưa ưng điểm nào, mức giá mong muốn, hẹn bước tiếp theo...',
            hidden: (values) => values.status !== 'done',
        },
        {
            name: 'attendes',
            label: 'Khách hàng',
            render: (form) => (
                <MultiSearchSelect
                    name="attendes"
                    options={contactChoices}
                    value={form.values.attendes}
                    onChange={(ids) => form.setFieldValue('attendes', ids)}
                    placeholder="Tìm tên, số điện thoại..."
                    isLoading={contactsLoading}
                    emptyText="Không có khách hàng phù hợp"
                />
            ),
        },
        {
            name: 'attendesLead',
            label: 'Khách tiềm năng',
            render: (form) => (
                <MultiSearchSelect
                    name="attendesLead"
                    options={leadChoices}
                    value={form.values.attendesLead}
                    onChange={(ids) => form.setFieldValue('attendesLead', ids)}
                    placeholder="Tìm tên, số điện thoại..."
                    isLoading={leadsLoading}
                    emptyText="Không có khách tiềm năng phù hợp"
                />
            ),
        },
        {
            name: 'property',
            label: 'BĐS dẫn xem',
            render: (form) => (
                <SearchSelect name="property" options={propertyChoices} value={form.values.property} onChange={chooseProperty} placeholder="Chọn BĐS (mã, tiêu đề, địa chỉ)" />
            ),
        },
        { name: 'location', label: 'Địa điểm', placeholder: 'Địa chỉ nhà, dự án hoặc nơi hẹn gặp' },
        { name: 'notes', label: 'Ghi chú', type: 'textarea', span: 2, rows: 3 },
    ];

    return (
        <FormModal
            isOpen={isOpen}
            onClose={() => { formik.resetForm(); onClose(); }}
            title={title || (isEdit ? 'Sửa lịch hẹn' : 'Đặt lịch hẹn')}
            onSubmit={formik.handleSubmit}
            isSubmitting={formik.isSubmitting}
            submitLabel={isEdit ? 'Lưu' : 'Đặt lịch'}
        >
            <FormFields formik={formik} fields={fields} />
        </FormModal>
    );
}
