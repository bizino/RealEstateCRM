import {
    Box, Button, Flex, Icon, Input, InputGroup, InputLeftElement, Spinner, Stack, Text, useDisclosure,
} from '@chakra-ui/react';
import FolderTreeView from 'components/FolderTreeView/folderTreeView';
import Card from 'components/card/Card';
import ConfirmDialog from 'components/crm/ConfirmDialog';
import useApiData from 'hooks/useApiData';
import { useCallback, useMemo, useState } from 'react';
import { MdCloudUpload, MdSearch } from 'react-icons/md';
import { toast } from 'react-toastify';
import { apiDelete, currentUser } from 'services/crm';
import { displayName, formatPhone, parseDate, searchText, userName } from 'utils/format';
import LinkModal from './component/LinkModal';
import UploadModal from './component/UploadModal';

const asList = (data) => (Array.isArray(data) ? data : []);
const timeOf = (file) => parseDate(file.createOn)?.getTime() || 0;
const byName = (a, b) => String(a || '').localeCompare(String(b || ''), 'vi', { sensitivity: 'base', numeric: true });

export default function Documents() {
    const me = currentUser();
    const isAdmin = me?.role === 'admin';
    const myName = userName(me);
    const { data, isLoading, reload } = useApiData('api/document/');
    const upload = useDisclosure();
    const link = useDisclosure();
    const remove = useDisclosure();
    const [uploadFolder, setUploadFolder] = useState('');
    // File being linked or deleted
    const [target, setTarget] = useState(null);
    const [query, setQuery] = useState('');

    // Folders in alphabetical order, newest files first
    const folders = useMemo(() => asList(data)
        .map((folder) => ({ ...folder, files: [...(folder.files || [])].sort((a, b) => timeOf(b) - timeOf(a)) }))
        .sort((a, b) => byName(a.folderName, b.folderName)), [data]);
    const folderNames = useMemo(() => [...new Set(folders.map((folder) => folder.folderName).filter(Boolean))], [folders]);
    const fileCount = folders.reduce((sum, folder) => sum + folder.files.length, 0);

    // Names of the linked customers: the lists are only loaded when needed
    const hasContactLinks = folders.some((folder) => folder.files.some((file) => file.linkContact));
    const hasLeadLinks = folders.some((folder) => folder.files.some((file) => file.linkLead));
    const { data: contactData, isLoading: loadingContacts } = useApiData('api/contact/', { enabled: link.isOpen || hasContactLinks });
    const { data: leadData, isLoading: loadingLeads } = useApiData('api/lead/', { enabled: link.isOpen || hasLeadLinks });
    const contacts = useMemo(() => asList(contactData), [contactData]);
    const leads = useMemo(() => asList(leadData), [leadData]);

    const linkedNames = useMemo(() => {
        const names = new Map();
        contacts.forEach((contact) => names.set(`contact:${contact._id}`, displayName(contact) || formatPhone(contact.phoneNumber)));
        leads.forEach((lead) => names.set(`lead:${lead._id}`, lead.leadName || formatPhone(lead.leadPhoneNumber)));
        return names;
    }, [contacts, leads]);

    const linkedName = useCallback((file) => {
        if (file.linkContact) return linkedNames.get(`contact:${file.linkContact}`) || '';
        if (file.linkLead) return linkedNames.get(`lead:${file.linkLead}`) || '';
        return '';
    }, [linkedNames]);

    // Search ignoring accents in the folder name, the file name and the linked customer
    const visibleFolders = useMemo(() => {
        const words = searchText(query).split(' ').filter(Boolean);
        if (!words.length) return folders;
        const matches = (text) => {
            const value = searchText(text);
            return words.every((word) => value.includes(word));
        };
        return folders
            .map((folder) => ({ ...folder, files: folder.files.filter((file) => matches(`${folder.folderName} ${file.fileName} ${linkedName(file)}`)) }))
            .filter((folder) => folder.files.length);
    }, [folders, query, linkedName]);

    const openUpload = (folderName = '') => {
        setUploadFolder(typeof folderName === 'string' ? folderName : '');
        upload.onOpen();
    };
    const openLink = (file) => {
        setTarget(file);
        link.onOpen();
    };
    const openDelete = (file) => {
        setTarget(file);
        remove.onOpen();
    };

    // Admins see the folders of everyone: uploads always go to their own folders
    const canUploadTo = (folder) => !isAdmin || (folder.createByName && folder.createByName === myName);

    const deleteDocument = async () => {
        try {
            await apiDelete(`api/document/delete/${target._id}`);
            toast.success('Đã xóa tài liệu');
            reload();
        } catch (e) {
            toast.error(e.message);
            throw e;
        }
    };

    const renderContent = () => {
        if (isLoading && !folders.length) return <Flex justify="center" py={10}><Spinner /></Flex>;
        if (!folders.length) {
            return (
                <Stack align="center" spacing={3} py={10} textAlign="center">
                    <Icon as={MdCloudUpload} boxSize={12} color="gray.300" />
                    <Text color="gray.500">Chưa có tài liệu nào. Bấm “Tải lên” để lưu hợp đồng, giấy tờ của khách.</Text>
                </Stack>
            );
        }
        if (!visibleFolders.length) return <Text textAlign="center" color="gray.500" py={10}>Không tìm thấy tài liệu phù hợp</Text>;
        return (
            <Stack spacing={3}>
                {visibleFolders.map((folder) => (
                    <FolderTreeView
                        key={folder._id}
                        name={folder.folderName}
                        item={folder}
                        isOpen={Boolean(query.trim())}
                        showOwner={isAdmin}
                        onUpload={canUploadTo(folder) ? openUpload : undefined}
                    >
                        {folder.files.map((file) => (
                            <FolderTreeView
                                key={file._id}
                                isFile
                                data={file}
                                name={file.fileName}
                                linkedName={linkedName(file)}
                                onLink={openLink}
                                onDelete={openDelete}
                            />
                        ))}
                    </FolderTreeView>
                ))}
            </Stack>
        );
    };

    return (
        <>
            <Card px={{ base: 3, md: 5 }} py={{ base: 4, md: 5 }}>
                <Flex mb={4} gap={3} direction={{ base: 'column', lg: 'row' }} align={{ base: 'stretch', lg: 'center' }} justify="space-between">
                    <Box>
                        <Text fontSize={{ base: 'lg', md: '22px' }} fontWeight="700" lineHeight="1.2">
                            Tài liệu <Text as="span" color="gray.400" fontWeight="600">({fileCount})</Text>
                        </Text>
                        <Text fontSize="sm" color="gray.500" mt={1}>
                            Lưu hợp đồng, giấy tờ pháp lý theo thư mục và liên kết với hồ sơ khách hàng.
                        </Text>
                    </Box>
                    <Flex gap={2} direction={{ base: 'column', md: 'row' }}>
                        <InputGroup minW={{ md: '280px' }}>
                            <InputLeftElement pointerEvents="none"><Icon as={MdSearch} color="gray.400" /></InputLeftElement>
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Tìm thư mục, tên tài liệu, khách..."
                                borderRadius="10px"
                            />
                        </InputGroup>
                        <Button leftIcon={<Icon as={MdCloudUpload} />} variant="brand" onClick={() => openUpload('')} flexShrink={0}>
                            Tải lên
                        </Button>
                    </Flex>
                </Flex>
                {renderContent()}
            </Card>

            <UploadModal
                isOpen={upload.isOpen}
                onClose={upload.onClose}
                folderNames={folderNames}
                defaultFolder={uploadFolder}
                onUploaded={reload}
            />
            <LinkModal
                isOpen={link.isOpen}
                onClose={link.onClose}
                file={target}
                contacts={contacts}
                leads={leads}
                loadingContacts={loadingContacts}
                loadingLeads={loadingLeads}
                onLinked={reload}
            />
            <ConfirmDialog
                isOpen={remove.isOpen}
                onClose={remove.onClose}
                onConfirm={deleteDocument}
                title="Xóa tài liệu"
                message={`Xóa tài liệu “${target?.fileName || ''}”? Tài liệu sẽ không còn hiện trong thư mục và hồ sơ khách.`}
                confirmLabel="Xóa"
            />
        </>
    );
}
