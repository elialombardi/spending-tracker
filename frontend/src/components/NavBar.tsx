import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useLocation } from 'react-router-dom';
import { useState } from 'react';

import Logo from './NavBar/Logo';
import SidebarNav from './NavBar/SidebarNav';
import UserMenu from './NavBar/UserMenu';
import { getNavigationSections } from './NavBar/navigationConfig';
import { AuthSession } from '../types/domain';

interface NavBarProps {
    canWrite: boolean;
    onLogout: () => void;
    session: AuthSession | null;
    themeName: string;
    setThemeName: (theme: string) => void;
    sidebarCollapsed: boolean;
    onToggleSidebar: () => void;
}

function NavBar({ canWrite, onLogout, session, themeName, setThemeName, sidebarCollapsed, onToggleSidebar }: NavBarProps) {
    const location = useLocation();
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
    const [drawerLocation, setDrawerLocation] = useState<typeof location | null>(null);
    const drawerOpen = drawerLocation === location && !isDesktop;

    const closeDrawer = () => setDrawerLocation(null);

    const isAdminUser = session?.role === 'Admin';

    const visibleSections = getNavigationSections(isAdminUser);

    return (
        <AppBar
            position="sticky"
            color="default"
            elevation={1}
            sx={{
                mb: 3,
                top: 0,
                zIndex: theme.zIndex.appBar,
                bgcolor: 'background.paper',
                borderBottom: '1px solid',
                borderColor: 'divider',
                flexShrink: 0, // Prevent appbar from shrinking
            }}
        >
            <Toolbar
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 1,
                    minHeight: '64px !important', // Fixed minimum height
                    flexWrap: 'nowrap', // Prevent wrapping
                }}
            >
                <Logo
                    onMenuClick={() => isDesktop ? onToggleSidebar() : setDrawerLocation(location)}
                    drawerOpen={drawerOpen}
                    sidebarCollapsed={sidebarCollapsed}
                />

                <UserMenu
                    session={session}
                    onLogout={onLogout}
                    canWrite={canWrite}
                    isAdminUser={isAdminUser}
                    themeName={themeName}
                    setThemeName={setThemeName}
                />
            </Toolbar>

            <SidebarNav
                isDesktop={isDesktop}
                open={drawerOpen}
                onClose={closeDrawer}
                collapsed={sidebarCollapsed}
                onCollapse={onToggleSidebar}
                sections={visibleSections}
                currentPath={location.pathname}
            />
        </AppBar>
    );
}

export default NavBar;