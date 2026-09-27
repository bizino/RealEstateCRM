import { Button, Wrap, WrapItem } from '@chakra-ui/react';
import FormFields from 'components/crm/FormFields';
import FormModal from 'components/crm/FormModal';
import { CALL_RESULTS, selectable } from 'constants/realEstate';
import { useFormik } from 'formik';
import useApiData from 'hooks/useApiData';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';
import { phoneCallSchema } from 'schema';
import { apiPost } from 'services/crm';
import { formatPhone, normalizePhone, toDateTimeInput } from 'utils/format';
import { toIsoDate } from './components/activity';
import CustomerPicker, { contactPhone, leadPhone } from './components/CustomerPicker';

const asList = (data) => (Array.isArray(data) ? data : []);
// Ids may come as populated records
const idOf = (value) => String((value && typeof value === 'object' ? value._id : value) || '');

// Result of the call, one tap on phones
function ResultChoice({ value, onChange }) {
    return (
        <Wrap spacing={2}>
            {selectable(CALL_RESULTS).map((option) => {
                const active = value === option.value;
                return (
                    <WrapItem key={option.value}>
                        <Button
                            size="sm"
                            h={{ base: 10, md: 8 }}
                            borderRadius="full"
                            colorScheme={option.color}
                            variant={active ? 'solid' : 'outline'}
                            aria-pressed={active}
                            onClick={() => onChange(option.value)}
                        >
                            {option.label}
                        </Button>
                    </WrapItem>
                );
            })}
        </Wrap>
    );
}

// "Ghi nhận cuộc gọi": log of a call made to a customer. defaults:
// { createBy: contactId } or { createByLead: leadId } fix the customer (the
// picker is hidden), { recipient: phone } fills the phone number.
export default function CallForm({ isOpen, onClose, defaults, onSaved }) {
    const fixedContact = idOf(defaults?.createBy);
    const fixedLead = fixedContact ? '' : idOf(defaults?.createByLead);
    const defaultPhone = defaults?.recipient || '';
    const isFixed = Boolean(fixedContact || fixedLead);

    // Lists of the picker, only loaded while the dialog is open (or to find the
    // phone number of a fixed customer when none is given)
    const { data: contactData, isLoading: loadingContacts } = useApiData('api/contact/', {
        enabled: Boolean(isOpen && (!isFixed || (fixedContact && !defaultPhone))),
    });
    const { data: leadData, isLoading: loadingLeads } = useApiData('api/lead/', {
        enabled: Boolean(isOpen && (!isFixed || (fixedLead && !defaultPhone))),
    });
    const contacts = useMemo(() => asList(contactData), [contactData]);
    const leads = useMemo(() => asList(leadData), [leadData]);
    // Phone number filled from the chosen person, replaced when another one is chosen
    const autoPhone = useRef('');

    // Keyed on primitive values: callers may pass a new defaults object on each render
    const initialValues = useMemo(() => ({
        category: fixedLead ? 'lead' : 'contact',
        createBy: fixedContact,
        createByLead: fixedLead,
        recipient: formatPhone(defaultPhone),
        callResult: '',
        // the current time, each time the dialog opens
        startDate: isOpen ? toDateTimeInput(new Date()) : '',
        callDuration: null,
        callNotes: '',
    }), [isOpen, fixedContact, fixedLead, defaultPhone]);

    const formik = useFormik({
        initialValues,
        enableReinitialize: true,
        validationSchema: phoneCallSchema,
        onSubmit: async (values, { resetForm }) => {
            const isLead = values.category === 'lead';
            const payload = {
                recipient: normalizePhone(values.recipient),
                callResult: values.callResult,
                startDate: toIsoDate(values.startDate),
                callDuration: values.callDuration === null || values.callDuration === undefined ? '' : String(values.callDuration),
                callNotes: (values.callNotes || '').trim(),
                ...(isLead ? { createByLead: values.createByLead } : { createBy: values.createBy }),
            };
            try {
                const response = await apiPost('api/phoneCall/add', payload);
                toast.success('Đã ghi nhận cuộc gọi');
                resetForm();
                autoPhone.current = '';
                onSaved?.(response?.result);
                onClose();
            } catch (e) {
                toast.error(e.message);
            }
        },
    });
    const { setFieldValue, setFieldTouched } = formik;

    // Fixed customer without a phone number given: take the one of their record
    const fixedPhone = useMemo(() => {
        if (defaultPhone) return '';
        if (fixedContact) return contactPhone(contacts.find((contact) => contact._id === fixedContact));
        if (fixedLead) return leadPhone(leads.find((lead) => lead._id === fixedLead));
        return '';
    }, [defaultPhone, fixedContact, fixedLead, contacts, leads]);

    useEffect(() => {
        if (isOpen && fixedPhone) setFieldValue('recipient', formatPhone(fixedPhone));
    }, [isOpen, fixedPhone, setFieldValue]);

    const isLead = formik.values.category === 'lead';
    const pickerField = isLead ? 'createByLead' : 'createBy';

    const choosePerson = (id) => {
        setFieldValue(pickerField, id || '');
        const person = isLead ? leads.find((lead) => lead._id === id) : contacts.find((contact) => contact._id === id);
        const phone = formatPhone(isLead ? leadPhone(person) : contactPhone(person));
        if (phone || formik.values.recipient === autoPhone.current) setFieldValue('recipient', phone);
        autoPhone.current = phone;
    };

    const changeKind = (kind) => {
        setFieldValue('category', kind);
        setFieldValue('createBy', '');
        setFieldValue('createByLead', '');
        if (autoPhone.current && formik.values.recipient === autoPhone.current) setFieldValue('recipient', '');
        autoPhone.current = '';
    };

    const close = () => {
        formik.resetForm();
        autoPhone.current = '';
        onClose();
    };

    const fields = [
        ...(isFixed ? [] : [{
            span: 3,
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
        { name: 'recipient', label: 'Số điện thoại', type: 'phone', required: true, placeholder: 'VD: 0901 234 567' },
        { name: 'startDate', label: 'Thời gian', type: 'datetime', required: true },
        { name: 'callDuration', label: 'Thời lượng', type: 'number', suffix: 'phút', min: 0, placeholder: 'VD: 5' },
        {
            name: 'callResult',
            label: 'Kết quả',
            required: true,
            span: 3,
            render: (form) => <ResultChoice value={form.values.callResult} onChange={(value) => form.setFieldValue('callResult', value)} />,
        },
        {
            name: 'callNotes',
            label: 'Nội dung trao đổi',
            type: 'textarea',
            span: 3,
            rows: 4,
            placeholder: 'VD: Khách quan tâm căn 2PN, tài chính khoảng 3 tỷ, hẹn cuối tuần đi xem nhà',
        },
    ];

    return (
        <FormModal
            isOpen={isOpen}
            onClose={close}
            title="Ghi nhận cuộc gọi"
            onSubmit={formik.handleSubmit}
            isSubmitting={formik.isSubmitting}
            submitLabel="Lưu cuộc gọi"
        >
            <FormFields formik={formik} fields={fields} columns={3} />
        </FormModal>
    );
}
