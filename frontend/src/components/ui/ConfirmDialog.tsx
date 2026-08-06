import React from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogContentText,
    DialogActions, Button,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'default';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, variant = 'default',
}) => {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <DialogContentText>{message}</DialogContentText>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onCancel} color="inherit">
                    {cancelLabel || t('common.cancel')}
                </Button>
                <Button
                    onClick={onConfirm}
                    variant="contained"
                    color={variant === 'danger' ? 'error' : 'primary'}
                >
                    {confirmLabel || t('common.confirm')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDialog;
