import { HStack, Icon, IconButton, Tooltip } from '@chakra-ui/react';
import { MdEmail, MdPhone } from 'react-icons/md';
import { SiZalo } from 'react-icons/si';
import { telLink, zaloLink } from 'utils/format';

const stop = (event) => event.stopPropagation();

// Call, Zalo and email buttons of a customer (tel: opens the phone app on mobiles)
export default function ContactActions({ phone, zalo, email, size = 'sm' }) {
    const zaloTarget = zalo || phone;
    if (!phone && !zaloTarget && !email) return null;
    return (
        <HStack spacing={1}>
            {phone && (
                <Tooltip label="Gọi điện" hasArrow>
                    <IconButton as="a" href={telLink(phone)} onClick={stop} size={size} variant="ghost" colorScheme="green" aria-label="Gọi điện" icon={<Icon as={MdPhone} boxSize={5} />} />
                </Tooltip>
            )}
            {zaloTarget && zaloLink(zaloTarget) && (
                <Tooltip label="Nhắn Zalo" hasArrow>
                    <IconButton as="a" href={zaloLink(zaloTarget)} target="_blank" rel="noopener noreferrer" onClick={stop} size={size} variant="ghost" colorScheme="blue" aria-label="Nhắn Zalo" icon={<Icon as={SiZalo} boxSize={6} />} />
                </Tooltip>
            )}
            {email && (
                <Tooltip label="Gửi email" hasArrow>
                    <IconButton as="a" href={`mailto:${email}`} onClick={stop} size={size} variant="ghost" colorScheme="gray" aria-label="Gửi email" icon={<Icon as={MdEmail} boxSize={5} />} />
                </Tooltip>
            )}
        </HStack>
    );
}
