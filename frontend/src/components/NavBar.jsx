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

function NavBar({ canWrite, onLogout, session, themeName, setThemeName }) {
    const loc = useLocation()
    const path = loc.pathname
    const isAdminUser = session?.role === 'Admin'

    return (
        <AppBar position="static" color="transparent" elevation={0} sx={{ mb: 2 }}>
            <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box component="img" src="/logo.png" alt="App logo" sx={{ height: 40 }} />
                    <Box>
                        <Button component={NavLink} to="/" variant={path === '/' ? 'contained' : 'text'} sx={{ mr: 1 }} end>
                            Map
                        </Button>
                        {isAdminUser ? (
                            <>
                                <Button component={NavLink} to="/tags" variant={path === '/tags' ? 'contained' : 'text'}>
                                    Tags
                                </Button>
                                <Button component={NavLink} to="/dashboard" variant={path === '/dashboard' ? 'contained' : 'text'} sx={{ ml: 1 }}>
                                    Dashboard
                                </Button>
                            </>
                        ) : null}
                    </Box>
                </Box>
                <Box sx={{ alignItems: 'center', display: 'flex', gap: 1.5 }}>
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
            </Toolbar>
        </AppBar>
    );
}

export default NavBar;
