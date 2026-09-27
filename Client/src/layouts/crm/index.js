import {
    Avatar, Box, Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerOverlay, Flex, Heading, HStack, Icon, IconButton,
    Image, Menu, MenuButton, MenuDivider, MenuItem, MenuList, Spinner, Text, useColorMode, useColorModeValue, useDisclosure,
} from '@chakra-ui/react';
import { COMPANY_NAME, LOGO_URL } from 'config';
import jwtDecode from 'jwt-decode';
import { Suspense, useCallback, useEffect } from 'react';
import { IoMenuOutline } from 'react-icons/io5';
import { MdDarkMode, MdLightMode, MdLogout, MdPerson } from 'react-icons/md';
import { matchPath, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import routes from 'routes';
import { currentUser } from 'services/crm';
import { userName } from 'utils/format';

const SIDEBAR_WIDTH = '260px';

const roleLabel = (role) => (role === 'admin' ? 'Quản trị viên' : 'Nhân viên');

function Brand() {
    const color = useColorModeValue('navy.700', 'white');
    return (
        <Flex align="center" justify="center" px={4} py={6} minH="84px">
            {LOGO_URL
                ? <Image src={LOGO_URL} alt={COMPANY_NAME} maxH="48px" objectFit="contain" />
                : <Heading size="md" textAlign="center" color={color}>{COMPANY_NAME}</Heading>}
        </Flex>
    );
}

function SidebarLinks({ items, onNavigate }) {
    const location = useLocation();
    const activeBg = useColorModeValue('brand.50', 'whiteAlpha.100');
    const activeColor = useColorModeValue('brand.600', 'white');
    const color = useColorModeValue('gray.600', 'gray.300');
    const sectionColor = useColorModeValue('gray.400', 'gray.500');

    return (
        <Box px={3} pb={6}>
            {items.map((route) => {
                // Detail pages keep the menu entry of their list active
                const active = location.pathname === route.path || location.pathname.startsWith(`${route.path}/`);
                return (
                    <Box key={route.path}>
                        {route.section && (
                            <Text px={3} pt={5} pb={2} fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="wide" color={sectionColor}>
                                {route.section}
                            </Text>
                        )}
                        <NavLink to={route.path} onClick={onNavigate}>
                            <HStack
                                spacing={3}
                                px={3}
                                py={2.5}
                                borderRadius="10px"
                                bg={active ? activeBg : 'transparent'}
                                color={active ? activeColor : color}
                                fontWeight={active ? '700' : '500'}
                                _hover={{ bg: activeBg }}
                            >
                                <Box color={active ? 'brand.500' : 'inherit'} display="flex">{route.icon}</Box>
                                <Text fontSize="sm">{route.name}</Text>
                            </HStack>
                        </NavLink>
                    </Box>
                );
            })}
        </Box>
    );
}

function TopBar({ title, menuItems, user, onLogout }) {
    const drawer = useDisclosure();
    const { colorMode, toggleColorMode } = useColorMode();
    const navigate = useNavigate();
    const bg = useColorModeValue('rgba(244, 247, 254, 0.85)', 'rgba(11, 20, 55, 0.85)');
    const drawerBg = useColorModeValue('white', 'navy.800');

    return (
        <Flex
            position="sticky"
            top={0}
            zIndex={10}
            bg={bg}
            backdropFilter="blur(12px)"
            px={{ base: 3, md: 6 }}
            py={3}
            align="center"
            gap={3}
        >
            <IconButton
                display={{ base: 'inline-flex', xl: 'none' }}
                icon={<Icon as={IoMenuOutline} boxSize={6} />}
                variant="ghost"
                aria-label="Mở menu"
                onClick={drawer.onOpen}
            />
            <Heading size="md" noOfLines={1} flex="1">{title}</Heading>
            <IconButton
                icon={<Icon as={colorMode === 'light' ? MdDarkMode : MdLightMode} boxSize={5} />}
                variant="ghost"
                aria-label="Đổi giao diện sáng / tối"
                onClick={toggleColorMode}
            />
            <Menu placement="bottom-end">
                <MenuButton>
                    <HStack spacing={2}>
                        <Avatar size="sm" name={userName(user)} bg="brand.500" color="white" />
                        <Box display={{ base: 'none', md: 'block' }} textAlign="left">
                            <Text fontSize="sm" fontWeight="700" lineHeight="1.2">{userName(user)}</Text>
                            <Text fontSize="xs" color="gray.500">{roleLabel(user?.role)}</Text>
                        </Box>
                    </HStack>
                </MenuButton>
                <MenuList>
                    <MenuItem icon={<MdPerson />} onClick={() => navigate(`/users/${user?._id}`)}>Hồ sơ của tôi</MenuItem>
                    <MenuDivider />
                    <MenuItem icon={<MdLogout />} color="red.500" onClick={() => onLogout()}>Đăng xuất</MenuItem>
                </MenuList>
            </Menu>

            <Drawer isOpen={drawer.isOpen} placement="left" onClose={drawer.onClose}>
                <DrawerOverlay />
                <DrawerContent maxW="280px" bg={drawerBg}>
                    <DrawerCloseButton />
                    <DrawerBody p={0}>
                        <Brand />
                        <SidebarLinks items={menuItems} onNavigate={drawer.onClose} />
                    </DrawerBody>
                </DrawerContent>
            </Drawer>
        </Flex>
    );
}

// Layout of the logged in application (admins and employees)
export default function CrmLayout() {
    const user = currentUser();
    const isAdmin = user?.role === 'admin';
    const location = useLocation();
    const navigate = useNavigate();
    const pageBg = useColorModeValue('secondaryGray.300', 'navy.900');
    const sidebarBg = useColorModeValue('white', 'navy.800');

    const allowed = routes.filter((route) => !route.adminOnly || isAdmin);
    const menuItems = allowed.filter((route) => !route.hidden);
    const current = allowed.find((route) => matchPath({ path: route.path, end: true }, location.pathname));

    useEffect(() => {
        document.title = current ? `${current.name} - ${COMPANY_NAME}` : COMPANY_NAME;
    }, [current]);

    const logout = useCallback((message) => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        navigate('/auth/sign-in');
        if (message) toast.warning(message);
        else toast.success('Đã đăng xuất');
    }, [navigate]);

    // Log out when the session token expires
    useEffect(() => {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) return undefined;
        try {
            const { exp } = jwtDecode(token.replace(/^Bearer\s+/i, ''));
            const remaining = exp * 1000 - Date.now();
            if (remaining <= 0) {
                logout('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
                return undefined;
            }
            // setTimeout does not accept delays above ~24.8 days
            const timer = setTimeout(() => logout('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'), Math.min(remaining, 2 ** 31 - 1));
            return () => clearTimeout(timer);
        } catch (e) {
            return undefined;
        }
    }, [logout]);

    return (
        <Box bg={pageBg} minH="100vh">
            <Box
                display={{ base: 'none', xl: 'block' }}
                position="fixed"
                top={0}
                left={0}
                w={SIDEBAR_WIDTH}
                h="100vh"
                overflowY="auto"
                bg={sidebarBg}
                boxShadow="14px 17px 40px 4px rgba(112, 144, 176, 0.08)"
                zIndex={20}
            >
                <Brand />
                <SidebarLinks items={menuItems} />
            </Box>
            <Box ml={{ base: 0, xl: SIDEBAR_WIDTH }}>
                <TopBar title={current?.name || COMPANY_NAME} menuItems={menuItems} user={user} onLogout={logout} />
                <Box as="main" px={{ base: 3, md: 6 }} pt={2} pb={10}>
                    <Suspense fallback={<Flex justify="center" py={20}><Spinner /></Flex>}>
                        <Routes>
                            {allowed.map((route) => <Route key={route.path} path={route.path} element={<route.component />} />)}
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                    </Suspense>
                </Box>
            </Box>
        </Box>
    );
}
