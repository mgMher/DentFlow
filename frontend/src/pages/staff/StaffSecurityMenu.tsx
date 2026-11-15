import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Button, ListItemIcon, Menu, MenuItem } from '@mui/material';
import { ArrowDropDown as MoreIcon, PhonelinkErase as SignOutIcon, Security as ShieldIcon } from '@mui/icons-material';
import api from '../../api/axios';
import { ConfirmDialog } from '../../components/ui';
import { apiErrorMessage } from '../../utils/apiError';

type Action = 'signOut' | 'resetTwoFactor';

/** F9, for admins on a staff member: sign them out of every device, or reset their two-factor (lost phone). */
const StaffSecurityMenu: React.FC<{ staffId: string; name: string }> = ({ staffId, name }) => {
    const { t } = useTranslation();
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const [action, setAction] = useState<Action | null>(null);
    const [busy, setBusy] = useState(false);

    const run = async () => {
        if (!action) return;
        setBusy(true);
        try {
            await api.post(`/users/${staffId}/${action === 'signOut' ? 'sign-out-everywhere' : 'reset-two-factor'}`);
            toast.success(t(action === 'signOut' ? 'security.staffSignedOut' : 'security.staffTwoFactorReset', { name }));
        } catch (err) {
            toast.error(apiErrorMessage(err));
        } finally {
            setBusy(false);
            setAction(null);
        }
    };

    const open = (a: Action) => {
        setAnchor(null);
        setAction(a);
    };

    return (
        <>
            <Button variant="outlined" startIcon={<ShieldIcon />} endIcon={<MoreIcon />} onClick={(e) => setAnchor(e.currentTarget)}>
                {t('security.staffMenu')}
            </Button>
            <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
                <MenuItem onClick={() => open('signOut')}>
                    <ListItemIcon><SignOutIcon fontSize="small" /></ListItemIcon>
                    {t('security.staffSignOut')}
                </MenuItem>
                <MenuItem onClick={() => open('resetTwoFactor')}>
                    <ListItemIcon><ShieldIcon fontSize="small" /></ListItemIcon>
                    {t('security.staffResetTwoFactor')}
                </MenuItem>
            </Menu>
            <ConfirmDialog
                open={!!action}
                title={t(action === 'resetTwoFactor' ? 'security.staffResetTwoFactor' : 'security.staffSignOut')}
                message={t(action === 'resetTwoFactor' ? 'security.staffResetTwoFactorHint' : 'security.staffSignOutHint', { name })}
                variant="danger"
                confirmDisabled={busy}
                onCancel={() => setAction(null)}
                onConfirm={run}
            />
        </>
    );
};

export default StaffSecurityMenu;
