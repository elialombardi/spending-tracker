import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';

interface LogoProps {
  onMenuClick: () => void;
}

function Logo({ onMenuClick }: LogoProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <IconButton
        edge="start"
        aria-label="menu"
        onClick={onMenuClick}
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
        Picci's
      </Typography>
    </Box>
  );
}

export default Logo;