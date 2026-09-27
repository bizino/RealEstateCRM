import { Box, Icon, Text, VStack } from '@chakra-ui/react';
import Dropzone from 'components/Dropzone';
import FormModal from 'components/crm/FormModal';
import { useState } from 'react';
import { MdUpload } from 'react-icons/md';
import { toast } from 'react-toastify';
import { apiPost } from 'services/crm';

// Kinds of files of a property: field of the property, upload endpoint
export const MEDIA_KINDS = [
    { field: 'propertyPhotos', endpoint: 'add-property-photos', label: 'Hình ảnh', images: true },
    { field: 'virtualToursOrVideos', endpoint: 'add-virtual-tours-or-videos', label: 'Video' },
    { field: 'floorPlans', endpoint: 'add-floor-plans', label: 'Mặt bằng, bản vẽ' },
    { field: 'propertyDocuments', endpoint: 'add-property-documents', label: 'Giấy tờ pháp lý', private: true },
];

const MAX_FILES = 10;

export default function MediaUpload({ isOpen, onClose, propertyId, kind, onUploaded }) {
    const [files, setFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const close = () => {
        setFiles([]);
        onClose();
    };

    const upload = async () => {
        if (!files.length) {
            toast.error('Chưa chọn tệp');
            return;
        }
        if (files.length > MAX_FILES) {
            toast.error(`Tối đa ${MAX_FILES} tệp mỗi lần`);
            return;
        }
        setIsSubmitting(true);
        try {
            const formData = new FormData();
            files.forEach((file) => formData.append('property', file));
            await apiPost(`api/property/${kind.endpoint}/${propertyId}`, formData);
            toast.success(`Đã tải lên ${files.length} tệp`);
            onUploaded?.();
            close();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <FormModal isOpen={isOpen} onClose={close} title={`Tải lên: ${kind?.label || ''}`} size="lg" onSubmit={upload} isSubmitting={isSubmitting} submitLabel="Tải lên">
            <VStack align="stretch" spacing={3}>
                <Dropzone
                    minH={180}
                    img={kind?.images ? 'img' : ''}
                    onFileSelect={(selected) => setFiles(selected)}
                    content={
                        <Box textAlign="center" whiteSpace="normal">
                            <Icon as={MdUpload} w="56px" h="56px" color="brand.500" />
                            <Text fontWeight="700" color="brand.500">Bấm hoặc kéo thả tệp vào đây</Text>
                            {files.length > 0 && <Text fontSize="sm" color="gray.500">Đã chọn {files.length} tệp</Text>}
                        </Box>
                    }
                />
                <Text fontSize="sm" color="gray.500">
                    {kind?.images ? 'Chỉ nhận file ảnh. ' : ''}Tối đa {MAX_FILES} tệp mỗi lần.
                </Text>
            </VStack>
        </FormModal>
    );
}
