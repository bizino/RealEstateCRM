import { Badge, Text } from '@chakra-ui/react';
import { colorOf, labelOf } from 'constants/realEstate';

// Colored label of a status code (see constants/realEstate)
export default function StatusBadge({ options, value, empty = '' }) {
    const label = labelOf(options, value);
    if (!label) return empty ? <Text as="span" color="gray.400">{empty}</Text> : null;
    return (
        <Badge colorScheme={colorOf(options, value)} variant="subtle" borderRadius="md" px={2} py={0.5} textTransform="none" fontWeight="600" whiteSpace="nowrap">
            {label}
        </Badge>
    );
}
