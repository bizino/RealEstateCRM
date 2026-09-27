import StatusBadge from 'components/crm/StatusBadge';
import { labelOf } from 'constants/realEstate';
import { currentUser } from 'services/crm';
import { displayName, formatPhone, normalizePhone } from 'utils/format';

export const ROLES = [
    { value: 'user', label: 'Nhân viên', color: 'blue' },
    { value: 'admin', label: 'Quản trị viên', color: 'purple' },
];

export const roleOf = (user) => (user?.role === 'admin' ? 'admin' : 'user');
export const roleLabel = (user) => labelOf(ROLES, roleOf(user));

export function RoleBadge({ user }) {
    return <StatusBadge options={ROLES} value={roleOf(user)} />;
}

// Usual job titles of a real estate agency, suggested in the form
export const POSITIONS = [
    'Chuyên viên tư vấn',
    'Chuyên viên kinh doanh',
    'Trưởng nhóm',
    'Trưởng phòng kinh doanh',
    'Giám đốc sàn',
    'Giám đốc kinh doanh',
    'Chăm sóc khách hàng',
    'Marketing',
    'Kế toán',
    'Hành chính - Nhân sự',
];

export const CERTIFICATE_HELP = 'Theo Luật Kinh doanh BĐS 2023, môi giới cần có chứng chỉ hành nghề';

const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

export const userInitialValues = (user) => ({
    fullName: displayName(user),
    username: user?.username || '',
    password: '',
    role: 'user',
    phoneNumber: formatPhone(user?.phoneNumber),
    position: user?.position || '',
    brokerCertificate: user?.brokerCertificate || '',
});

// Profile fields sent to the API (register, admin-register and edit)
export const userPayload = (values) => ({
    fullName: clean(values.fullName),
    username: String(values.username || '').trim(),
    phoneNumber: normalizePhone(values.phoneNumber),
    position: clean(values.position),
    brokerCertificate: clean(values.brokerCertificate),
});

// Same split as the API: "Nguyễn Văn An" -> lastName "Nguyễn Văn", firstName "An"
export const splitFullName = (fullName) => {
    const parts = clean(fullName).split(' ').filter(Boolean);
    return { firstName: parts[parts.length - 1] || '', lastName: parts.slice(0, -1).join(' ') };
};

// After editing their own profile: the stored user (read by the top bar) gets
// the new name and contact details, its other fields are kept
export const updateStoredUser = (payload) => {
    const stored = currentUser();
    if (!stored) return;
    try {
        localStorage.setItem('user', JSON.stringify({
            ...stored,
            fullName: payload.fullName,
            ...splitFullName(payload.fullName),
            phoneNumber: payload.phoneNumber,
            username: payload.username || stored.username,
            position: payload.position,
            brokerCertificate: payload.brokerCertificate,
        }));
    } catch (e) {
        // storage full or disabled: the new name shows after the next login
    }
};
