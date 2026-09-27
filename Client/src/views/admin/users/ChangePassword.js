import { Alert, AlertIcon, Stack, Text } from '@chakra-ui/react';
import FormFields from 'components/crm/FormFields';
import FormModal from 'components/crm/FormModal';
import { useFormik } from 'formik';
import { useMemo } from 'react';
import { toast } from 'react-toastify';
import { changePasswordSchema } from 'schema';
import { apiPut, currentUser } from 'services/crm';
import PasswordInput from './PasswordInput';

const passwordField = (name, label, autoComplete, extra = {}) => ({
    name,
    label,
    required: true,
    ...extra,
    render: (form) => (
        <PasswordInput name={name} value={form.values[name]} onChange={form.handleChange} onBlur={form.handleBlur} autoComplete={autoComplete} />
    ),
});

// Change your own password (the current one is asked), or for admins, reset
// the password of an employee. id: the user whose password changes, name: their
// name shown in the title when it is someone else.
export default function ChangePassword({ isOpen, onClose, id, name }) {
    const isSelf = currentUser()?._id === id;
    const validationSchema = useMemo(() => changePasswordSchema(isSelf), [isSelf]);

    const formik = useFormik({
        initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
        validationSchema,
        onSubmit: async (values, { resetForm }) => {
            try {
                await apiPut(`api/user/change-password/${id}`, isSelf
                    ? { currentPassword: values.currentPassword, newPassword: values.newPassword }
                    : { newPassword: values.newPassword });
                toast.success(isSelf ? 'Đã đổi mật khẩu' : `Đã đặt lại mật khẩu${name ? ` cho ${name}` : ''}`);
                resetForm();
                onClose();
            } catch (e) {
                toast.error(e.message);
            }
        },
    });

    const close = () => {
        formik.resetForm();
        onClose();
    };

    const fields = [
        ...(isSelf ? [passwordField('currentPassword', 'Mật khẩu hiện tại', 'current-password')] : []),
        passwordField('newPassword', 'Mật khẩu mới', 'new-password', { help: 'Ít nhất 6 ký tự' }),
        passwordField('confirmPassword', 'Nhập lại mật khẩu mới', 'new-password'),
    ];

    return (
        <FormModal
            isOpen={isOpen}
            onClose={close}
            title={isSelf ? 'Đổi mật khẩu' : `Đặt lại mật khẩu${name ? ` cho ${name}` : ''}`}
            onSubmit={formik.handleSubmit}
            isSubmitting={formik.isSubmitting}
            submitLabel={isSelf ? 'Đổi mật khẩu' : 'Đặt lại mật khẩu'}
            size="lg"
        >
            <Stack spacing={4}>
                {!isSelf && (
                    <Alert status="info" borderRadius="md" fontSize="sm">
                        <AlertIcon />
                        <Text>Nhân viên sẽ đăng nhập bằng mật khẩu mới. Hãy gửi mật khẩu này cho nhân viên qua kênh riêng tư và nhắc họ đổi lại sau khi đăng nhập.</Text>
                    </Alert>
                )}
                <FormFields formik={formik} fields={fields} columns={1} />
            </Stack>
        </FormModal>
    );
}
