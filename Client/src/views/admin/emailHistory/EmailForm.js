import { Alert, AlertIcon, Button, Icon, Stack, Text } from '@chakra-ui/react';
import FormFields from 'components/crm/FormFields';
import FormModal from 'components/crm/FormModal';
import { useFormik } from 'formik';
import useApiData from 'hooks/useApiData';
import { useEffect, useMemo, useRef } from 'react';
import { MdSend } from 'react-icons/md';
import { toast } from 'react-toastify';
import { emailSchema } from 'schema';
import { apiPost } from 'services/crm';
import { toDateTimeInput } from 'utils/format';
import { toIsoDate } from 'views/admin/phoneCall/components/activity';
import CustomerPicker, { contactEmail, leadEmail } from 'views/admin/phoneCall/components/CustomerPicker';

const asList = (data) => (Array.isArray(data) ? data : []);
// Ids may come as populated records
const idOf = (value) => String((value && typeof value === 'object' ? value._id : value) || '');
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

// Link opening the email app of the employee with the email already written
const mailtoLink = ({ recipient, subject, message }) => {
    const params = [
        subject && `subject=${encodeURIComponent(subject)}`,
        message && `body=${encodeURIComponent(message)}`,
    ].filter(Boolean).join('&');
    return `mailto:${String(recipient).trim()}${params ? `?${params}` : ''}`;
};

// "Ghi nhận email": saves an email sent to a customer in their history (the
// application does not send it). defaults: { createBy: contactId } or
// { createByLead: leadId } fix the customer (the picker is hidden),
// { recipient: email } fills the address.
export default function EmailForm({ isOpen, onClose, defaults, onSaved }) {
    const fixedContact = idOf(defaults?.createBy);
    const fixedLead = fixedContact ? '' : idOf(defaults?.createByLead);
    const defaultEmail = String(defaults?.recipient || '').trim();
    const isFixed = Boolean(fixedContact || fixedLead);

    // Lists of the picker, only loaded while the dialog is open (or to find the
    // address of a fixed customer when none is given)
    const { data: contactData, isLoading: loadingContacts } = useApiData('api/contact/', {
        enabled: Boolean(isOpen && (!isFixed || (fixedContact && !defaultEmail))),
    });
    const { data: leadData, isLoading: loadingLeads } = useApiData('api/lead/', {
        enabled: Boolean(isOpen && (!isFixed || (fixedLead && !defaultEmail))),
    });
    const contacts = useMemo(() => asList(contactData), [contactData]);
    const leads = useMemo(() => asList(leadData), [leadData]);
    // Address filled from the chosen person, replaced when another one is chosen
    const autoEmail = useRef('');

    // Keyed on primitive values: callers may pass a new defaults object on each render
    const initialValues = useMemo(() => ({
        category: fixedLead ? 'lead' : 'contact',
        createBy: fixedContact,
        createByLead: fixedLead,
        recipient: defaultEmail,
        subject: '',
        message: '',
        // the current time, each time the dialog opens
        startDate: isOpen ? toDateTimeInput(new Date()) : '',
    }), [isOpen, fixedContact, fixedLead, defaultEmail]);

    const formik = useFormik({
        initialValues,
        enableReinitialize: true,
        validationSchema: emailSchema,
        onSubmit: async (values, { resetForm }) => {
            const isLead = values.category === 'lead';
            const payload = {
                recipient: values.recipient.trim(),
                subject: values.subject.trim(),
                message: values.message || '',
                startDate: toIsoDate(values.startDate),
                ...(isLead ? { createByLead: values.createByLead } : { createBy: values.createBy }),
            };
            try {
                const response = await apiPost('api/email/add', payload);
                toast.success('Đã lưu email vào lịch sử chăm sóc khách');
                resetForm();
                autoEmail.current = '';
                onSaved?.(response?.result);
                onClose();
            } catch (e) {
                toast.error(e.message);
            }
        },
    });
    const { setFieldValue, setFieldTouched } = formik;

    // Fixed customer without an address given: take the one of their record
    const fixedEmail = useMemo(() => {
        if (defaultEmail) return '';
        if (fixedContact) return contactEmail(contacts.find((contact) => contact._id === fixedContact));
        if (fixedLead) return leadEmail(leads.find((lead) => lead._id === fixedLead));
        return '';
    }, [defaultEmail, fixedContact, fixedLead, contacts, leads]);

    useEffect(() => {
        if (isOpen && fixedEmail) setFieldValue('recipient', fixedEmail);
    }, [isOpen, fixedEmail, setFieldValue]);

    const isLead = formik.values.category === 'lead';
    const pickerField = isLead ? 'createByLead' : 'createBy';

    const choosePerson = (id) => {
        setFieldValue(pickerField, id || '');
        const person = isLead ? leads.find((lead) => lead._id === id) : contacts.find((contact) => contact._id === id);
        const email = isLead ? leadEmail(person) : contactEmail(person);
        if (email || formik.values.recipient === autoEmail.current) setFieldValue('recipient', email);
        autoEmail.current = email;
    };

    const changeKind = (kind) => {
        setFieldValue('category', kind);
        setFieldValue('createBy', '');
        setFieldValue('createByLead', '');
        if (autoEmail.current && formik.values.recipient === autoEmail.current) setFieldValue('recipient', '');
        autoEmail.current = '';
    };

    const close = () => {
        formik.resetForm();
        autoEmail.current = '';
        onClose();
    };

    const fields = [
        ...(isFixed ? [] : [{
            span: 2,
            render: (form) => (
                <CustomerPicker
                    kind={form.values.category}
                    onKindChange={changeKind}
                    value={form.values[pickerField]}
                    onChange={choosePerson}
                    onBlur={() => setFieldTouched(pickerField, true)}
                    contacts={contacts}
                    leads={leads}
                    isLoading={isLead ? loadingLeads : loadingContacts}
                    error={form.touched[pickerField] && form.errors[pickerField]}
                />
            ),
        }]),
        { name: 'recipient', label: 'Gửi tới', type: 'email', required: true, placeholder: 'email@khachhang.vn' },
        { name: 'startDate', label: 'Thời gian gửi', type: 'datetime', required: true },
        { name: 'subject', label: 'Tiêu đề', required: true, span: 2, placeholder: 'VD: Gửi anh/chị thông tin căn hộ 2PN dự án ...' },
        { name: 'message', label: 'Nội dung', type: 'textarea', span: 2, rows: 8, placeholder: 'Dán hoặc tóm tắt nội dung email đã gửi' },
    ];

    const { recipient, subject, message } = formik.values;

    return (
        <FormModal
            isOpen={isOpen}
            onClose={close}
            title="Ghi nhận email"
            onSubmit={formik.handleSubmit}
            isSubmitting={formik.isSubmitting}
            submitLabel="Lưu email"
            footer={isEmail(recipient) ? (
                <Button as="a" href={mailtoLink({ recipient, subject, message })} leftIcon={<Icon as={MdSend} />} variant="outline" mr="auto">
                    Soạn email
                </Button>
            ) : null}
        >
            <Stack spacing={4}>
                <Alert status="info" borderRadius="md" fontSize="sm">
                    <AlertIcon />
                    <Text>
                        Email được lưu vào lịch sử chăm sóc của khách, hệ thống không tự gửi email.
                        Bấm “Soạn email” để mở ứng dụng email (Gmail, Outlook...) với nội dung đã nhập.
                    </Text>
                </Alert>
                <FormFields formik={formik} fields={fields} />
            </Stack>
        </FormModal>
    );
}
