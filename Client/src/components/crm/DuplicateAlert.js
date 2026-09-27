import { Alert, AlertIcon, Box, Button, HStack, Link, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

// Answer 409 of the API: the phone number belongs to another customer. The
// record is linked when the user may open it; admins may save anyway.
export default function DuplicateAlert({ error, onForce, isForcing }) {
    if (!error || error.status !== 409) return null;
    const duplicate = error.data?.duplicate;
    const link = duplicate?._id ? `/${duplicate.type === 'lead' ? 'leads' : 'contacts'}/${duplicate._id}` : null;
    return (
        <Alert status="warning" borderRadius="md" mb={4} alignItems="flex-start">
            <AlertIcon />
            <Box>
                <Text fontWeight="600">{error.message}</Text>
                <HStack spacing={3} mt={2}>
                    {link && <Link as={RouterLink} to={link} color="brand.500" fontWeight="600">Mở hồ sơ đã có</Link>}
                    {onForce && <Button size="sm" variant="outline" colorScheme="orange" onClick={onForce} isLoading={isForcing}>Vẫn lưu khách trùng số</Button>}
                </HStack>
            </Box>
        </Alert>
    );
}
