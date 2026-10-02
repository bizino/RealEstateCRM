import {
    Checkbox, FormControl, FormErrorMessage, FormHelperText, FormLabel, GridItem, Heading, Input, InputGroup,
    InputRightAddon, Select, SimpleGrid, Textarea,
} from '@chakra-ui/react';
import { labelOf, selectable } from 'constants/realEstate';
import { formatNumber, formatPriceShort, parseMoneyInput } from 'utils/format';

const errorOf = (formik, name) => {
    const error = name.split('.').reduce((value, key) => value?.[key], formik.errors);
    const touched = name.split('.').reduce((value, key) => value?.[key], formik.touched);
    return touched && typeof error === 'string' ? error : null;
};

const valueOf = (formik, name) => name.split('.').reduce((value, key) => value?.[key], formik.values);

// Money typed with thousand separators ("3.500.000.000"), stored as a number,
// with the amount in words below ("≈ 3,5 tỷ")
export function MoneyInput({ value, onChange, onBlur, name, placeholder = '0', isDisabled, rent = false }) {
    return (
        <>
            <InputGroup>
                <Input
                    name={name}
                    inputMode="numeric"
                    value={value === null || value === undefined || value === '' ? '' : formatNumber(value, 0)}
                    onChange={(e) => onChange(parseMoneyInput(e.target.value))}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    isDisabled={isDisabled}
                />
                <InputRightAddon>₫</InputRightAddon>
            </InputGroup>
            {value ? <FormHelperText>≈ {formatPriceShort(value, { rent })}</FormHelperText> : null}
        </>
    );
}

const renderInput = (field, formik) => {
    const { name, type = 'text', placeholder, options = [], min, max, step, suffix, rows = 3, isDisabled } = field;
    const value = valueOf(formik, name);
    const common = { name, onBlur: formik.handleBlur, placeholder, isDisabled };

    switch (type) {
        case 'select':
            return (
                <Select {...common} value={value ?? ''} onChange={(e) => formik.setFieldValue(name, e.target.value)} placeholder={placeholder ?? '— Chọn —'}>
                    {selectable(options).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    {/* Values of older versions stay selected, with their label */}
                    {value && !selectable(options).some((option) => option.value === value) && <option value={value}>{labelOf(options, value)}</option>}
                </Select>
            );
        case 'textarea':
            return <Textarea {...common} value={value ?? ''} onChange={formik.handleChange} rows={rows} resize="vertical" />;
        case 'money':
            return <MoneyInput {...common} value={value} rent={typeof field.rent === 'function' ? field.rent(formik.values) : field.rent} onChange={(amount) => formik.setFieldValue(name, amount)} />;
        case 'checkbox':
            return (
                <Checkbox name={name} isChecked={Boolean(value)} onChange={(e) => formik.setFieldValue(name, e.target.checked)} isDisabled={isDisabled}>
                    {field.checkboxLabel}
                </Checkbox>
            );
        case 'number': {
            const input = (
                <Input
                    {...common}
                    type="number"
                    inputMode="decimal"
                    value={value ?? ''}
                    min={min}
                    max={max}
                    step={step ?? 'any'}
                    onChange={(e) => formik.setFieldValue(name, e.target.value === '' ? null : Number(e.target.value))}
                    onWheel={(e) => e.target.blur()}
                />
            );
            return suffix ? <InputGroup>{input}<InputRightAddon>{suffix}</InputRightAddon></InputGroup> : input;
        }
        case 'date':
        case 'datetime':
            return <Input {...common} type={type === 'date' ? 'date' : 'datetime-local'} value={value ?? ''} onChange={formik.handleChange} />;
        case 'phone':
            return <Input {...common} type="tel" inputMode="tel" value={value ?? ''} onChange={formik.handleChange} autoComplete="off" />;
        default:
            return <Input {...common} type={type} value={value ?? ''} onChange={formik.handleChange} autoComplete="off" />;
    }
};

// Grid of form fields described by a list:
// { name, label, type, options, required, span, help, placeholder, suffix, hidden: (values) => bool }
// { section: 'Title' } starts a new group of fields, { render: (formik) => node } a custom block
export default function FormFields({ formik, fields, columns = 2 }) {
    return (
        <SimpleGrid columns={{ base: 1, md: columns }} spacingX={4} spacingY={4}>
            {fields.map((field, index) => {
                if (field.hidden && field.hidden(formik.values)) return null;
                if (field.section) {
                    return (
                        <GridItem key={`section-${index}`} colSpan={{ base: 1, md: columns }} pt={index ? 2 : 0}>
                            <Heading size="sm" color="brand.500">{field.section}</Heading>
                        </GridItem>
                    );
                }
                const span = { base: 1, md: Math.min(field.span || 1, columns) };
                if (field.render && !field.name) {
                    return <GridItem key={`custom-${index}`} colSpan={span}>{field.render(formik)}</GridItem>;
                }
                const error = errorOf(formik, field.name);
                return (
                    <GridItem key={field.name} colSpan={span}>
                        <FormControl isInvalid={Boolean(error)} isRequired={field.required}>
                            {field.type !== 'checkbox' && <FormLabel fontSize="sm" mb={1}>{field.label}</FormLabel>}
                            {field.render ? field.render(formik) : renderInput(field, formik)}
                            {error ? <FormErrorMessage>{error}</FormErrorMessage> : field.help ? <FormHelperText>{field.help}</FormHelperText> : null}
                        </FormControl>
                    </GridItem>
                );
            })}
        </SimpleGrid>
    );
}
