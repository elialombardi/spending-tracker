import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { NavLink } from 'react-router-dom';
import { NavSection } from './types';
import MobileNavMenu from './MobileNavMenu';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  sections: NavSection[];
  currentPath: string;
}

function MobileNav({ open, onClose, sections, currentPath }: MobileNavProps) {
  const mainItems = sections[0]?.items || [];
  const dropdownSections = sections.slice(1);

  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box sx={{ width: 280, p: 2 }} role="presentation" onClick={onClose} onKeyDown={onClose}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box
            component="img"
            src="/logo.png"
            alt="App logo"
            sx={{ height: 36, width: 36, borderRadius: '50%' }}
          />
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
            Picci's App
          </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />

        <List>
          {mainItems.map((item) => (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={NavLink}
                to={item.path}
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
                <item.icon sx={{ mr: 2 }} />
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}

          {dropdownSections.map((section) => (
            <MobileNavMenu
              key={section.title}
              menuText={section.title}
              items={section.items}
              currentPath={currentPath}
            />
          ))}
        </List>
      </Box>
    </Drawer>
  );
}

export default MobileNav;