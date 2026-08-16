import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import { NavLink, useLocation } from 'react-router-dom'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { useState } from 'react'
import IconButton from '@mui/material/IconButton'
import MenuIcon from '@mui/icons-material/Menu'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'

function NavBar({ canWrite, onLogout, session, themeName, setThemeName }) {
    const loc = useLocation()
    const path = loc.pathname
    const isAdminUser = session?.role === 'Admin'
    const [drawerOpen, setDrawerOpen] = useState(false)

    const closeDrawer = () => setDrawerOpen(false)

    return (
        <AppBar position="static" color="transparent" elevation={0} sx={{ mb: 2 }}>
            <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton
                        edge="start"
                        color="inherit"
                        aria-label="menu"
                        onClick={() => setDrawerOpen(true)}
                        sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>

                    <Box
                        component="img"
                        src="/logo.png"
                        alt="App logo"
                        sx={{
                            height: { xs: 32, sm: 40 },
                            width: { xs: 32, sm: 40 },
                            borderRadius: '50%',
                            objectFit: 'cover',
                        }}
                    />
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                        <Button component={NavLink} to="/" variant={path === '/' ? 'contained' : 'text'} sx={{ mr: 1 }} end>
                            Map
                        </Button>
                        <Button component={NavLink} to="/cognitive" variant={path === '/cognitive' ? 'contained' : 'text'} sx={{ ml: 1 }}>
                            Cognitive Traning
                        </Button>
                        <Button component={NavLink} to="/workout" variant={path === '/workout' ? 'contained' : 'text'} sx={{ ml: 1 }}>
                            Workout
                        </Button>
                        {isAdminUser ? (
                            <>
                                {/* <Button component={NavLink} to="/admin/tags" variant={path === '/admin/tags' ? 'contained' : 'text'}>
                                    Tags
                                </Button> */}
                                <Button component={NavLink} to="/dashboard" variant={path === '/dashboard' ? 'contained' : 'text'} sx={{ ml: 1 }}>
                                    Dashboard
                                </Button>
                                <Button component={NavLink} to="/tasks" variant={path === '/tasks' ? 'contained' : 'text'} sx={{ ml: 1 }}>
                                    Tasks
                                </Button>
                            </>
                        ) : null}
                    </Box>
                </Box>

                <Box sx={{ alignItems: 'center', display: { xs: 'none', sm: 'flex' }, gap: 1.5 }}>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel id="theme-select-label">Theme</InputLabel>
                        <Select
                            labelId="theme-select-label"
                            value={themeName || 'light'}
                            label="Theme"
                            onChange={(e) => { setThemeName?.(e.target.value); localStorage.setItem('theme', e.target.value); }}
                        >
                            <MenuItem value="light">Light</MenuItem>
                            <MenuItem value="dark">Dark</MenuItem>
                            <MenuItem value="solarized">Solarized Dark</MenuItem>
                        </Select>
                    </FormControl>

                    <Typography color="text.secondary" variant="body2">
                        {session.username} · {session.role}{canWrite ? '' : ' · Read only'}
                    </Typography>
                    <Button onClick={onLogout} variant="outlined">
                        Logout
                    </Button>
                </Box>

                <Drawer anchor="left" open={drawerOpen} onClose={closeDrawer}>
                    <Box sx={{ width: 280 }} role="presentation" onClick={closeDrawer} onKeyDown={closeDrawer}>
                        <List>
                            <ListItem>
                                <ListItemButton component={NavLink} to="/">
                                    <ListItemText primary="Map" />
                                </ListItemButton>
                            </ListItem>
                            <ListItem>
                                <ListItemButton component={NavLink} to="/cognitive">
                                    <ListItemText primary="Cognitive Traning" />
                                </ListItemButton>
                            </ListItem>
                            <ListItem>
                                <ListItemButton component={NavLink} to="/workout">
                                    <ListItemText primary="Workout" />
                                </ListItemButton>
                            </ListItem>
                            {isAdminUser ? (
                                <>
                                    <ListItem>
                                        <ListItemButton component={NavLink} to="/admin/tags">
                                            <ListItemText primary="Tags" />
                                        </ListItemButton>
                                    </ListItem>
                                    <ListItem>
                                        <ListItemButton component={NavLink} to="/dashboard">
                                            <ListItemText primary="Dashboard" />
                                        </ListItemButton>
                                    </ListItem>
                                    <ListItem>
                                        <ListItemButton component={NavLink} to="/tasks">
                                            <ListItemText primary="Tasks" />
                                        </ListItemButton>
                                    </ListItem>
                                </>
                            ) : null}
                        </List>
                        <Divider />
                        <Box sx={{ p: 2 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="theme-select-label-drawer">Theme</InputLabel>
                                <Select
                                    labelId="theme-select-label-drawer"
                                    value={themeName || 'light'}
                                    label="Theme"
                                    onChange={(e) => { setThemeName?.(e.target.value); localStorage.setItem('theme', e.target.value); }}
                                >
                                    <MenuItem value="light">Light</MenuItem>
                                    <MenuItem value="dark">Dark</MenuItem>
                                    <MenuItem value="solarized">Solarized Dark</MenuItem>
                                </Select>
                            </FormControl>

                            <Typography sx={{ mt: 2 }} color="text.secondary" variant="body2">{session.username} · {session.role}{canWrite ? '' : ' · Read only'}</Typography>
                            <Button fullWidth sx={{ mt: 2 }} variant="outlined" onClick={onLogout}>Logout</Button>
                        </Box>
                    </Box>
                </Drawer>
            </Toolbar>
        </AppBar>
    );
}

export default NavBar;
