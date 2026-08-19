import React from 'react';
import { Box, Typography, IconButton, Tooltip, Button } from '@mui/material';
import { Refresh as RefreshIcon, Add as AddIcon } from '@mui/icons-material';

const UserHeader = ({ 
  title, 
  onRefresh, 
  onAdd, 
  loading,
  showAddButton = true,
}) => {
  return (
    <Box sx={{ 
      mb: 3, 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      flexWrap: 'wrap', 
      gap: 2 
    }}>
      <Typography variant="h5" component="h2">
        {title}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Tooltip title="Refresh">
          <IconButton onClick={onRefresh} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        {showAddButton && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onAdd}
          >
            New User
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default React.memo(UserHeader);