import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import Tooltip from '@mui/material/Tooltip';
import { NavLink } from 'react-router-dom';
import MobileNavMenu from './MobileNavMenu';
import { NavSection } from '../../types/navigation';

export const SIDEBAR_WIDTH = 264;

interface SidebarNavProps {
  isDesktop: boolean;
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onCollapse: () => void;
  sections: NavSection[];
  currentPath: string;
}

function SidebarNav({ isDesktop, open, onClose, collapsed, onCollapse, sections, currentPath }: SidebarNavProps) {
  const mainItems = sections.find(section => section.title === 'Main')?.items ?? [];
  const dropdownSections = sections.filter(section => section.title !== 'Main');

  if (isDesktop && collapsed) return null;

  return (
    <Drawer
      variant={isDesktop ? 'permanent' : 'temporary'}
      anchor="left"
      open={isDesktop || open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: SIDEBAR_WIDTH,
          maxWidth: 'calc(100vw - 32px)',
          boxSizing: 'border-box',
          bgcolor: 'background.paper',
        },
      }}
    >
      <Box id="app-navigation" component="nav" aria-label="Main navigation" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 48, mb: 2 }}>
          <Box
            component="img"
            src="/logo.png"
            alt="App logo"
            sx={{ height: 36, width: 36, borderRadius: '50%' }}
          />
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', flex: 1 }}>
            The Picci's
          </Typography>
          {isDesktop ? (
            <Tooltip title="Collapse navigation">
              <IconButton aria-label="Collapse navigation" onClick={onCollapse} sx={{ minWidth: 44, minHeight: 44 }}>
                <ChevronLeftIcon />
              </IconButton>
            </Tooltip>
          ) : (
            <IconButton aria-label="Close navigation" onClick={onClose} sx={{ minWidth: 44, minHeight: 44 }}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />

        <List disablePadding>
          {mainItems.map((item) => (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={NavLink}
                end
                to={item.path}
                onClick={onClose}
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

        </List>
        {mainItems.length > 0 && <Divider sx={{ my: 2 }} />}
        <List disablePadding>
          {dropdownSections.map((section) => (
            <MobileNavMenu
              key={`${section.title}:${currentPath}`}
              menuText={section.title}
              items={section.items}
              currentPath={currentPath}
              onNavigate={onClose}
              defaultOpen={mainItems.length === 0}
            />
          ))}
        </List>
      </Box>
    </Drawer>
  );
}

export default SidebarNav;