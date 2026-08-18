// components/TimerEditModal.jsx
import { useState, useEffect, useRef } from 'react';
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
import { secondsToTime, timeToSeconds, isValidTimeFormat } from '../../helpers/times';

const COLOR_OPTIONS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function TimerEditModal({ open, timer, onClose, onSave }) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [error, setError] = useState('');

  // Use refs to track previous values to avoid unnecessary updates
  const prevTimerRef = useRef(timer);
  const prevOpenRef = useRef(open);

  // Reset form when a new timer is selected or modal opens
  useEffect(() => {
    const timerChanged = timer?.id !== prevTimerRef.current?.id;
    const modalJustOpened = open && !prevOpenRef.current;
    
    if (timer && (timerChanged || modalJustOpened)) {
      setName(timer.name || '');
      setDuration(secondsToTime(timer.duration || 0));
      setColor(timer.color || '#3b82f6');
      setError('');
    }
    
    // Update refs for next comparison
    prevTimerRef.current = timer;
    prevOpenRef.current = open;
  }, [timer, open]);

  const handleSave = () => {
    // Validate the time format
    if (!isValidTimeFormat(duration)) {
      setError('Please use MM:SS format (e.g., 01:30)');
      return;
    }

    const durationInSeconds = timeToSeconds(duration);
    
    if (durationInSeconds <= 0) {
      setError('Duration must be greater than 0');
      return;
    }

    if (!name.trim()) {
      setError('Timer name is required');
      return;
    }

    onSave({
      ...timer,
      name: name.trim(),
      duration: durationInSeconds,
      color,
    });
    onClose();
  };

  const handleDurationChange = (e) => {
    const value = e.target.value;
    setDuration(value);
    
    // Clear error when user starts typing
    if (error) setError('');
    
    // Optional: Auto-format as user types (MM:SS)
    // This is a simple version - you can enhance it
    if (value.length === 2 && !value.includes(':')) {
      setDuration(value + ':');
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle fontWeight="bold">Edit Timer</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Timer Title"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
            error={!!error && !name.trim()}
          />
          <TextField
            label="Duration (MM:SS)"
            value={duration}
            onChange={handleDurationChange}
            placeholder="01:30"
            fullWidth
            size="small"
            error={!!error}
            helperText={error || 'Format: MM:SS (e.g., 01:30 for 90 seconds)'}
            inputProps={{ pattern: '[0-9]{2}:[0-9]{2}' }}
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
                    border: color === c ? '3px solid #000' : '2px solid transparent',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'scale(1.1)',
                    },
                  }}
                />
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={!name.trim() || !duration || !!error}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}