// components/NavBar/MobileNavMenu.tsx (updated)
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Collapse from '@mui/material/Collapse';
import { useState } from 'react';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { NavLink } from 'react-router-dom';
import { NavItem } from '../../types/navigation';

interface MobileNavMenuProps {
  menuText: string;
  items: NavItem[];
  currentPath: string;
  onNavigate: () => void;
}

function MobileNavMenu({ menuText, items, currentPath, onNavigate }: MobileNavMenuProps) {
  const [open, setOpen] = useState(false);

  const handleToggle = () => setOpen(previousOpen => !previousOpen);

  return (
    <>
      <ListItem disablePadding>
        <ListItemButton onClick={handleToggle} aria-expanded={open}>
          <ListItemText primary={menuText} />
          {open ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
      </ListItem>
      <Collapse in={open} timeout="auto" unmountOnExit>
        {items.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ pl: 2 }}>
            <ListItemButton
              component={NavLink}
              to={item.path}
              onClick={onNavigate}
              selected={currentPath === item.path}
              sx={{
                borderRadius: 2,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.dark' },
                },
              }}
            >
              <ListItemIcon>
                <item.icon />
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </Collapse>
    </>
  );
}

export default MobileNavMenu;