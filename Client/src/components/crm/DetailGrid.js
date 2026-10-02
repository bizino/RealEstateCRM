import { Box, GridItem, Heading, SimpleGrid, Text } from '@chakra-ui/react';

const isEmpty = (value) => value === undefined || value === null || value === '' || value === false;

// Label / value pairs of a detail page. Empty values show a dash, unless the
// item is marked optional (then it is not shown at all).
export default function DetailGrid({ items, columns = 2, title }) {
    const visible = items.filter((item) => !item.hidden && !(item.optional && isEmpty(item.value)));
    if (!visible.length) return null;
    return (
        <Box>
            {title && <Heading size="sm" mb={3} color="gray.600">{title}</Heading>}
            <SimpleGrid columns={{ base: 1, md: columns }} spacingX={6} spacingY={3}>
                {visible.map((item) => (
                    <GridItem key={item.label} colSpan={{ base: 1, md: Math.min(item.span || 1, columns) }}>
                        <Text fontSize="sm" color="gray.500">{item.label}</Text>
                        <Box fontWeight="600" whiteSpace="pre-wrap" wordBreak="break-word">
                            {isEmpty(item.value) ? <Text as="span" color="gray.400" fontWeight="normal">—</Text> : item.value}
                        </Box>
                    </GridItem>
                ))}
            </SimpleGrid>
        </Box>
    );
}
