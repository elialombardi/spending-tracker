import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import { useLocation } from 'react-router-dom';
import { useState } from 'react';

import Logo from './NavBar/Logo';
import DesktopNav from './NavBar/DesktopNav';
import MobileNav from './NavBar/MobileNav';
import UserMenu from './NavBar/UserMenu';
import { NAV_SECTIONS } from './NavBar/navigationConfig';

interface NavBarProps {
    canWrite: boolean;
    onLogout: () => void;
    session: UserSession | null;
    themeName: string;
    setThemeName: (theme: string) => void;
}

function NavBar({ canWrite, onLogout, session, themeName, setThemeName }: NavBarProps) {
    const location = useLocation();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const closeDrawer = () => setDrawerOpen(false);

    const isAdminUser = session?.role === 'Admin';

    // Filter sections based on user role
    const visibleSections = NAV_SECTIONS.filter(section => {
        if (!section.roles) return true;
        if (isAdminUser && section.roles.includes('Admin')) return true;
        if (!isAdminUser && section.roles.includes('User')) return true;
        return false;
    });

    return (
        <AppBar
            position="sticky"
            color="default"
            elevation={1}
            sx={{
                mb: 3,
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
                <Logo onMenuClick={() => setDrawerOpen(true)} />

                <DesktopNav
                    sections={visibleSections}
                    currentPath={location.pathname}
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

            <MobileNav
                open={drawerOpen}
                onClose={closeDrawer}
                sections={visibleSections}
                currentPath={location.pathname}
            />
        </AppBar>
    );
}

export default NavBar;