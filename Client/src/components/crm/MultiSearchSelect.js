import {
    Box, Flex, Icon, Input, InputGroup, InputLeftElement, Spinner, Tag, TagCloseButton, TagLabel, Text, useColorModeValue,
    useOutsideClick, Wrap, WrapItem,
} from '@chakra-ui/react';
import { useMemo, useRef, useState } from 'react';
import { MdSearch } from 'react-icons/md';
import { searchText } from 'utils/format';

const MAX_RESULTS = 50;

const sameValue = (a, b) => String(a) === String(b);

// Several choices in a long list (customers, leads...): a search box ignoring
// accents, the chosen items shown as tags which can be removed.
// options: [{ value, label, description }], value: array of the chosen values
export default function MultiSearchSelect({
    options = [], value, onChange, placeholder = 'Gõ để tìm và chọn...', isDisabled, isInvalid, name, onBlur,
    isLoading = false, emptyText = 'Không có kết quả',
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef();
    const panelBg = useColorModeValue('white', 'navy.800');
    const hoverBg = useColorModeValue('gray.100', 'whiteAlpha.200');

    const chosen = useMemo(
        () => (Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null && item !== '') : []),
        [value],
    );

    const close = () => {
        if (!isOpen) return;
        setIsOpen(false);
        setQuery('');
        onBlur?.({ target: { name } });
    };

    useOutsideClick({ ref, handler: close });

    // Options not chosen yet which match every word typed
    const results = useMemo(() => {
        const words = searchText(query).split(' ').filter(Boolean);
        const available = options.filter((option) => !chosen.some((item) => sameValue(item, option.value)));
        const matching = words.length
            ? available.filter((option) => {
                const text = searchText(`${option.label} ${option.description || ''}`);
                return words.every((word) => text.includes(word));
            })
            : available;
        return { items: matching.slice(0, MAX_RESULTS), total: matching.length, available: available.length };
    }, [options, chosen, query]);

    const add = (option) => {
        onChange([...chosen, option.value]);
        setQuery('');
    };
    const remove = (item) => onChange(chosen.filter((x) => !sameValue(x, item)));

    const onKeyDown = (e) => {
        if (e.key === 'Escape' && isOpen) {
            // Close the list only, not the dialog around the field
            e.stopPropagation();
            close();
        } else if (e.key === 'Enter' && isOpen && results.items.length) {
            e.preventDefault();
            add(results.items[0]);
        } else if (e.key === 'Backspace' && !query && chosen.length) {
            remove(chosen[chosen.length - 1]);
        }
    };

    return (
        <Box position="relative" ref={ref}>
            {chosen.length > 0 && (
                <Wrap spacing={1.5} mb={2}>
                    {chosen.map((item) => {
                        const option = options.find((o) => sameValue(o.value, item));
                        const label = option?.label || (isLoading ? 'Đang tải...' : 'Không có trong danh sách');
                        return (
                            <WrapItem key={String(item)} maxW="100%">
                                <Tag size="md" borderRadius="full" variant="subtle" colorScheme="brand" maxW="100%" title={option?.description || undefined}>
                                    <TagLabel overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{label}</TagLabel>
                                    {!isDisabled && <TagCloseButton aria-label={`Bỏ chọn ${label}`} onClick={() => remove(item)} />}
                                </Tag>
                            </WrapItem>
                        );
                    })}
                </Wrap>
            )}
            <InputGroup>
                <InputLeftElement pointerEvents="none"><Icon as={MdSearch} color="gray.400" /></InputLeftElement>
                <Input
                    name={name}
                    value={query}
                    placeholder={isOpen ? 'Gõ để tìm...' : placeholder}
                    onFocus={() => setIsOpen(true)}
                    onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                    onKeyDown={onKeyDown}
                    isDisabled={isDisabled}
                    isInvalid={isInvalid}
                    autoComplete="off"
                />
            </InputGroup>
            {isOpen && !isDisabled && (
                <Box position="absolute" zIndex={20} mt={1} w="100%" maxH="260px" overflowY="auto" bg={panelBg} borderWidth="1px" borderRadius="10px" boxShadow="lg">
                    {isLoading && !options.length ? (
                        <Flex align="center" gap={2} px={3} py={2}>
                            <Spinner size="xs" />
                            <Text fontSize="sm" color="gray.500">Đang tải...</Text>
                        </Flex>
                    ) : results.items.length === 0 && (
                        <Text px={3} py={2} color="gray.500" fontSize="sm">
                            {options.length > 0 && results.available === 0 ? 'Đã chọn tất cả' : emptyText}
                        </Text>
                    )}
                    {results.items.map((option) => (
                        <Flex
                            key={option.value}
                            direction="column"
                            px={3}
                            py={2}
                            cursor="pointer"
                            _hover={{ bg: hoverBg }}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => add(option)}
                        >
                            <Text fontSize="sm" fontWeight="600">{option.label}</Text>
                            {option.description && <Text fontSize="xs" color="gray.500">{option.description}</Text>}
                        </Flex>
                    ))}
                    {results.total > MAX_RESULTS && (
                        <Text px={3} py={2} color="gray.400" fontSize="xs">Gõ thêm để thu hẹp kết quả...</Text>
                    )}
                </Box>
            )}
        </Box>
    );
}
