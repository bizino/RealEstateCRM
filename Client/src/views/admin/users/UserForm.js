import { Input } from '@chakra-ui/react';
import FormFields from 'components/crm/FormFields';
import FormModal from 'components/crm/FormModal';
import { useFormik } from 'formik';
import { useMemo } from 'react';
import { toast } from 'react-toastify';
import { newUserSchema, userSchema } from 'schema/userSchema';
import { apiPost, apiPut, currentUser } from 'services/crm';
import PasswordInput from './PasswordInput';
import {
    CERTIFICATE_HELP, POSITIONS, ROLES, updateStoredUser, userInitialValues, userPayload,
} from './userFields';

const ROLE_HELP = 'Nhân viên chỉ xem được khách hàng và dữ liệu của mình. Quản trị viên xem được toàn bộ dữ liệu và quản lý nhân viên.';

// Create an employee account (user undefined, admins only) or edit a profile
// (admins, or a user editing their own profile)
export default function UserForm({ isOpen, onClose, user, onSaved }) {
    const isEdit = Boolean(user?._id);
    const initialValues = useMemo(() => userInitialValues(user), [user]);

    const formik = useFormik({
        initialValues,
        enableReinitialize: true,
        validationSchema: isEdit ? userSchema : newUserSchema,
        onSubmit: async (values, { resetForm }) => {
            const payload = userPayload(values);
            try {
                if (isEdit) {
                    await apiPut(`api/user/edit/${user._id}`, payload);
                    if (user._id === currentUser()?._id) updateStoredUser(payload);
                    toast.success('Đã cập nhật thông tin nhân viên');
                } else {
                    const isAdminAccount = values.role === 'admin';
                    await apiPost(isAdminAccount ? 'api/user/admin-register' : 'api/user/register', { ...payload, password: values.password });
                    toast.success(isAdminAccount ? `Đã tạo tài khoản quản trị viên ${payload.fullName}` : `Đã thêm nhân viên ${payload.fullName}`);
                }
                resetForm();
                onSaved?.(payload);
                onClose();
            } catch (e) {
                toast.error(e.message);
            }
        },
    });

    const fields = [
        { name: 'fullName', label: 'Họ và tên', required: true, placeholder: 'VD: Nguyễn Văn An' },
        {
            name: 'username',
            label: 'Email đăng nhập',
            type: 'email',
            required: true,
            placeholder: 'VD: an.nguyen@congty.vn',
            help: isEdit ? 'Dùng email này để đăng nhập' : 'Nhân viên dùng email này để đăng nhập',
        },
        ...(isEdit ? [] : [
            {
                name: 'password',
                label: 'Mật khẩu',
                required: true,
                help: 'Ít nhất 6 ký tự. Nhân viên có thể tự đổi mật khẩu sau khi đăng nhập.',
                render: (form) => (
                    <PasswordInput
                        name="password"
                        value={form.values.password}
                        onChange={form.handleChange}
                        onBlur={form.handleBlur}
                        autoComplete="new-password"
                    />
                ),
            },
            { name: 'role', label: 'Vai trò', type: 'select', options: ROLES, placeholder: false, required: true, help: ROLE_HELP },
        ]),
        { name: 'phoneNumber', label: 'Điện thoại', type: 'phone', placeholder: 'VD: 0901 234 567' },
        {
            name: 'position',
            label: 'Chức danh',
            render: (form) => (
                <>
                    <Input
                        name="position"
                        list="user-positions"
                        value={form.values.position}
                        onChange={form.handleChange}
                        onBlur={form.handleBlur}
                        placeholder="VD: Chuyên viên tư vấn, Trưởng nhóm"
                        autoComplete="off"
                    />
                    <datalist id="user-positions">
                        {POSITIONS.map((position) => <option key={position} value={position} />)}
                    </datalist>
                </>
            ),
        },
        {
            name: 'brokerCertificate',
            label: 'Số chứng chỉ hành nghề môi giới',
            span: 2,
            placeholder: 'Số chứng chỉ hành nghề môi giới bất động sản',
            help: CERTIFICATE_HELP,
        },
    ];

    return (
        <FormModal
            isOpen={isOpen}
            onClose={() => { formik.resetForm(); onClose(); }}
            title={isEdit ? 'Sửa thông tin nhân viên' : 'Thêm nhân viên'}
            onSubmit={formik.handleSubmit}
            isSubmitting={formik.isSubmitting}
            submitLabel={isEdit ? 'Lưu' : 'Tạo tài khoản'}
        >
            <FormFields formik={formik} fields={fields} />
        </FormModal>
    );
}
