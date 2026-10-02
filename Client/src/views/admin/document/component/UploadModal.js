import {
    Box, Button, CloseButton, Flex, FormControl, FormErrorMessage, FormHelperText, FormLabel, Icon, Input, Progress, Stack, Text,
    useColorModeValue, Wrap, WrapItem,
} from '@chakra-ui/react';
import FormModal from 'components/crm/FormModal';
import { fileType } from 'components/FolderTreeView/files';
import { useFormik } from 'formik';
import { useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { MdCloudUpload } from 'react-icons/md';
import { toast } from 'react-toastify';
import { documentSchema } from 'schema';
import { apiPost } from 'services/crm';
import { formatNumber } from 'utils/format';

const MAX_FOLDER_SHORTCUTS = 12;

const formatSize = (bytes) => (bytes >= 1024 * 1024
    ? `${formatNumber(bytes / (1024 * 1024), 1)} MB`
    : `${formatNumber(Math.max(1, Math.round(bytes / 1024)), 0)} KB`);

const sameFile = (a, b) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

const cleanName = (value) => String(value || '').trim().replace(/\s+/g, ' ');

// Upload of one or several files into a folder (created when it does not exist)
export default function UploadModal({ isOpen, onClose, folderNames = [], defaultFolder = '', onUploaded }) {
    const [uploaded, setUploaded] = useState(0);
    const dropBg = useColorModeValue('gray.50', 'whiteAlpha.50');
    const dropActiveBg = useColorModeValue('brand.50', 'whiteAlpha.200');
    const initialValues = useMemo(() => ({ folderName: defaultFolder, filename: '', files: [] }), [defaultFolder]);

    const formik = useFormik({
        initialValues,
        enableReinitialize: true,
        validationSchema: documentSchema,
        onSubmit: async (values, { resetForm, setFieldValue }) => {
            const folderName = cleanName(values.folderName);
            const { files } = values;
            const customName = files.length === 1 ? cleanName(values.filename) : '';
            let done = 0;
            setUploaded(0);
            try {
                // One request per file, in order: the first one creates the folder, and
                // the name goes as a text field so that Vietnamese names stay readable
                for (const file of files) {
                    const formData = new FormData();
                    formData.append('folderName', folderName);
                    formData.append('filename', customName || file.name);
                    formData.append('files', file);
                    await apiPost('api/document/add', formData);
                    done += 1;
                    setUploaded(done);
                }
                toast.success(files.length === 1
                    ? `Đã tải lên “${customName || files[0].name}” vào thư mục “${folderName}”`
                    : `Đã tải lên ${files.length} tệp vào thư mục “${folderName}”`);
                resetForm();
                onUploaded?.(folderName);
                onClose();
            } catch (e) {
                if (done) {
                    toast.error(`Đã tải lên ${done}/${files.length} tệp. ${e.message}`);
                    // Only the files not uploaded yet stay in the form
                    setFieldValue('files', files.slice(done));
                    if (files.length - done !== 1) setFieldValue('filename', '');
                    onUploaded?.(folderName);
                } else {
                    toast.error(e.message);
                }
            } finally {
                setUploaded(0);
            }
        },
    });
    const { values, errors, touched, setFieldValue, isSubmitting } = formik;

    // The custom name only applies to a single file
    const setFiles = (files) => {
        setFieldValue('files', files);
        if (files.length !== 1) setFieldValue('filename', '');
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        multiple: true,
        disabled: isSubmitting,
        onDrop: (accepted) => {
            const files = [...values.files];
            accepted.forEach((file) => {
                if (!files.some((existing) => sameFile(existing, file))) files.push(file);
            });
            setFiles(files);
        },
    });

    const close = () => {
        if (isSubmitting) return;
        formik.resetForm();
        onClose();
    };

    const folderError = touched.folderName && errors.folderName;
    const filesError = touched.files && typeof errors.files === 'string' ? errors.files : '';
    const nameError = touched.filename && errors.filename;
    const shortcuts = folderNames.slice(0, MAX_FOLDER_SHORTCUTS);
    const total = values.files.length;

    return (
        <FormModal
            isOpen={isOpen}
            onClose={close}
            title="Tải lên tài liệu"
            onSubmit={formik.handleSubmit}
            isSubmitting={isSubmitting}
            submitLabel="Tải lên"
            size="2xl"
        >
            <Stack spacing={5}>
                <FormControl isInvalid={Boolean(folderError)} isRequired>
                    <FormLabel fontSize="sm" mb={1}>Thư mục</FormLabel>
                    <Input
                        name="folderName"
                        list="document-folder-names"
                        value={values.folderName}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        placeholder="VD: Hợp đồng đặt cọc, Sổ hồng, CCCD khách hàng"
                        autoComplete="off"
                    />
                    <datalist id="document-folder-names">
                        {folderNames.map((folder) => <option key={folder} value={folder} />)}
                    </datalist>
                    {folderError
                        ? <FormErrorMessage>{folderError}</FormErrorMessage>
                        : <FormHelperText>Chọn thư mục có sẵn hoặc nhập tên mới để tạo thư mục.</FormHelperText>}
                    {shortcuts.length > 0 && (
                        <Wrap spacing={2} mt={2}>
                            {shortcuts.map((folder) => (
                                <WrapItem key={folder}>
                                    <Button
                                        size="xs"
                                        borderRadius="full"
                                        variant={cleanName(values.folderName) === folder ? 'solid' : 'outline'}
                                        colorScheme="brandScheme"
                                        onClick={() => setFieldValue('folderName', folder)}
                                    >
                                        {folder}
                                    </Button>
                                </WrapItem>
                            ))}
                        </Wrap>
                    )}
                </FormControl>

                <FormControl isInvalid={Boolean(filesError)} isRequired>
                    <FormLabel fontSize="sm" mb={1}>Tệp</FormLabel>
                    <Flex
                        {...getRootProps()}
                        direction="column"
                        align="center"
                        justify="center"
                        textAlign="center"
                        gap={1}
                        minH="140px"
                        px={4}
                        py={6}
                        borderWidth="2px"
                        borderStyle="dashed"
                        borderColor={filesError ? 'red.300' : isDragActive ? 'brand.500' : 'gray.300'}
                        borderRadius="12px"
                        bg={isDragActive ? dropActiveBg : dropBg}
                        cursor="pointer"
                    >
                        <input {...getInputProps()} />
                        <Icon as={MdCloudUpload} boxSize={10} color="brand.500" />
                        <Text fontWeight="700">{isDragActive ? 'Thả tệp vào đây' : 'Bấm để chọn tệp hoặc kéo thả vào đây'}</Text>
                        <Text fontSize="sm" color="gray.500">Ảnh, PDF, Word, Excel, PowerPoint, tệp nén, video. Có thể chọn nhiều tệp.</Text>
                    </Flex>
                    <FormErrorMessage>{filesError}</FormErrorMessage>
                </FormControl>

                {total > 0 && (
                    <Stack spacing={2}>
                        {values.files.map((file, index) => {
                            const type = fileType(file);
                            return (
                                <Flex key={`${file.name}-${file.size}-${file.lastModified}`} align="center" gap={3} borderWidth="1px" borderRadius="10px" px={3} py={2}>
                                    <Icon as={type.icon} color={type.color} boxSize={6} flexShrink={0} />
                                    <Box flex="1" minW={0}>
                                        <Text fontSize="sm" fontWeight="600" noOfLines={1} wordBreak="break-all" title={file.name}>{file.name}</Text>
                                        <Text fontSize="xs" color="gray.500">{formatSize(file.size)}</Text>
                                    </Box>
                                    <CloseButton
                                        size="sm"
                                        aria-label="Bỏ tệp"
                                        isDisabled={isSubmitting}
                                        onClick={() => setFiles(values.files.filter((_, i) => i !== index))}
                                    />
                                </Flex>
                            );
                        })}
                    </Stack>
                )}

                {total === 1 && (
                    <FormControl isInvalid={Boolean(nameError)}>
                        <FormLabel fontSize="sm" mb={1}>Tên tài liệu</FormLabel>
                        <Input
                            name="filename"
                            value={values.filename}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            placeholder={values.files[0].name}
                            autoComplete="off"
                        />
                        {nameError
                            ? <FormErrorMessage>{nameError}</FormErrorMessage>
                            : <FormHelperText>Để trống để giữ tên tệp. VD: Hợp đồng đặt cọc căn A1-12</FormHelperText>}
                    </FormControl>
                )}

                {isSubmitting && total > 1 && (
                    <Box>
                        <Text fontSize="sm" mb={1}>Đang tải lên {Math.min(uploaded + 1, total)}/{total} tệp...</Text>
                        <Progress value={(uploaded / total) * 100} size="sm" borderRadius="full" colorScheme="brandScheme" hasStripe isAnimated />
                    </Box>
                )}
            </Stack>
        </FormModal>
    );
}
