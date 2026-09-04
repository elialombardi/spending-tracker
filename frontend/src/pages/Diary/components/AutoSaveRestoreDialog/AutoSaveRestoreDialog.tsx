import React from 'react';
import { Box, Paper, Button, Typography } from '@mui/material';

interface AutoSaveRestoreDialogProps {
  open: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}

export const AutoSaveRestoreDialog: React.FC<AutoSaveRestoreDialogProps> = ({
  open,
  onRestore,
  onDiscard,
}) => {
  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <Paper
        sx={{
          p: 4,
          maxWidth: 500,
          mx: 2,
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Typography variant="h5" component="h3" gutterBottom>
          Restore Unsaved Content?
        </Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          You have unsaved content from a previous session. Would you like to restore it?
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={onRestore}
          >
            Restore
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={onDiscard}
          >
            Discard
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};