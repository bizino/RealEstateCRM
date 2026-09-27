import { Box, FormControl, FormErrorMessage, FormLabel, HStack, Radio, RadioGroup } from '@chakra-ui/react';
import SearchSelect from 'components/crm/SearchSelect';
import { useMemo } from 'react';
import { contactOptions, leadOptions } from 'utils/options';

// Phone number and email of a customer (contact) or a lead
export const contactPhone = (contact) => contact?.phoneNumber || contact?.mobileNumber || '';
export const leadPhone = (lead) => lead?.leadPhoneNumber || '';
export const contactEmail = (contact) => contact?.email || '';
export const leadEmail = (lead) => lead?.leadEmail || '';

// Person a call, an email or a document is about: kind "contact" (customer)
// or "lead", then the person searched by name, phone or email
export default function CustomerPicker({
    kind, onKindChange, value, onChange, onBlur, contacts, leads, isLoading, error, isRequired = true,
}) {
    const isLead = kind === 'lead';
    const options = useMemo(() => (isLead ? leadOptions(leads || []) : contactOptions(contacts || [])), [isLead, contacts, leads]);
    const label = isLead ? 'Khách tiềm năng' : 'Khách hàng';

    return (
        <Box>
            <RadioGroup value={isLead ? 'lead' : 'contact'} onChange={onKindChange} mb={2}>
                <HStack spacing={5}>
                    <Radio value="contact">Khách hàng</Radio>
                    <Radio value="lead">Khách tiềm năng</Radio>
                </HStack>
            </RadioGroup>
            <FormControl isInvalid={Boolean(error)} isRequired={isRequired}>
                <FormLabel fontSize="sm" mb={1}>{label}</FormLabel>
                <SearchSelect
                    name={isLead ? 'lead' : 'contact'}
                    options={options}
                    value={value}
                    onChange={onChange}
                    onBlur={() => onBlur?.()}
                    isInvalid={Boolean(error)}
                    placeholder={isLoading && !options.length ? 'Đang tải danh sách...' : `Tìm ${label.toLowerCase()} theo tên, số điện thoại...`}
                    emptyText={isLoading ? 'Đang tải danh sách...' : `Không tìm thấy ${label.toLowerCase()}`}
                />
                <FormErrorMessage>{error}</FormErrorMessage>
            </FormControl>
        </Box>
    );
}
