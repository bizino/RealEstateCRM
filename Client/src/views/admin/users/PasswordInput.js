import { Icon, IconButton, Input, InputGroup, InputRightElement } from '@chakra-ui/react';
import { useState } from 'react';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';

// Password field with a button showing what was typed (handy on phones)
export default function PasswordInput({ size = 'md', ...props }) {
    const [show, setShow] = useState(false);
    return (
        <InputGroup size={size}>
            <Input type={show ? 'text' : 'password'} pr="3rem" autoCapitalize="none" autoCorrect="off" spellCheck={false} {...props} />
            <InputRightElement>
                <IconButton
                    size="sm"
                    variant="ghost"
                    icon={<Icon as={show ? MdVisibilityOff : MdVisibility} boxSize={5} color="gray.500" />}
                    aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setShow((value) => !value)}
                />
            </InputRightElement>
        </InputGroup>
    );
}
