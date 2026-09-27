import DuplicateAlert from 'components/crm/DuplicateAlert';
import FormFields from 'components/crm/FormFields';
import FormModal from 'components/crm/FormModal';
import SearchSelect from 'components/crm/SearchSelect';
import { useFormik } from 'formik';
import useApiData from 'hooks/useApiData';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { apiPost, apiPut, currentUser } from 'services/crm';
import { userOptions } from 'utils/options';
import { contactFields, contactInitialValues, contactPayload, contactSchema } from './contactFields';

// Create (contact undefined) or edit a customer. `defaults` prefill a new one.
export default function ContactForm({ isOpen, onClose, contact, defaults, onSaved }) {
    const isAdmin = currentUser()?.role === 'admin';
    const isEdit = Boolean(contact?._id);
    const [duplicateError, setDuplicateError] = useState(null);
    const [isForcing, setIsForcing] = useState(false);
    const { data: users } = useApiData('api/user/options', { enabled: isOpen && isAdmin && !isEdit });

    const initialValues = useMemo(
        () => ({ ...contactInitialValues(isEdit ? contact : { ...defaults }), createBy: '' }),
        [contact, defaults, isEdit],
    );

    const save = async (values, allowDuplicate = false) => {
        const { createBy, ...fields } = values;
        const payload = { ...contactPayload(fields), ...(allowDuplicate && { allowDuplicate: true }) };
        if (isEdit) {
            await apiPut(`api/contact/edit/${contact._id}`, payload);
            toast.success('Đã cập nhật khách hàng');
        } else {
            await apiPost('api/contact/add', { ...payload, ...(isAdmin && createBy && { createBy }) });
            toast.success('Đã thêm khách hàng');
        }
    };

    const formik = useFormik({
        initialValues,
        enableReinitialize: true,
        validationSchema: contactSchema,
        onSubmit: async (values) => {
            setDuplicateError(null);
            try {
                await save(values);
                onSaved?.();
                close();
            } catch (e) {
                if (e.status === 409) setDuplicateError(e);
                toast.error(e.message);
            }
        },
    });

    function close() {
        setDuplicateError(null);
        formik.resetForm();
        onClose();
    }

    const forceSave = async () => {
        setIsForcing(true);
        try {
            await save(formik.values, true);
            onSaved?.();
            close();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setIsForcing(false);
        }
    };

    const fields = isAdmin && !isEdit
        ? [contactFields[0], {
            name: 'createBy',
            label: 'Nhân viên phụ trách',
            span: 2,
            render: (form) => <SearchSelect options={userOptions(users)} value={form.values.createBy} onChange={(value) => form.setFieldValue('createBy', value)} placeholder="Tôi phụ trách" />,
        }, ...contactFields.slice(1)]
        : contactFields;

    return (
        <FormModal
            isOpen={isOpen}
            onClose={close}
            title={isEdit ? 'Sửa thông tin khách hàng' : 'Thêm khách hàng'}
            onSubmit={formik.handleSubmit}
            isSubmitting={formik.isSubmitting}
            size="4xl"
        >
            <DuplicateAlert error={duplicateError} onForce={isAdmin ? forceSave : undefined} isForcing={isForcing} />
            <FormFields formik={formik} fields={fields} />
        </FormModal>
    );
}
