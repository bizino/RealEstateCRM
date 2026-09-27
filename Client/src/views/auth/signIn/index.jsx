import {
    Alert, AlertIcon, Box, Button, Checkbox, Flex, FormControl, FormErrorMessage, FormLabel, Heading, Image, Input, Stack, Text,
    useColorModeValue,
} from '@chakra-ui/react';
import illustration from 'assets/img/auth/PNG-02.png';
import { COMPANY_NAME, LOGO_URL } from 'config';
import { useFormik } from 'formik';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { loginSchema } from 'schema';
import { postApi } from 'services/api';
import { errorMessage } from 'services/crm';
import PasswordInput from 'views/admin/users/PasswordInput';

export default function SignIn() {
    const navigate = useNavigate();
    const [remember, setRemember] = useState(true);
    const [error, setError] = useState('');
    const textColor = useColorModeValue('navy.700', 'white');
    const panelBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100');

    const formik = useFormik({
        initialValues: { username: '', password: '' },
        validationSchema: loginSchema,
        onSubmit: async (values) => {
            setError('');
            // postApi stores the token (localStorage when remembered, else sessionStorage) and the user
            const response = await postApi('api/user/login', { username: values.username.trim(), password: values.password }, remember);
            if (response?.status === 200 && response.data?.token) {
                toast.success('Đăng nhập thành công');
                navigate('/dashboard');
                return;
            }
            const message = errorMessage(response, 'Đăng nhập không thành công, vui lòng thử lại');
            setError(message);
            toast.error(message);
        },
    });

    const fieldError = (name) => (formik.touched[name] && formik.errors[name]) || '';

    return (
        <Flex minH="100vh" w="100%">
            <Flex flex="1" direction="column" px={{ base: 5, md: 12, xl: 20 }} py={{ base: 8, md: 10 }}>
                <Flex flex="1" align="center" justify={{ base: 'center', md: 'flex-start' }}>
                    <Box w="100%" maxW="420px">
                        <Stack spacing={2} mb={8}>
                            {LOGO_URL && <Image src={LOGO_URL} alt={COMPANY_NAME} maxH="56px" maxW="240px" objectFit="contain" mb={3} />}
                            <Text fontWeight="700" color="brand.500" fontSize="lg">{COMPANY_NAME}</Text>
                            <Heading color={textColor} fontSize={{ base: '30px', md: '36px' }}>Đăng nhập</Heading>
                            <Text color="gray.500">Nhập email và mật khẩu để vào hệ thống.</Text>
                        </Stack>

                        <form onSubmit={formik.handleSubmit} noValidate>
                            <Stack spacing={5}>
                                <FormControl isInvalid={Boolean(fieldError('username'))} isRequired>
                                    <FormLabel fontSize="sm" fontWeight="600" color={textColor}>Email</FormLabel>
                                    <Input
                                        name="username"
                                        type="email"
                                        inputMode="email"
                                        autoComplete="username"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        placeholder="email@congty.vn"
                                        size="lg"
                                        fontSize="md"
                                        value={formik.values.username}
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                    />
                                    <FormErrorMessage>{fieldError('username')}</FormErrorMessage>
                                </FormControl>

                                <FormControl isInvalid={Boolean(fieldError('password'))} isRequired>
                                    <FormLabel fontSize="sm" fontWeight="600" color={textColor}>Mật khẩu</FormLabel>
                                    <PasswordInput
                                        name="password"
                                        size="lg"
                                        fontSize="md"
                                        autoComplete="current-password"
                                        placeholder="Nhập mật khẩu"
                                        value={formik.values.password}
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                    />
                                    <FormErrorMessage>{fieldError('password')}</FormErrorMessage>
                                </FormControl>

                                <Checkbox isChecked={remember} onChange={(e) => setRemember(e.target.checked)} colorScheme="brandScheme">
                                    <Text fontSize="sm" color={textColor}>Ghi nhớ đăng nhập</Text>
                                </Checkbox>

                                {error && (
                                    <Alert status="error" borderRadius="md" fontSize="sm">
                                        <AlertIcon />
                                        {error}
                                    </Alert>
                                )}

                                <Button
                                    type="submit"
                                    variant="brand"
                                    size="lg"
                                    w="100%"
                                    isLoading={formik.isSubmitting}
                                    loadingText="Đang đăng nhập"
                                >
                                    Đăng nhập
                                </Button>

                                <Text fontSize="sm" color="gray.500">
                                    Quên mật khẩu? Vui lòng liên hệ quản trị viên để được đặt lại.
                                </Text>
                            </Stack>
                        </form>
                    </Box>
                </Flex>
                <Text mt={8} fontSize="sm" color="gray.400" textAlign={{ base: 'center', md: 'left' }}>
                    © {new Date().getFullYear()} {COMPANY_NAME}
                </Text>
            </Flex>

            <Flex
                display={{ base: 'none', md: 'flex' }}
                w={{ md: '45%', xl: '50%' }}
                bg={panelBg}
                borderBottomLeftRadius={{ md: '120px', xl: '200px' }}
                align="center"
                justify="center"
            >
                <Box bg="white" borderRadius="32px" p={{ md: 6, xl: 10 }} boxShadow="lg" w="50%" maxW="360px">
                    <Image src={illustration} alt={COMPANY_NAME} w="100%" />
                </Box>
            </Flex>
        </Flex>
    );
}
