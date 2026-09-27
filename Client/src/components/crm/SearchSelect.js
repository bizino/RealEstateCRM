import { CloseIcon } from '@chakra-ui/icons';
import { Box, Flex, IconButton, Input, InputGroup, InputRightElement, Text, useColorModeValue } from '@chakra-ui/react';
import { useMemo, useState } from 'react';
import { searchText } from 'utils/format';

const MAX_RESULTS = 50;

// Select with a search box (ignoring accents) for long lists: customers,
// properties, employees. options: [{ value, label, description }]
export default function SearchSelect({ options = [], value, onChange, placeholder = '— Chọn —', isDisabled, isInvalid, name, onBlur, emptyText = 'Không có kết quả' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const panelBg = useColorModeValue('white', 'navy.800');
    const hoverBg = useColorModeValue('gray.100', 'whiteAlpha.200');
    const selectedBg = useColorModeValue('brand.50', 'whiteAlpha.300');

    const selected = options.find((option) => String(option.value) === String(value ?? ''));
    const results = useMemo(() => {
        const words = searchText(query).split(' ').filter(Boolean);
        const matching = words.length
            ? options.filter((option) => {
                const text = searchText(`${option.label} ${option.description || ''}`);
                return words.every((word) => text.includes(word));
            })
            : options;
        return matching.slice(0, MAX_RESULTS);
    }, [options, query]);

    const choose = (option) => {
        onChange(option ? option.value : '');
        setIsOpen(false);
        setQuery('');
    };

    return (
        <Box position="relative">
            <InputGroup>
                <Input
                    name={name}
                    value={isOpen ? query : (selected?.label || '')}
                    placeholder={isOpen ? 'Gõ để tìm...' : (selected ? selected.label : placeholder)}
                    onFocus={() => setIsOpen(true)}
                    onClick={() => setIsOpen(true)}
                    onBlur={() => {
                        setIsOpen(false);
                        setQuery('');
                        onBlur?.({ target: { name } });
                    }}
                    onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') setIsOpen(false);
                        if (e.key === 'Enter' && results.length) { e.preventDefault(); choose(results[0]); }
                    }}
                    isDisabled={isDisabled}
                    isInvalid={isInvalid}
                    autoComplete="off"
                />
                {selected && !isDisabled && (
                    <InputRightElement>
                        <IconButton size="xs" variant="ghost" icon={<CloseIcon boxSize={2} />} aria-label="Bỏ chọn" onClick={() => choose(null)} />
                    </InputRightElement>
                )}
            </InputGroup>
            {isOpen && !isDisabled && (
                // mousedown in the list must not blur the input (which closes the list)
                <Box position="absolute" zIndex={20} mt={1} w="100%" maxH="260px" overflowY="auto" bg={panelBg} borderWidth="1px" borderRadius="10px" boxShadow="lg" onMouseDown={(e) => e.preventDefault()}>
                    {results.length === 0 && <Text px={3} py={2} color="gray.500" fontSize="sm">{emptyText}</Text>}
                    {results.map((option) => (
                        <Flex
                            key={option.value}
                            direction="column"
                            px={3}
                            py={2}
                            cursor="pointer"
                            bg={String(option.value) === String(value ?? '') ? selectedBg : undefined}
                            _hover={{ bg: hoverBg }}
                            onClick={() => choose(option)}
                        >
                            <Text fontSize="sm" fontWeight="600">{option.label}</Text>
                            {option.description && <Text fontSize="xs" color="gray.500">{option.description}</Text>}
                        </Flex>
                    ))}
                    {options.length > MAX_RESULTS && results.length === MAX_RESULTS && (
                        <Text px={3} py={2} color="gray.400" fontSize="xs">Gõ thêm để thu hẹp kết quả...</Text>
                    )}
                </Box>
            )}
        </Box>
    );
}
