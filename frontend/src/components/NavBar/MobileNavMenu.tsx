import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Collapse from '@mui/material/Collapse';
import { useId, useState } from 'react';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { NavLink } from 'react-router-dom';
import { NavItem } from '../../types/navigation';

interface MobileNavMenuProps {
  menuText: string;
  items: NavItem[];
  currentPath: string;
  onNavigate: () => void;
  defaultOpen?: boolean;
}

function MobileNavMenu({ menuText, items, currentPath, onNavigate, defaultOpen = false }: MobileNavMenuProps) {
  const [open, setOpen] = useState(defaultOpen || items.some(item => item.path === currentPath));
  const menuId = useId();

  const handleToggle = () => setOpen(previousOpen => !previousOpen);

  return (
    <>
      <ListItem disablePadding>
        <ListItemButton onClick={handleToggle} aria-expanded={open} aria-controls={menuId} sx={{ borderRadius: 2, minHeight: 48 }}>
          <ListItemText primary={menuText} />
          {open ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
      </ListItem>
      <Collapse id={menuId} in={open} timeout="auto" unmountOnExit>
        {items.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ mt: 0.5 }}>
            <ListItemButton
              component={NavLink}
              end
              to={item.path}
              onClick={onNavigate}
              selected={currentPath === item.path}
              sx={{
                borderRadius: 2,
                minHeight: 48,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.dark' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
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