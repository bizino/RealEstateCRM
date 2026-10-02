import { AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, Button } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';

// Confirmation before a destructive or important action. onConfirm may be
// async: the button waits for it and the dialog closes when it succeeds.
export default function ConfirmDialog({ isOpen, onClose, onConfirm, title = 'Xác nhận', message, confirmLabel = 'Đồng ý', colorScheme = 'red' }) {
    const cancelRef = useRef();
    const [isLoading, setIsLoading] = useState(false);
    // onConfirm may navigate away (deleting the record of the page)
    const mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; }, []);

    const confirm = async () => {
        setIsLoading(true);
        try {
            await onConfirm();
            if (mounted.current) onClose();
        } catch (e) {
            // the caller reports the error
        } finally {
            if (mounted.current) setIsLoading(false);
        }
    };

    return (
        <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose} isCentered>
            <AlertDialogOverlay>
                <AlertDialogContent mx={4}>
                    <AlertDialogHeader fontSize="lg" fontWeight="bold">{title}</AlertDialogHeader>
                    <AlertDialogBody>{message}</AlertDialogBody>
                    <AlertDialogFooter>
                        <Button ref={cancelRef} onClick={onClose} variant="ghost">Hủy</Button>
                        <Button colorScheme={colorScheme} onClick={confirm} ml={3} isLoading={isLoading}>{confirmLabel}</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialogOverlay>
        </AlertDialog>
    );
}
