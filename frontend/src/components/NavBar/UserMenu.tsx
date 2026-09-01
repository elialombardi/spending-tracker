import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import { useState } from 'react';
import { AuthSession } from '../../types/domain';
import { useNavigate } from 'react-router-dom';

// Define theme options if needed
const THEMES = ['light', 'dark', 'solarized', 'auto'] as const;

interface UserMenuProps {
  session: AuthSession | null;
  onLogout: () => void;
  canWrite: boolean;
  isAdminUser: boolean;
  themeName: string;
  setThemeName: (theme: string) => void;
}

function UserMenu({
  session,
  onLogout,
  canWrite,
  isAdminUser,
  themeName,
  setThemeName
}: UserMenuProps) {
  console.log(session, 'session in UserMenu');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const navigate = useNavigate();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleThemeChange = (event: any) => {
    setThemeName(event.target.value);
  };

  const handleNavigateToUsers = () => {
    navigate('/users');
    handleClose();
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (!session?.username) return 'U';
    return session.username
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get display name - handle cases where name might have spaces or be "Picci's User"
  const getDisplayName = () => {
    if (!session?.username) return 'User';
    return session.username;
  };

  // Get role display - if session has role property, use it
  const getRoleDisplay = () => {
    if (session?.role) return session.role;
    return 'User';
  };

  return (
    <Box sx={{ flexShrink: 0 }}>
      <Button
        onClick={handleClick}
        variant="contained"
        size="small"
        sx={{
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minHeight: 40,
          whiteSpace: 'nowrap', // Prevent text from wrapping
          flexShrink: 0, // Prevent button from shrinking
        }}
      >
        <Avatar
          sx={{
            width: 28,
            height: 28,
            fontSize: '0.75rem',
            bgcolor: 'primary.dark',
            flexShrink: 0,
          }}
        >
          {getInitials()}
        </Avatar>
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          lineHeight: 1.2,
          flexShrink: 0,
        }}>
          <Typography variant="body2" sx={{
            fontWeight: 500,
            fontSize: '0.8rem',
            whiteSpace: 'nowrap',
          }}>
            {getDisplayName()}
          </Typography>
          <Typography variant="caption" sx={{
            opacity: 0.7,
            fontSize: '0.65rem',
            whiteSpace: 'nowrap',
          }}>
            {getRoleDisplay()}
          </Typography>
        </Box>
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 260,
              maxWidth: 320,
              py: 1,
              mt: 1,
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              overflow: 'visible',
            }
          }
        }}
      >
        {/* User info header with avatar */}
        <Box sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}>
          <Avatar
            sx={{
              width: 48,
              height: 48,
              bgcolor: 'primary.main',
              fontSize: '1.2rem',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {getInitials()}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{
              fontWeight: 600,
              lineHeight: 1.2,
              wordBreak: 'break-word',
            }}>
              {getDisplayName()}
            </Typography>
            {session?.role && (
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                {session.role}
              </Typography>
            )}
            {session?.email && (
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block' }}>
                {session.email}
              </Typography>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem onClick={handleClose} sx={{ py: 1 }}>
          Profile
        </MenuItem>
        <MenuItem onClick={handleClose} sx={{ py: 1 }}>
          Settings
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        {/* Theme selector */}
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Theme
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={themeName}
              onChange={handleThemeChange}
              onClick={(e) => e.stopPropagation()}
              size="small"
              sx={{
                '& .MuiSelect-select': {
                  py: 0.75,
                  fontSize: '0.875rem',
                }
              }}
            >
              {THEMES.map((theme) => (
                <MenuItem key={theme} value={theme}>
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider sx={{ my: 0.5 }} />

        {/* Admin users button */}
        {isAdminUser && (
          <>
            <MenuItem onClick={handleNavigateToUsers} sx={{ py: 1 }}>
              Manage Users
            </MenuItem>
            <Divider sx={{ my: 0.5 }} />
          </>
        )}

        <MenuItem onClick={onLogout} sx={{
          color: 'error.main',
          py: 1,
          '&:hover': {
            backgroundColor: 'error.light',
            color: 'error.dark',
          }
        }}>
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );
}

export default UserMenu;