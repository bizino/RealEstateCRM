import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import {
    Box, Button, Divider, Flex, FormControl, FormErrorMessage, FormLabel, Grid, Heading, IconButton, Input, InputGroup,
    InputRightAddon, Select, Stack, Text,
} from '@chakra-ui/react';
import FormFields, { MoneyInput } from 'components/crm/FormFields';
import FormModal from 'components/crm/FormModal';
import SearchSelect from 'components/crm/SearchSelect';
import { COMMISSION_STATUSES, DEAL_STATUSES, DEAL_TYPES, SPLIT_ROLES, selectable } from 'constants/realEstate';
import { useFormik } from 'formik';
import useApiData from 'hooks/useApiData';
import { useMemo } from 'react';
import { toast } from 'react-toastify';
import { apiPost, apiPut, currentUser } from 'services/crm';
import { formatNumber, formatPriceShort, toNumber } from 'utils/format';
import { contactOptions, propertyOptions, userOptions } from 'utils/options';
import { commissionTotal, computedCommission, dealInitialValues, dealPayload, dealSchema } from './dealFields';

const isRent = (values) => values.dealType === 'rent';

function PickerField({ formik, name, label, options, placeholder, required }) {
    const error = formik.touched[name] && formik.errors[name];
    return (
        <FormControl isInvalid={Boolean(error)} isRequired={required}>
            <FormLabel fontSize="sm" mb={1}>{label}</FormLabel>
            <SearchSelect
                name={name}
                options={options}
                value={formik.values[name]}
                onChange={(value) => formik.setFieldValue(name, value)}
                onBlur={() => formik.setFieldTouched(name, true)}
                placeholder={placeholder}
                isInvalid={Boolean(error)}
            />
            <FormErrorMessage>{error}</FormErrorMessage>
        </FormControl>
    );
}

function CommissionSplits({ formik, users }) {
    const splits = formik.values.commissionSplits;
    const total = commissionTotal(formik.values);
    const percentSum = splits.reduce((sum, split) => sum + Number(split.percent || 0), 0);
    const listError = typeof formik.errors.commissionSplits === 'string' ? formik.errors.commissionSplits : null;
    const update = (index, field, value) => formik.setFieldValue(`commissionSplits.${index}.${field}`, value);

    return (
        <Stack spacing={3}>
            <Text fontSize="sm" color="gray.500">Chia hoa hồng cho nhân viên theo % trên tổng hoa hồng; phần còn lại là của công ty.</Text>
            {splits.map((split, index) => (
                <Grid key={index} templateColumns={{ base: '1fr', md: '2fr 1.2fr 0.9fr 1fr auto' }} gap={2} alignItems="center">
                    <SearchSelect options={userOptions(users)} value={split.user} onChange={(value) => update(index, 'user', value)} placeholder="Chọn nhân viên" />
                    <Select value={split.role} onChange={(e) => update(index, 'role', e.target.value)}>
                        {SPLIT_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                    </Select>
                    <InputGroup>
                        <Input type="number" min={0} max={100} value={split.percent ?? ''} onChange={(e) => update(index, 'percent', e.target.value === '' ? null : Number(e.target.value))} />
                        <InputRightAddon>%</InputRightAddon>
                    </InputGroup>
                    <Text fontSize="sm" fontWeight="600" textAlign={{ md: 'right' }}>
                        {total ? formatPriceShort(Math.round((total * Number(split.percent || 0)) / 100), { empty: '0 đ' }) : ''}
                    </Text>
                    <IconButton
                        icon={<DeleteIcon />}
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        aria-label="Bỏ dòng"
                        onClick={() => formik.setFieldValue('commissionSplits', splits.filter((_, i) => i !== index))}
                    />
                </Grid>
            ))}
            <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
                <Button size="sm" leftIcon={<AddIcon />} onClick={() => formik.setFieldValue('commissionSplits', [...splits, { user: '', role: splits.length ? 'listing' : 'selling', percent: null }])}>
                    Thêm người nhận
                </Button>
                {splits.length > 0 && (
                    <Text fontSize="sm" color={percentSum > 100 ? 'red.500' : 'gray.600'}>
                        Đã chia {formatNumber(percentSum)}% · Công ty giữ lại {formatNumber(Math.max(0, 100 - percentSum))}%
                    </Text>
                )}
            </Flex>
            {listError && <Text color="red.500" fontSize="sm">{listError}</Text>}
        </Stack>
    );
}

function PaymentSchedule({ formik }) {
    const payments = formik.values.payments;
    const update = (index, field, value) => formik.setFieldValue(`payments.${index}.${field}`, value);
    const total = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const price = toNumber(formik.values.price);

    return (
        <Stack spacing={3}>
            {payments.map((payment, index) => (
                <Box key={index} borderWidth="1px" borderRadius="10px" p={3}>
                    <Grid templateColumns={{ base: '1fr', md: '1.2fr 1fr 1.4fr 1fr auto' }} gap={2} alignItems="end">
                        <FormControl>
                            <FormLabel fontSize="xs" mb={1}>Đợt</FormLabel>
                            <Input value={payment.name} onChange={(e) => update(index, 'name', e.target.value)} placeholder={`Đợt ${index + 1}`} />
                        </FormControl>
                        <FormControl>
                            <FormLabel fontSize="xs" mb={1}>Hạn thanh toán</FormLabel>
                            <Input type="date" value={payment.dueDate} onChange={(e) => update(index, 'dueDate', e.target.value)} />
                        </FormControl>
                        <FormControl>
                            <FormLabel fontSize="xs" mb={1}>Số tiền</FormLabel>
                            <MoneyInput value={payment.amount} onChange={(value) => update(index, 'amount', value)} />
                        </FormControl>
                        <FormControl>
                            <FormLabel fontSize="xs" mb={1}>Ngày đã trả</FormLabel>
                            <Input type="date" value={payment.paidDate} onChange={(e) => update(index, 'paidDate', e.target.value)} />
                        </FormControl>
                        <IconButton
                            icon={<DeleteIcon />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            aria-label="Bỏ đợt"
                            onClick={() => formik.setFieldValue('payments', payments.filter((_, i) => i !== index))}
                        />
                    </Grid>
                    <Input mt={2} size="sm" value={payment.note} onChange={(e) => update(index, 'note', e.target.value)} placeholder="Ghi chú (tùy chọn)" />
                </Box>
            ))}
            <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
                <Button
                    size="sm"
                    leftIcon={<AddIcon />}
                    onClick={() => formik.setFieldValue('payments', [...payments, { name: `Đợt ${payments.length + 1}`, dueDate: '', amount: null, paidDate: '', note: '' }])}
                >
                    Thêm đợt thanh toán
                </Button>
                {payments.length > 0 && (
                    <Text fontSize="sm" color={price && total > price ? 'red.500' : 'gray.600'}>
                        Tổng các đợt: {formatPriceShort(total, { empty: '0 đ' })}{price ? ` / giá chốt ${formatPriceShort(price)}` : ''}
                    </Text>
                )}
            </Flex>
        </Stack>
    );
}

// Create (deal undefined) or edit a deal. defaults (create only):
// { contact, property, dealType, price, commissionRate }
export default function DealForm({ isOpen, onClose, deal, defaults, onSaved }) {
    const user = currentUser();
    const isAdmin = user?.role === 'admin';
    const isEdit = Boolean(deal?._id);
    const { data: contacts } = useApiData('api/contact/', { enabled: isOpen });
    const { data: properties } = useApiData('api/property/', { enabled: isOpen });
    const { data: users } = useApiData('api/user/options', { enabled: isOpen });

    const initialValues = useMemo(() => dealInitialValues(deal, isEdit ? {} : defaults), [deal, defaults, isEdit]);

    const formik = useFormik({
        initialValues,
        enableReinitialize: true,
        validationSchema: dealSchema,
        onSubmit: async (values, { resetForm }) => {
            try {
                const payload = dealPayload(values, { isAdmin, isEdit });
                if (isEdit) {
                    await apiPut(`api/deal/edit/${deal._id}`, payload);
                    toast.success('Đã cập nhật giao dịch');
                } else {
                    const created = await apiPost('api/deal/add', payload);
                    toast.success(`Đã tạo giao dịch ${created?.code || ''}`);
                }
                resetForm();
                onSaved?.();
                onClose();
            } catch (e) {
                toast.error(e.message);
            }
        },
    });

    // A contact from the deal (populated) may not be in the list of the caller
    const contactChoices = useMemo(() => {
        const options = contactOptions(contacts);
        if (deal?.contact?._id && !options.some((option) => option.value === deal.contact._id)) {
            options.unshift(...contactOptions([deal.contact]));
        }
        return options;
    }, [contacts, deal]);

    const chooseProperty = (id) => {
        formik.setFieldValue('property', id);
        const property = properties.find((p) => p._id === id);
        if (!property) return;
        if (formik.values.price === null) formik.setFieldValue('price', property.price ?? toNumber(property.listingPrice));
        if (formik.values.commissionRate === null && property.commissionRate) formik.setFieldValue('commissionRate', property.commissionRate);
        formik.setFieldValue('dealType', property.transactionType === 'rent' ? 'rent' : 'sale');
    };

    const computed = computedCommission(formik.values);
    const status = formik.values.status;

    const mainFields = [
        { section: 'Thông tin giao dịch' },
        ...(isAdmin && !isEdit ? [{
            name: 'createBy',
            label: 'Nhân viên phụ trách',
            render: (form) => <SearchSelect options={userOptions(users)} value={form.values.createBy} onChange={(value) => form.setFieldValue('createBy', value)} placeholder="Tôi phụ trách" />,
        }] : []),
        { name: 'dealType', label: 'Loại giao dịch', type: 'select', options: DEAL_TYPES, required: true, placeholder: false },
        { name: 'status', label: 'Trạng thái', type: 'select', options: selectable(DEAL_STATUSES), required: true, placeholder: false },
        {
            span: 2,
            render: (form) => <PickerField formik={form} name="contact" label="Khách hàng (bên mua / thuê)" options={contactChoices} placeholder="Chọn khách hàng" required />,
        },
        {
            span: 2,
            render: (form) => (
                <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Bất động sản</FormLabel>
                    <SearchSelect options={propertyOptions(properties)} value={form.values.property} onChange={chooseProperty} placeholder="Chọn BĐS (mã, tiêu đề, địa chỉ)" />
                </FormControl>
            ),
        },
        { name: 'price', label: 'Giá chốt', type: 'money', rent: isRent, help: 'Cho thuê: giá thuê mỗi tháng' },
        { name: 'title', label: 'Tên giao dịch', placeholder: 'Tự đặt theo BĐS và khách nếu để trống' },
        { name: 'cancelReason', label: 'Lý do hủy', span: 2, hidden: (values) => values.status !== 'cancelled', required: true },

        { section: 'Đặt cọc và hợp đồng' },
        { name: 'depositAmount', label: 'Tiền đặt cọc', type: 'money' },
        { name: 'depositDate', label: 'Ngày đặt cọc', type: 'date' },
        { name: 'contractDueDate', label: 'Hạn ký hợp đồng / công chứng', type: 'date' },
        { name: 'contractNumber', label: 'Số hợp đồng' },
        { name: 'contractDate', label: 'Ngày ký hợp đồng', type: 'date' },
        { name: 'completedDate', label: 'Ngày hoàn tất / bàn giao', type: 'date' },

        { section: 'Hoa hồng của công ty' },
        { name: 'commissionRate', label: 'Tỷ lệ hoa hồng', type: 'number', suffix: '%', min: 0, max: 100 },
        {
            name: 'commissionAmount', label: 'Số tiền hoa hồng', type: 'money',
            help: computed ? `Để trống để tính theo tỷ lệ: ${formatPriceShort(computed)}` : 'Nhập số tiền, hoặc tỷ lệ % và giá chốt',
        },
        { name: 'commissionStatus', label: 'Tình trạng thu hoa hồng', type: 'select', options: COMMISSION_STATUSES, placeholder: false },
        { name: 'commissionReceivedDate', label: 'Ngày nhận hoa hồng', type: 'date', hidden: (values) => values.commissionStatus === 'pending' },
    ];

    return (
        <FormModal
            isOpen={isOpen}
            onClose={() => { formik.resetForm(); onClose(); }}
            title={isEdit ? `Sửa giao dịch ${deal.code || ''}` : 'Tạo giao dịch'}
            onSubmit={formik.handleSubmit}
            isSubmitting={formik.isSubmitting}
            size="5xl"
        >
            <Stack spacing={6}>
                <FormFields formik={formik} fields={mainFields} />
                <Box>
                    <Heading size="sm" color="brand.500" mb={3}>Chia hoa hồng</Heading>
                    <CommissionSplits formik={formik} users={users} />
                </Box>
                <Divider />
                <Box>
                    <Heading size="sm" color="brand.500" mb={3}>Lịch thanh toán của khách</Heading>
                    <PaymentSchedule formik={formik} />
                </Box>
                <FormFields formik={formik} fields={[{ name: 'notes', label: 'Ghi chú', type: 'textarea', span: 2, rows: 3 }]} />
                {status === 'cancelled' && (
                    <Text fontSize="sm" color="orange.500">Giao dịch hủy: bất động sản sẽ được mở bán lại nếu không còn giao dịch nào khác giữ căn.</Text>
                )}
            </Stack>
        </FormModal>
    );
}
