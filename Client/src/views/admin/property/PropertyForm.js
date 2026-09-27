import { FormControl, FormLabel } from '@chakra-ui/react';
import FormFields from 'components/crm/FormFields';
import FormModal from 'components/crm/FormModal';
import SearchSelect from 'components/crm/SearchSelect';
import { useFormik } from 'formik';
import useApiData from 'hooks/useApiData';
import { toast } from 'react-toastify';
import { apiPost, apiPut, currentUser } from 'services/crm';
import { userOptions } from 'utils/options';
import { propertyFields, propertyInitialValues, propertyPayload, propertySchema } from './propertyFields';

// Create (property undefined) or edit a property
export default function PropertyForm({ isOpen, onClose, property, onSaved }) {
    const user = currentUser();
    const isAdmin = user?.role === 'admin';
    const isEdit = Boolean(property?._id);
    // The owner's details are only sent to the employee managing the listing
    const canSeeOwner = !isEdit || property.canEdit !== false;
    const { data: users } = useApiData('api/user/options', { enabled: isOpen && isAdmin && !isEdit });

    const formik = useFormik({
        initialValues: { ...propertyInitialValues(property), createBy: '' },
        enableReinitialize: true,
        validationSchema: propertySchema,
        onSubmit: async (values, { resetForm }) => {
            const { createBy, ...fields } = values;
            const payload = propertyPayload(fields, { canSeeOwner });
            try {
                if (isEdit) {
                    await apiPut(`api/property/edit/${property._id}`, payload);
                    toast.success('Đã cập nhật bất động sản');
                } else {
                    const created = await apiPost('api/property/add', { ...payload, ...(isAdmin && createBy && { createBy }) });
                    toast.success(`Đã thêm bất động sản ${created?.code || ''}`);
                }
                resetForm();
                onSaved?.();
                onClose();
            } catch (e) {
                toast.error(e.message);
            }
        },
    });

    const fields = propertyFields({ canSeeOwner });
    if (isAdmin && !isEdit) {
        fields.splice(1, 0, {
            name: 'createBy',
            label: 'Nhân viên phụ trách',
            span: 2,
            render: (form) => (
                <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Nhân viên phụ trách</FormLabel>
                    <SearchSelect options={userOptions(users)} value={form.values.createBy} onChange={(value) => form.setFieldValue('createBy', value)} placeholder="Tôi phụ trách" />
                </FormControl>
            ),
        });
    }

    return (
        <FormModal
            isOpen={isOpen}
            onClose={() => { formik.resetForm(); onClose(); }}
            title={isEdit ? `Sửa bất động sản ${property.code || ''}` : 'Thêm bất động sản'}
            onSubmit={formik.handleSubmit}
            isSubmitting={formik.isSubmitting}
            size="4xl"
        >
            <FormFields formik={formik} fields={fields} />
        </FormModal>
    );
}
