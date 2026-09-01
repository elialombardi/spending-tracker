import { NavLink } from 'react-router';
import { useState } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'; // Add this import

type NavMenuProps = {
  menuText: string;
  items: { path: string; label: string; icon: React.ElementType }[];
};

function NavMenu({ menuText, items }: NavMenuProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        onClick={handleClick}
        endIcon={<KeyboardArrowDownIcon />} // Add dropdown icon at the end
        sx={{
          color: 'inherit',
          textTransform: 'none',
          fontWeight: 500,
        }}
      >
        {menuText}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        sx={{ mt: 1 }}
      >
        {items.map((item) => (
          <MenuItem
            key={item.path}
            component={NavLink}
            to={item.path}
            onClick={handleClose}
            selected={window.location.pathname === item.path}
            sx={{
              gap: 1.5,
              minWidth: 180,
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
      </Menu>
    </>
  );
}

export default NavMenu;