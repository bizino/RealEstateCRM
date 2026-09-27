import { ChevronDownIcon, ChevronRightIcon } from '@chakra-ui/icons';
import {
    Badge, Box, Collapse, Flex, Icon, IconButton, Link, Menu, MenuButton, MenuItem, MenuList, Portal, Stack, StackDivider, Text,
    Tooltip, useColorModeValue,
} from '@chakra-ui/react';
import { Children, useState } from 'react';
import { FcFolder, FcOpenedFolder } from 'react-icons/fc';
import { MdDelete, MdDownload, MdLink, MdMoreVert, MdPerson, MdUploadFile } from 'react-icons/md';
import { Link as RouterLink } from 'react-router-dom';
import { toast } from 'react-toastify';
import { formatDate } from 'utils/format';
import { downloadDocument, fileType } from './files';

function FileRow({ file, name, download, onLink, onDelete, from, linkedName }) {
    const [isDownloading, setIsDownloading] = useState(false);
    const type = fileType(file);
    // Customer pages (from="contact" / "lead") only list and download
    const canManage = !from;
    const linkPath = file?.linkContact ? `/contacts/${file.linkContact}` : file?.linkLead ? `/leads/${file.linkLead}` : '';
    const title = name || file?.fileName || 'Tài liệu';

    const handleDownload = async () => {
        if (download) {
            download(file._id);
            return;
        }
        setIsDownloading(true);
        try {
            await downloadDocument(file);
        } catch (e) {
            toast.error(e.message);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <Flex align="center" gap={3} px={3} py={2.5}>
            <Icon as={type.icon} color={type.color} boxSize={7} flexShrink={0} />
            <Box flex="1" minW={0}>
                <Text fontWeight="600" fontSize="sm" noOfLines={2} wordBreak="break-word" title={title}>{title}</Text>
                <Flex fontSize="xs" color="gray.500" columnGap={3} rowGap={0.5} wrap="wrap" align="center">
                    <Text as="span">{[type.label, formatDate(file?.createOn)].filter(Boolean).join(' · ')}</Text>
                    {canManage && linkPath && (
                        <Link as={RouterLink} to={linkPath} color="brand.500" display="inline-flex" alignItems="center" gap={1}>
                            <Icon as={MdPerson} />
                            {linkedName || (file.linkContact ? 'Khách hàng đã liên kết' : 'Khách tiềm năng đã liên kết')}
                        </Link>
                    )}
                </Flex>
            </Box>
            <Tooltip label="Tải xuống" hasArrow>
                <IconButton
                    size="sm"
                    variant="ghost"
                    icon={<Icon as={MdDownload} boxSize={5} />}
                    aria-label="Tải xuống"
                    onClick={handleDownload}
                    isLoading={isDownloading}
                />
            </Tooltip>
            {canManage && (onLink || onDelete) && (
                <Menu placement="bottom-end" isLazy>
                    <MenuButton as={IconButton} size="sm" variant="ghost" icon={<Icon as={MdMoreVert} boxSize={5} />} aria-label="Thao tác khác" />
                    {/* In a portal: the folder box clips its content */}
                    <Portal>
                        <MenuList fontSize="sm" zIndex={30}>
                            {onLink && (
                                <MenuItem icon={<Icon as={MdLink} boxSize={4} />} onClick={() => onLink(file)}>
                                    Liên kết với khách hàng / khách tiềm năng
                                </MenuItem>
                            )}
                            {onDelete && (
                                <MenuItem icon={<Icon as={MdDelete} boxSize={4} />} color="red.500" onClick={() => onDelete(file)}>
                                    Xóa
                                </MenuItem>
                            )}
                        </MenuList>
                    </Portal>
                </Menu>
            )}
        </Flex>
    );
}

function FolderRow({ name, item, children, isOpen: forceOpen, defaultOpen = false, showOwner = true, onUpload }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const open = Boolean(forceOpen) || isOpen;
    const hoverBg = useColorModeValue('gray.50', 'whiteAlpha.50');
    const borderColor = useColorModeValue('gray.200', 'whiteAlpha.200');
    const count = item?.files?.length ?? Children.count(children);

    return (
        <Box borderWidth="1px" borderColor={borderColor} borderRadius="12px" overflow="hidden" w="100%">
            <Flex align="center" gap={2} pl={2} pr={3} py={2.5} _hover={{ bg: hoverBg }}>
                <Flex
                    as="button"
                    type="button"
                    flex="1"
                    minW={0}
                    align="center"
                    gap={2}
                    textAlign="left"
                    onClick={() => setIsOpen((value) => !value)}
                    aria-expanded={open}
                >
                    {open ? <ChevronDownIcon boxSize={5} color="gray.500" /> : <ChevronRightIcon boxSize={5} color="gray.500" />}
                    <Icon as={open ? FcOpenedFolder : FcFolder} boxSize={7} flexShrink={0} />
                    <Box minW={0}>
                        <Text fontWeight="700" noOfLines={1} wordBreak="break-all" title={name}>{name}</Text>
                        {showOwner && item?.createByName && <Text fontSize="xs" color="gray.500" noOfLines={1}>Người tạo: {item.createByName}</Text>}
                    </Box>
                </Flex>
                <Badge borderRadius="full" px={2} textTransform="none" flexShrink={0}>{count} tệp</Badge>
                {onUpload && (
                    <Tooltip label="Tải lên vào thư mục này" hasArrow>
                        <IconButton size="sm" variant="ghost" icon={<Icon as={MdUploadFile} boxSize={5} />} aria-label="Tải lên vào thư mục này" onClick={() => onUpload(name)} />
                    </Tooltip>
                )}
            </Flex>
            <Collapse in={open} animateOpacity unmountOnExit>
                <Stack spacing={0} divider={<StackDivider borderColor={borderColor} />} borderTopWidth="1px" borderColor={borderColor}>
                    {children}
                </Stack>
            </Collapse>
        </Box>
    );
}

// Folder of documents with its files (children), or one file (isFile + data).
// Used by the documents page and the documents of the customer pages, where
// `from` ("contact" / "lead") only keeps the download.
// Folder: name, item (folder with files, createByName), isOpen (forced open),
//   defaultOpen, showOwner, onUpload(folderName)
// File: data (file), name, download(id) (optional, else the file is downloaded
//   with the session token), onLink(file), onDelete(file), linkedName, from
export default function FolderTreeView({
    isFile, data, name, item, children, download, onLink, onDelete, from, linkedName, isOpen, defaultOpen, showOwner, onUpload,
}) {
    if (isFile) {
        return <FileRow file={data} name={name} download={download} onLink={onLink} onDelete={onDelete} from={from} linkedName={linkedName} />;
    }
    return (
        <FolderRow name={name} item={item} isOpen={isOpen} defaultOpen={defaultOpen} showOwner={showOwner} onUpload={onUpload}>
            {children}
        </FolderRow>
    );
}
