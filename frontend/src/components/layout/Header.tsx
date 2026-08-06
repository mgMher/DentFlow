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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getInitials } from '../../utils/formatters';
import { HEADER_HEIGHT, LANGUAGES } from '../../utils/constants';

interface HeaderProps {
    sidebarWidth: number;
    themeMode: 'light' | 'dark';
    onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ sidebarWidth, themeMode, onToggleTheme }) => {
    const { t, i18n } = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

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
        logout();
        localStorage.removeItem('access-token');
        localStorage.removeItem('refresh-token');
        window.location.replace('/login');
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

                <IconButton onClick={() => navigate('/notifications')} color="default">
                    <Badge badgeContent={0} color="error">
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
                    <MenuItem onClick={() => { handleMenuClose(); navigate('/settings'); }}>
                        <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                        {t('nav.settings')}
                    </MenuItem>
                    <MenuItem onClick={handleLogout}>
                        <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                        {t('auth.logout')}
                    </MenuItem>
                </Menu>
            </Toolbar>
        </AppBar>
    );
};

export default Header;
