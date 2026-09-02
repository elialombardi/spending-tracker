import React from 'react';
import { Snackbar, Alert } from '@mui/material';

const UserSnackbar = ({ open, message, severity, onClose }) => {
  return (
    <Snackbar
      open={open}
      autoHideDuration={6000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        sx={{ width: '100%' }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

export default React.memo(UserSnackbar);