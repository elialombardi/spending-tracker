import React from 'react';
import { Typography } from '@mui/material';

export const DiaryHeader: React.FC = () => {
  return (
    <Typography
      variant="h4"
      gutterBottom
      sx={{
        fontFamily: '"Courier New", "American Typewriter", monospace',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        fontSize: { xs: '1.5rem', md: '2rem' },
        borderBottom: (theme) => `2px solid ${theme.palette.divider}`,
        pb: 2,
        mb: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: 'text.primary',
        '&::after': {
          content: '"✦"',
          fontSize: '1.2rem',
          opacity: 0.5,
          color: 'text.secondary',
        }
      }}
    >
      My Diary
    </Typography>
  );
};