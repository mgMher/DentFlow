import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
    IconButton, Box, Typography, Divider, Tooltip, useTheme,
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    People as PeopleIcon,
    CalendarMonth as CalendarIcon,
    MedicalServices as TreatmentIcon,
    Receipt as BillingIcon,
    Badge as StaffIcon,
    BarChart as ReportsIcon,
    Settings as SettingsIcon,
    Schedule as ScheduleIcon,
    Notifications as NotificationsIcon,
    ChevronLeft as CollapseIcon,
    ChevronRight as ExpandIcon,
} from '@mui/icons-material';
import { DRAWER_WIDTH, DRAWER_WIDTH_COLLAPSED } from '../../utils/constants';

interface NavItem {
    path: string;
    labelKey: string;
    icon: React.ReactNode;
}

const navItems: NavItem[] = [
    { path: '/dashboard', labelKey: 'nav.dashboard', icon: <DashboardIcon /> },
    { path: '/patients', labelKey: 'nav.patients', icon: <PeopleIcon /> },
    { path: '/appointments', labelKey: 'nav.appointments', icon: <CalendarIcon /> },
    { path: '/treatments', labelKey: 'nav.treatments', icon: <TreatmentIcon /> },
    { path: '/billing', labelKey: 'nav.billing', icon: <BillingIcon /> },
    { path: '/staff', labelKey: 'nav.staff', icon: <StaffIcon /> },
    { path: '/schedule', labelKey: 'nav.schedule', icon: <ScheduleIcon /> },
    { path: '/reports', labelKey: 'nav.reports', icon: <ReportsIcon /> },
    { path: '/notifications', labelKey: 'nav.notifications', icon: <NotificationsIcon /> },
    { path: '/settings', labelKey: 'nav.settings', icon: <SettingsIcon /> },
];

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const width = collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

    return (
        <Drawer
            variant="permanent"
            sx={{
                width,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                    width,
                    boxSizing: 'border-box',
                    backgroundColor: theme.palette.mode === 'dark' ? '#0F1923' : '#FFFFFF',
                    borderRight: `1px solid ${theme.palette.divider}`,
                    transition: 'width 0.2s ease',
                    overflowX: 'hidden',
                },
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', p: 2, minHeight: 64 }}>
                {!collapsed && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                            width: 32, height: 32, borderRadius: '8px',
                            background: 'linear-gradient(135deg, #0B5E6E 0%, #1A8A9E 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#FFF', fontWeight: 800, fontSize: 14,
                        }}>
                            D
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.primary.main }}>
                            DentFlow
                        </Typography>
                    </Box>
                )}
                <IconButton onClick={onToggle} size="small">
                    {collapsed ? <ExpandIcon /> : <CollapseIcon />}
                </IconButton>
            </Box>

            <Divider />

            <List sx={{ px: 1, py: 1 }}>
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');

                    const button = (
                        <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                            <ListItemButton
                                onClick={() => navigate(item.path)}
                                sx={{
                                    borderRadius: 2,
                                    minHeight: 44,
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    px: collapsed ? 1.5 : 2,
                                    backgroundColor: isActive ? `${theme.palette.primary.main}14` : 'transparent',
                                    color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                                    '&:hover': {
                                        backgroundColor: isActive
                                            ? `${theme.palette.primary.main}20`
                                            : theme.palette.action.hover,
                                    },
                                }}
                            >
                                <ListItemIcon sx={{
                                    minWidth: collapsed ? 0 : 40,
                                    color: 'inherit',
                                    justifyContent: 'center',
                                }}>
                                    {item.icon}
                                </ListItemIcon>
                                {!collapsed && <ListItemText primary={t(item.labelKey)} primaryTypographyProps={{ fontSize: 14, fontWeight: isActive ? 600 : 400 }} />}
                            </ListItemButton>
                        </ListItem>
                    );

                    return collapsed ? (
                        <Tooltip key={item.path} title={t(item.labelKey)} placement="right">
                            {button}
                        </Tooltip>
                    ) : button;
                })}
            </List>
        </Drawer>
    );
};

export default Sidebar;
