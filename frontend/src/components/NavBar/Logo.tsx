import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';

interface LogoProps {
  onMenuClick: () => void;
  drawerOpen: boolean;
  sidebarCollapsed: boolean;
}

function Logo({ onMenuClick, drawerOpen, sidebarCollapsed }: LogoProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <IconButton
        edge="start"
        aria-label="Open navigation"
        aria-controls={drawerOpen ? 'app-navigation' : undefined}
        aria-expanded={drawerOpen}
        onClick={onMenuClick}
        sx={{ display: { xs: 'inline-flex', md: sidebarCollapsed ? 'inline-flex' : 'none' }, minWidth: 44, minHeight: 44 }}
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
          display: { xs: 'none', sm: 'block' },
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
        The Picci's
      </Typography>
    </Box>
  );
}

export default Logo;