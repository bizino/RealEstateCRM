import { Button, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, useBreakpointValue } from '@chakra-ui/react';

// Dialog of a create / edit form, full screen on phones
export default function FormModal({ isOpen, onClose, title, onSubmit, isSubmitting = false, submitLabel = 'Lưu', size = '3xl', children, footer }) {
    const fullScreen = useBreakpointValue({ base: true, md: false });
    return (
        <Modal isOpen={isOpen} onClose={onClose} size={fullScreen ? 'full' : size} scrollBehavior="inside" closeOnOverlayClick={false}>
            <ModalOverlay />
            <ModalContent borderRadius={fullScreen ? 0 : '16px'}>
                <ModalHeader pr={12}>{title}</ModalHeader>
                <ModalCloseButton />
                <ModalBody pb={6}>{children}</ModalBody>
                <ModalFooter borderTopWidth="1px">
                    {footer}
                    <Button variant="ghost" mr={3} onClick={onClose}>Hủy</Button>
                    {onSubmit && <Button variant="brand" onClick={onSubmit} isLoading={isSubmitting} loadingText="Đang lưu">{submitLabel}</Button>}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
