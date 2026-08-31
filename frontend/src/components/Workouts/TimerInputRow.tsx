import React, { useState } from 'react';
import { Box, Button, TextField } from '@mui/material';
import Add from '@mui/icons-material/Add';

export default function TimerInputRow({ onAddTimer }) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');

  const handleAdd = () => {
    if (!name || !duration || Number(duration) <= 0) return;
    onAddTimer(name, duration);
    setName('');
    setDuration('');
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
      <TextField
        label="Timer Title"
        value={name}
        onChange={(e) => setName(e.target.value)}
        size="small"
        sx={{ flexGrow: 1 }}
      />
      <TextField
        label="Duration (s)"
        type="number"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        size="small"
        sx={{ width: 120 }}
      />
      <Button variant="outlined" startIcon={<Add />} onClick={handleAdd}>
        Add
      </Button>
    </Box>
  );
}