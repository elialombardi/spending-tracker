import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { NavLink } from 'react-router-dom';
import NavMenu from './NavMenu';
import { NavSection } from './types';

interface DesktopNavProps {
  sections: NavSection[];
  currentPath: string;
}

function DesktopNav({ sections, currentPath }: DesktopNavProps) {
  // Flatten all items and get the first section's items for top-level display
  const mainItems = sections[0]?.items || [];
  const dropdownSections = sections.slice(1);

  return (
    <Box
      sx={{
        display: { xs: 'none', md: 'flex' },
        alignItems: 'center',
        gap: 0.5,
      }}
    >
      {mainItems.map((item) => (
        <Button
          key={item.path}
          component={NavLink}
          to={item.path}
          variant={currentPath === item.path ? 'contained' : 'text'}
          startIcon={<item.icon />}
          size="small"
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.85rem',
            px: 2,
            py: 0.6,
            borderRadius: 2,
            color: currentPath === item.path ? 'primary.contrastText' : 'text.primary',
            bgcolor: currentPath === item.path ? 'primary.main' : 'transparent',
            '&:hover': {
              bgcolor: currentPath === item.path ? 'primary.dark' : 'action.hover',
            },
          }}
        >
          {item.label}
        </Button>
      ))}

      {dropdownSections.map((section) => (
        <NavMenu
          key={section.title}
          menuText={section.title}
          items={section.items}
        />
      ))}
    </Box>
  );
}

export default DesktopNav;