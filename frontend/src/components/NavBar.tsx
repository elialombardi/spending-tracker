import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import MenuIcon from '@mui/icons-material/Menu';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useLocation } from 'react-router-dom';
import { ReactNode, useState } from 'react';

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
    const sidebarVisible = isDesktop && !sidebarCollapsed;

    const accountMenu: ReactNode = (
        <UserMenu
            session={session}
            onLogout={onLogout}
            canWrite={canWrite}
            isAdminUser={isAdminUser}
            themeName={themeName}
            setThemeName={setThemeName}
        />
    );

    return (
        <>
            {!sidebarVisible && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Tooltip title="Open navigation">
                        <IconButton
                            edge="start"
                            aria-label="Open navigation"
                            aria-controls={drawerOpen ? 'app-navigation' : undefined}
                            aria-expanded={drawerOpen}
                            onClick={() => isDesktop ? onToggleSidebar() : setDrawerLocation(location)}
                            sx={{ minWidth: 44, minHeight: 44 }}
                        >
                            <MenuIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            )}

            <SidebarNav
                isDesktop={isDesktop}
                open={drawerOpen}
                onClose={closeDrawer}
                collapsed={sidebarCollapsed}
                onCollapse={onToggleSidebar}
                sections={visibleSections}
                currentPath={location.pathname}
                footer={accountMenu}
            />
        </>
    );
}

export default NavBar;
