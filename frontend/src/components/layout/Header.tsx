import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    AppBar, Toolbar, IconButton, Typography, Box, Avatar,
    Menu, MenuItem, Badge, Divider, ListItemIcon, useTheme,
    Select, SelectChangeEvent,
} from '@mui/material';
import {
    Notifications as NotificationsIcon,
    DarkMode as DarkModeIcon,
    LightMode as LightModeIcon,
    Logout as LogoutIcon,
    Settings as SettingsIcon,
    Password as PasswordIcon,
    PhonelinkErase as LogoutAllIcon,
    Menu as MenuIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useHttpState, usePermission } from '../../hooks';
import { PasswordDialog } from '../ui';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { notificationsActions } from '../../store/notifications';
import { authActions } from '../../store/auth';
import { getInitials } from '../../utils/formatters';
import { HEADER_HEIGHT, LANGUAGES } from '../../utils/constants';

/** How often the bell asks for the unread count while the tab is visible. */
const UNREAD_POLL_MS = 60_000;

interface HeaderProps {
    sidebarWidth: number;
    /** Set on phones, where the sidebar is hidden until this button opens it. */
    onMenuClick?: () => void;
    themeMode: 'light' | 'dark';
    onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ sidebarWidth, onMenuClick, themeMode, onToggleTheme }) => {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [passwordOpen, setPasswordOpen] = useState(false);
    const dispatch = useDispatch();
    const can = usePermission();
    const changePassword = useHttpState('CHANGE_PASSWORD');
    const unreadCount = useSelector((state: RootState) => state.notifications.unreadCount);
    const userId = user?._id;

    // Real unread count: on load, every minute while the tab is visible, and
    // as soon as the user comes back to the tab.
    React.useEffect(() => {
        if (!userId) return undefined;
        const refresh = () => {
            if (document.visibilityState === 'visible') dispatch(notificationsActions.getUnreadCount());
        };
        refresh();
        const timer = window.setInterval(refresh, UNREAD_POLL_MS);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [dispatch, userId]);

    // Close only after the server accepted it, so a wrong current password keeps the form.
    React.useEffect(() => {
        if (changePassword.success) {
            changePassword.clearSuccess();
            setPasswordOpen(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [changePassword.success]);

    const handleLanguageChange = (e: SelectChangeEvent) => {
        const lang = e.target.value;
        i18n.changeLanguage(lang);
        localStorage.setItem('language', lang);
    };

    const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => setAnchorEl(null);

    const handleLogout = () => {
        handleMenuClose();
        // The saga revokes the session server-side, then clears storage and redirects.
        logout();
    };

    return (
        <AppBar
            position="fixed"
            elevation={0}
            sx={{
                width: `calc(100% - ${sidebarWidth}px)`,
                ml: `${sidebarWidth}px`,
                height: HEADER_HEIGHT,
                backgroundColor: theme.palette.background.paper,
                borderBottom: `1px solid ${theme.palette.divider}`,
                transition: 'width 0.2s ease, margin-left 0.2s ease',
            }}
        >
            <Toolbar sx={{ justifyContent: 'flex-end', gap: 1 }}>
                {onMenuClick && (
                    <IconButton onClick={onMenuClick} edge="start" aria-label={t('nav.menu')} sx={{ mr: 'auto' }}>
                        <MenuIcon />
                    </IconButton>
                )}
                <Select
                    value={i18n.language}
                    onChange={handleLanguageChange}
                    size="small"
                    variant="outlined"
                    sx={{ minWidth: 100, '& .MuiSelect-select': { py: 0.5, display: 'flex', alignItems: 'center', gap: 1 } }}
                >
                    {LANGUAGES.map((lang) => (
                        <MenuItem key={lang.code} value={lang.code}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <span>{lang.flag}</span>
                                <span>{lang.label}</span>
                            </Box>
                        </MenuItem>
                    ))}
                </Select>

                <IconButton onClick={onToggleTheme} color="default">
                    {themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>

                <IconButton
                    onClick={() => navigate('/notifications')}
                    color="default"
                    aria-label={t('notifications.bellLabel', { count: unreadCount })}
                >
                    <Badge badgeContent={unreadCount} max={99} color="error">
                        <NotificationsIcon />
                    </Badge>
                </IconButton>

                <IconButton onClick={handleProfileMenuOpen}>
                    <Avatar sx={{ width: 34, height: 34, bgcolor: theme.palette.primary.main, fontSize: 14 }}>
                        {user ? getInitials(user.firstName, user.lastName) : '?'}
                    </Avatar>
                </IconButton>

                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                    slotProps={{ paper: { sx: { minWidth: 200, mt: 1 } } }}
                >
                    <Box sx={{ px: 2, py: 1 }}>
                        <Typography variant="subtitle2">{user?.firstName} {user?.lastName}</Typography>
                        <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
                    </Box>
                    <Divider />
                    {can('manageClinic') && (
                        <MenuItem onClick={() => { handleMenuClose(); navigate('/settings'); }}>
                            <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                            {t('nav.settings')}
                        </MenuItem>
                    )}
                    <MenuItem onClick={() => { handleMenuClose(); changePassword.clearError(); setPasswordOpen(true); }}>
                        <ListItemIcon><PasswordIcon fontSize="small" /></ListItemIcon>
                        {t('auth.changePassword')}
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={handleLogout}>
                        <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                        {t('auth.logout')}
                    </MenuItem>
                    <MenuItem onClick={() => { handleMenuClose(); dispatch(authActions.logoutAll()); }}>
                        <ListItemIcon><LogoutAllIcon fontSize="small" /></ListItemIcon>
                        {t('auth.logoutAll')}
                    </MenuItem>
                </Menu>

                <PasswordDialog
                    open={passwordOpen}
                    title={t('auth.changePassword')}
                    description={t('auth.changePasswordHint')}
                    requireCurrent
                    loading={changePassword.loading}
                    error={changePassword.error}
                    onSubmit={(values) =>
                        dispatch(
                            authActions.changePassword({
                                currentPassword: values.currentPassword || '',
                                newPassword: values.newPassword,
                            }),
                        )
                    }
                    onClose={() => setPasswordOpen(false)}
                />
            </Toolbar>
        </AppBar>
    );
};

export default Header;
