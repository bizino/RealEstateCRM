import * as yup from 'yup'

// Users confirm their current password, admins resetting another user's password do not
export const changePasswordSchema = (requireCurrentPassword) => yup.object({
    currentPassword: requireCurrentPassword ? yup.string().required('Current Password Is required') : yup.string(),
    newPassword: yup.string().min(6, 'Password must have at least 6 characters').required('New Password Is required'),
    confirmPassword: yup.string().oneOf([yup.ref('newPassword')], 'Passwords do not match').required('Confirm Password Is required'),
})
