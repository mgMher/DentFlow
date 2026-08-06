import React, { useState } from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { DRAWER_WIDTH, DRAWER_WIDTH_COLLAPSED, HEADER_HEIGHT } from '../../utils/constants';

interface MainLayoutProps {
    themeMode: 'light' | 'dark';
    onToggleTheme: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ themeMode, onToggleTheme }) => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const sidebarWidth = sidebarCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <Header
                sidebarWidth={sidebarWidth}
                themeMode={themeMode}
                onToggleTheme={onToggleTheme}
            />
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    mt: `${HEADER_HEIGHT}px`,
                    ml: 0,
                    backgroundColor: (theme) => theme.palette.background.default,
                    minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
                    transition: 'margin-left 0.2s ease',
                }}
            >
                <Outlet />
            </Box>
        </Box>
    );
};

export default MainLayout;
