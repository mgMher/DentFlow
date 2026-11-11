import React, { useState } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { DRAWER_WIDTH, DRAWER_WIDTH_COLLAPSED, HEADER_HEIGHT } from '../../utils/constants';

interface MainLayoutProps {
    themeMode: 'light' | 'dark';
    onToggleTheme: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ themeMode, onToggleTheme }) => {
    const theme = useTheme();
    // noSsr: read the width on the first render, so phones don't flash the permanent drawer.
    const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    // On phones the drawer overlays the page, so nothing is offset by it.
    const sidebarWidth = isMobile ? 0 : sidebarCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            {/* App chrome is left out of printouts (invoices). */}
            <Box sx={{ displayPrint: 'none' }}>
                <Sidebar
                    collapsed={!isMobile && sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                    mobile={isMobile}
                    mobileOpen={isMobile && mobileOpen}
                    onMobileClose={() => setMobileOpen(false)}
                />
                <Header
                    sidebarWidth={sidebarWidth}
                    onMenuClick={isMobile ? () => setMobileOpen(true) : undefined}
                    themeMode={themeMode}
                    onToggleTheme={onToggleTheme}
                />
            </Box>
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    // Without this a flex child is at least as wide as its content, so a
                    // wide table or tab bar pushed the whole page into sideways scrolling.
                    minWidth: 0,
                    p: { xs: 2, md: 3 },
                    mt: `${HEADER_HEIGHT}px`,
                    ml: 0,
                    backgroundColor: theme.palette.background.default,
                    minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
                    transition: 'margin-left 0.2s ease',
                    '@media print': { mt: 0, p: 0, backgroundColor: '#fff' },
                }}
            >
                <Outlet />
            </Box>
        </Box>
    );
};

export default MainLayout;
