import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { NavLink, useLocation } from 'react-router-dom';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Divider from '@mui/material/Divider';
import { ListItemText, Avatar, Tooltip, Chip, FormControl, Select } from '@mui/material';
import {
    Home,
    Psychology,
    FitnessCenter,
    Note,
    CalendarToday,
    Dashboard,
    Assignment,
    People,
    Logout,
    Euro,
    Palette,
    AdminPanelSettings,
    KeyboardArrowDown,
} from '@mui/icons-material';
import NavMenu from './NavBar/NavMenu';

function NavBar({ canWrite, onLogout, session, themeName, setThemeName }) {
    const loc = useLocation();
    const path = loc.pathname;
    const isAdminUser = session?.role === 'Admin';
    const [drawerOpen, setDrawerOpen] = useState(false);

    // User menu state
    const [userMenuAnchor, setUserMenuAnchor] = useState(null);
    const userMenuOpen = Boolean(userMenuAnchor);


    const closeDrawer = () => setDrawerOpen(false);
    const handleUserMenuOpen = (event) => setUserMenuAnchor(event.currentTarget);
    const handleUserMenuClose = () => setUserMenuAnchor(null);
    const handleTrainingOpen = (event) => setTrainingAnchor(event.currentTarget);
    const handleTrainingClose = () => setTrainingAnchor(null);

    const navItems = [
        { path: '/', label: 'Map', icon: Home },
    ];

    const trainingItems = [
        { path: '/cognitive', label: 'Cognitive Training', icon: Psychology },
        { path: '/workout', label: 'Workout', icon: FitnessCenter },
    ];

    const financeItems = [
        { path: '/dashboard', label: 'Money', icon: Euro },
        { path: '/tasks', label: 'Tasks', icon: Assignment },
    ]

    const personalItems = [
        { path: '/diary', label: 'Diary', icon: CalendarToday },
        { path: '/notes', label: 'Notes', icon: Note },
    ]

    const adminItems = [
        { path: '/users', label: 'Users', icon: People },
    ];


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
            }}
        >
            <Toolbar sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                py: 1,
            }}>
                {/* LEFT: Logo + Mobile Menu */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <IconButton
                        edge="start"
                        aria-label="menu"
                        onClick={() => setDrawerOpen(true)}
                        sx={{ display: { xs: 'inline-flex', md: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>

                    <Box
                        component="img"
                        src="/logo.png"
                        alt="App logo"
                        sx={{
                            height: 32,
                            width: 32,
                            borderRadius: '50%',
                            border: '2px solid',
                            borderColor: 'primary.main',
                        }}
                    />

                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 700,
                            color: 'primary.main',
                            fontSize: { xs: '1rem', sm: '1.25rem' },
                        }}
                    >
                        Picci's Application
                    </Typography>
                </Box>

                {/* CENTER: Desktop Navigation */}
                <Box sx={{
                    display: { xs: 'none', md: 'flex' },
                    alignItems: 'center',
                    gap: 0.5,
                }}>
                    {navItems.map((item) => (
                        <Button
                            key={item.path}
                            component={NavLink}
                            to={item.path}
                            variant={path === item.path ? 'contained' : 'text'}
                            startIcon={<item.icon />}
                            size="small"
                            sx={{
                                textTransform: 'none',
                                fontWeight: 500,
                                fontSize: '0.85rem',
                                px: 2,
                                py: 0.6,
                                borderRadius: 2,
                                color: path === item.path ? 'primary.contrastText' : 'text.primary',
                                bgcolor: path === item.path ? 'primary.main' : 'transparent',
                                '&:hover': {
                                    bgcolor: path === item.path ? 'primary.dark' : 'action.hover',
                                },
                            }}
                        >
                            {item.label}
                        </Button>
                    ))}

                    <NavMenu
                        menuText="Training"
                        items={trainingItems}
                    />
                    {isAdminUser && (
                        <NavMenu
                            menuText="Finances"
                            items={financeItems}
                        />
                    )}
                    {isAdminUser && (
                        <NavMenu
                            menuText="Personal"
                            items={personalItems}
                        />
                    )}

                </Box>

                {/* RIGHT: User Menu */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Tooltip title="User settings">
                        <IconButton
                            onClick={handleUserMenuOpen}
                            size="small"
                            sx={{
                                p: 0.5,
                                border: '2px solid',
                                borderColor: 'primary.main',
                            }}
                        >
                            <Avatar
                                sx={{
                                    width: 32,
                                    height: 32,
                                    bgcolor: 'primary.main',
                                    fontSize: '0.9rem',
                                }}
                            >
                                {session?.username?.charAt(0).toUpperCase() || 'U'}
                            </Avatar>
                        </IconButton>
                    </Tooltip>

                    <Menu
                        anchorEl={userMenuAnchor}
                        open={userMenuOpen}
                        onClose={handleUserMenuClose}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                        sx={{ mt: 1 }}
                        PaperProps={{
                            sx: {
                                minWidth: 220,
                                borderRadius: 2,
                                boxShadow: 3,
                            }
                        }}
                    >
                        {/* User Info */}
                        <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover', borderRadius: '8px 8px 0 0' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {session?.username}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                <Chip
                                    label={session?.role}
                                    size="small"
                                    color={isAdminUser ? 'primary' : 'default'}
                                    icon={isAdminUser ? <AdminPanelSettings fontSize="small" /> : null}
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                                {!canWrite && (
                                    <Chip
                                        label="Read only"
                                        size="small"
                                        color="warning"
                                        sx={{ height: 20, fontSize: '0.7rem' }}
                                    />
                                )}
                            </Box>
                        </Box>

                        <Divider />

                        {/* Theme Selection */}
                        <MenuItem sx={{ gap: 1.5 }}>
                            <Palette fontSize="small" />
                            <FormControl size="small" sx={{ flex: 1 }}>
                                <Select
                                    value={themeName || 'light'}
                                    onChange={(e) => {
                                        setThemeName?.(e.target.value);
                                        localStorage.setItem('theme', e.target.value);
                                        handleUserMenuClose();
                                    }}
                                    sx={{
                                        fontSize: '0.85rem',
                                        '& .MuiSelect-select': { py: 0.5 }
                                    }}
                                >
                                    <MenuItem value="light">☀️ Light</MenuItem>
                                    <MenuItem value="dark">🌙 Dark</MenuItem>
                                    <MenuItem value="solarized">🌅 Solarized</MenuItem>
                                </Select>
                            </FormControl>
                        </MenuItem>

                        <Divider />

                        {/* Admin section in user menu */}
                        {isAdminUser && (
                            <>
                                <MenuItem disabled sx={{ opacity: 0.7, fontSize: '0.75rem', fontWeight: 600, letterSpacing: 0.5 }}>
                                    <AdminPanelSettings fontSize="small" sx={{ mr: 1 }} />
                                    ADMIN
                                </MenuItem>
                                {adminItems.map((item) => (
                                    <MenuItem
                                        key={item.path}
                                        component={NavLink}
                                        to={item.path}
                                        onClick={handleUserMenuClose}
                                        selected={path === item.path}
                                        sx={{
                                            pl: 4,
                                            gap: 1.5,
                                            '&.Mui-selected': {
                                                bgcolor: 'primary.main',
                                                color: 'primary.contrastText',
                                                '&:hover': { bgcolor: 'primary.dark' },
                                            },
                                        }}
                                    >
                                        <item.icon fontSize="small" />
                                        {item.label}
                                    </MenuItem>
                                ))}
                                <Divider />
                            </>
                        )}

                        {/* Logout */}
                        <MenuItem
                            onClick={() => { handleUserMenuClose(); onLogout(); }}
                            sx={{
                                color: 'error.main',
                                gap: 1.5,
                                '&:hover': { bgcolor: 'error.light', color: 'error.contrastText' }
                            }}
                        >
                            <Logout fontSize="small" />
                            Logout
                        </MenuItem>
                    </Menu>
                </Box>
            </Toolbar>

            {/* Mobile Drawer */}
            <Drawer anchor="left" open={drawerOpen} onClose={closeDrawer}>
                <Box sx={{ width: 280, p: 2 }} role="presentation" onClick={closeDrawer} onKeyDown={closeDrawer}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                        <Box component="img" src="/logo.png" alt="App logo" sx={{ height: 36, width: 36, borderRadius: '50%' }} />
                        <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>Picci's App</Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />

                    <List>
                        {navItems.map((item) => (
                            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                                <ListItemButton
                                    component={NavLink}
                                    to={item.path}
                                    selected={path === item.path}
                                    sx={{
                                        borderRadius: 2,
                                        '&.Mui-selected': {
                                            bgcolor: 'primary.main',
                                            color: 'primary.contrastText',
                                            '&:hover': { bgcolor: 'primary.dark' },
                                        },
                                    }}
                                >
                                    <item.icon sx={{ mr: 2 }} />
                                    <ListItemText primary={item.label} />
                                </ListItemButton>
                            </ListItem>
                        ))}

                        {/* Training items in drawer */}
                        <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary' }}>
                            TRAINING
                        </Typography>
                        {trainingItems.map((item) => (
                            <ListItem key={item.path} disablePadding sx={{ mb: 0.5, pl: 2 }}>
                                <ListItemButton
                                    component={NavLink}
                                    to={item.path}
                                    selected={path === item.path}
                                    sx={{
                                        borderRadius: 2,
                                        '&.Mui-selected': {
                                            bgcolor: 'primary.main',
                                            color: 'primary.contrastText',
                                            '&:hover': { bgcolor: 'primary.dark' },
                                        },
                                    }}
                                >
                                    <item.icon sx={{ mr: 2 }} />
                                    <ListItemText primary={item.label} />
                                </ListItemButton>
                            </ListItem>
                        ))}

                        {/* Admin items in drawer */}
                        {isAdminUser && (
                            <>
                                <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary' }}>
                                    ADMIN
                                </Typography>
                                {adminItems.map((item) => (
                                    <ListItem key={item.path} disablePadding sx={{ mb: 0.5, pl: 2 }}>
                                        <ListItemButton
                                            component={NavLink}
                                            to={item.path}
                                            selected={path === item.path}
                                            sx={{
                                                borderRadius: 2,
                                                '&.Mui-selected': {
                                                    bgcolor: 'primary.main',
                                                    color: 'primary.contrastText',
                                                    '&:hover': { bgcolor: 'primary.dark' },
                                                },
                                            }}
                                        >
                                            <item.icon sx={{ mr: 2 }} />
                                            <ListItemText primary={item.label} />
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                            </>
                        )}
                    </List>
                </Box>
            </Drawer>
        </AppBar>
    );
}

export default NavBar;