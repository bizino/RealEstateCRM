import { CloseIcon } from '@chakra-ui/icons';
import { Button, FormLabel, Grid, GridItem, IconButton, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Text } from '@chakra-ui/react';
import Spinner from 'components/spinner/Spinner';
import { useFormik } from 'formik';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { changePasswordSchema } from 'schema';
import { putApi } from 'services/api';

const ChangePassword = (props) => {
    const { onClose, isOpen, id } = props
    // Users confirm their current password, an admin resetting another user's password does not
    const isSelf = JSON.parse(localStorage.getItem('user'))?._id === id
    const [isLoding, setIsLoding] = useState(false)

    const formik = useFormik({
        initialValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        },
        validationSchema: changePasswordSchema(isSelf),
        onSubmit: () => {
            ChangeData();
        },
    });
    const { errors, touched, values, handleBlur, handleChange, handleSubmit, resetForm } = formik

    const handleClose = () => {
        resetForm()
        onClose(false)
    }

    const ChangeData = async () => {
        try {
            setIsLoding(true)
            let response = await putApi(`api/user/change-password/${id}`, { currentPassword: values.currentPassword, newPassword: values.newPassword })
            if (response && response.status === 200) {
                toast.success('Password changed successfully')
                handleClose()
            } else {
                toast.error(response.response?.data?.message)
            }
        } catch (e) {
            console.log(e);
        }
        finally {
            setIsLoding(false)
        }
    };

    const passwordField = (name, label) => (
        <GridItem colSpan={{ base: 12 }}>
            <FormLabel display='flex' ms='4px' fontSize='sm' fontWeight='500' mb='8px'>
                {label}<Text color={"red"}>*</Text>
            </FormLabel>
            <Input
                fontSize='sm'
                type='password'
                autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'}
                onChange={handleChange} onBlur={handleBlur}
                value={values[name]}
                name={name}
                placeholder={label}
                fontWeight='500'
                borderColor={errors[name] && touched[name] ? "red.300" : null}
            />
            <Text mb='10px' color={'red'}> {errors[name] && touched[name] && errors[name]}</Text>
        </GridItem>
    )

    return (
        <Modal isOpen={isOpen} isCentered>
            <ModalOverlay />
            <ModalContent>
                <ModalHeader justifyContent='space-between' display='flex' >
                    Change Password
                    <IconButton onClick={handleClose} icon={<CloseIcon />} />
                </ModalHeader>
                <ModalBody>
                    <Grid templateColumns="repeat(12, 1fr)" gap={3}>
                        {isSelf && passwordField('currentPassword', 'Current Password')}
                        {passwordField('newPassword', 'New Password')}
                        {passwordField('confirmPassword', 'Confirm New Password')}
                    </Grid>
                </ModalBody>
                <ModalFooter>
                    <Button variant='brand' disabled={isLoding ? true : false} onClick={handleSubmit}>{isLoding ? <Spinner /> : 'Change Password'}</Button>
                    <Button onClick={handleClose}>close</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    )
}

export default ChangePassword
