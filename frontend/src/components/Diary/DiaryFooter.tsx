import React from 'react';
import { Typography } from '@mui/material';

export const DiaryFooter: React.FC = () => {
  return (
    <Typography
      sx={{
        mt: 3,
        pt: 2,
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        fontFamily: '"Courier New", monospace',
        fontSize: '0.7rem',
        color: 'text.disabled',
        textAlign: 'center',
        letterSpacing: '0.1em',
      }}
    >
      ✦ TYPEWRITER DIARY ✦
    </Typography>
  );
};