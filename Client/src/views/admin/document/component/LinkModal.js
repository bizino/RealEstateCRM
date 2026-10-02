import { Stack, Text } from '@chakra-ui/react';
import FormModal from 'components/crm/FormModal';
import { useFormik } from 'formik';
import { useMemo } from 'react';
import { toast } from 'react-toastify';
import { apiPost } from 'services/crm';
import CustomerPicker from 'views/admin/phoneCall/components/CustomerPicker';

const fieldOf = (kind) => (kind === 'lead' ? 'linkLead' : 'linkContact');

// Links a document to a customer (contact) or a lead: it then shows in their file
export default function LinkModal({ isOpen, onClose, file, contacts, leads, loadingContacts, loadingLeads, onLinked }) {
    const initialValues = useMemo(() => ({
        kind: file?.linkLead && !file?.linkContact ? 'lead' : 'contact',
        linkContact: file?.linkContact || '',
        linkLead: file?.linkLead || '',
    }), [file]);

    const formik = useFormik({
        initialValues,
        enableReinitialize: true,
        validate: (values) => {
            const field = fieldOf(values.kind);
            if (values[field]) return {};
            return { [field]: values.kind === 'lead' ? 'Vui lòng chọn khách tiềm năng' : 'Vui lòng chọn khách hàng' };
        },
        onSubmit: async (values) => {
            const isLead = values.kind === 'lead';
            try {
                await apiPost(`api/document/link-document/${file._id}`, isLead ? { linkLead: values.linkLead } : { linkContact: values.linkContact });
                toast.success(isLead ? 'Đã liên kết tài liệu với khách tiềm năng' : 'Đã liên kết tài liệu với khách hàng');
                onLinked?.();
                onClose();
            } catch (e) {
                toast.error(e.message);
            }
        },
    });

    const field = fieldOf(formik.values.kind);
    const close = () => {
        formik.resetForm();
        onClose();
    };

    return (
        <FormModal
            isOpen={isOpen}
            onClose={close}
            title="Liên kết tài liệu"
            onSubmit={formik.handleSubmit}
            isSubmitting={formik.isSubmitting}
            submitLabel="Liên kết"
            size="lg"
        >
            {/* Room for the search results of the picker */}
            <Stack spacing={4} minH={{ md: '360px' }}>
                <Text fontSize="sm" color="gray.600">
                    Tài liệu <Text as="span" fontWeight="700">“{file?.fileName}”</Text> sẽ hiện trong hồ sơ của khách hàng hoặc khách tiềm năng được chọn.
                    {(file?.linkContact || file?.linkLead) && ' Liên kết cũ sẽ được thay thế.'}
                </Text>
                <CustomerPicker
                    kind={formik.values.kind}
                    onKindChange={(kind) => formik.setFieldValue('kind', kind)}
                    value={formik.values[field]}
                    onChange={(id) => formik.setFieldValue(field, id || '')}
                    onBlur={() => formik.setFieldTouched(field, true)}
                    contacts={contacts}
                    leads={leads}
                    isLoading={formik.values.kind === 'lead' ? loadingLeads : loadingContacts}
                    error={formik.touched[field] && formik.errors[field]}
                />
            </Stack>
        </FormModal>
    );
}
