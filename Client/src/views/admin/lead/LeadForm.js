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
import { leadFields, leadInitialValues, leadPayload, leadSchema } from './leadFields';

// Create (lead undefined) or edit a lead (khách tiềm năng)
export default function LeadForm({ isOpen, onClose, lead, onSaved }) {
    const isAdmin = currentUser()?.role === 'admin';
    const isEdit = Boolean(lead?._id);
    const [duplicateError, setDuplicateError] = useState(null);
    const [isForcing, setIsForcing] = useState(false);
    const { data: users } = useApiData('api/user/options', { enabled: isOpen && isAdmin && !isEdit });

    const initialValues = useMemo(() => ({ ...leadInitialValues(isEdit ? lead : {}), createBy: '' }), [lead, isEdit]);

    const save = async (values, allowDuplicate = false) => {
        const { createBy, ...fields } = values;
        const payload = { ...leadPayload(fields), ...(allowDuplicate && { allowDuplicate: true }) };
        if (isEdit) {
            await apiPut(`api/lead/edit/${lead._id}`, payload);
            toast.success('Đã cập nhật khách tiềm năng');
        } else {
            await apiPost('api/lead/add', { ...payload, ...(isAdmin && createBy && { createBy }) });
            toast.success('Đã thêm khách tiềm năng');
        }
    };

    const formik = useFormik({
        initialValues,
        enableReinitialize: true,
        validationSchema: leadSchema,
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
        ? [leadFields[0], {
            name: 'createBy',
            label: 'Nhân viên phụ trách',
            span: 2,
            render: (form) => <SearchSelect options={userOptions(users)} value={form.values.createBy} onChange={(value) => form.setFieldValue('createBy', value)} placeholder="Tôi phụ trách" />,
        }, ...leadFields.slice(1)]
        : leadFields;

    return (
        <FormModal
            isOpen={isOpen}
            onClose={close}
            title={isEdit ? 'Sửa khách tiềm năng' : 'Thêm khách tiềm năng'}
            onSubmit={formik.handleSubmit}
            isSubmitting={formik.isSubmitting}
            size="3xl"
        >
            <DuplicateAlert error={duplicateError} onForce={isAdmin ? forceSave : undefined} isForcing={isForcing} />
            <FormFields formik={formik} fields={fields} />
        </FormModal>
    );
}
