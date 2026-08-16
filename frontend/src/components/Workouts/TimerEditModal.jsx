// components/TimerEditModal.jsx
import React, { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Box,
  Typography,
} from '@mui/material';

const COLOR_OPTIONS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function TimerEditModal({ open, timer, onClose, onSave }) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [color, setColor] = useState('#3b82f6');

  useEffect(() => {
    if (timer) {
      setName(timer.name);
      setDuration(timer.duration);
      setColor(timer.color || '#3b82f6');
    }
  }, [timer]);

  const handleSave = () => {
    if (!name.trim() || !duration || Number(duration) <= 0) return;
    onSave({
      ...timer,
      name: name.trim(),
      duration: parseInt(duration, 10),
      color,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle fontWeight="bold">Edit Timer</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Timer Title"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="Duration (seconds)"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            fullWidth
            size="small"
          />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Color Badge
            </Typography>
            <Stack direction="row" spacing={1}>
              {COLOR_OPTIONS.map((c) => (
                <Box
                  key={c}
                  onClick={() => setColor(c)}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: c,
                    cursor: 'pointer',
                    border: color === c ? '3px solid #000' : 'none',
                  }}
                />
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={!name.trim() || !duration}>
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}