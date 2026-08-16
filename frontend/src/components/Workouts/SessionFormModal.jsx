// components/SessionFormModal.jsx
import React, { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { workoutsApi } from '../../api';
import TimerInputRow from './TimerInputRow';
import TimerList from './TimerList';

const DEFAULT_TIMERS = [
  { id: '1', name: 'Setup', duration: 15, color: '#f59e0b' },
  { id: '2', name: 'Workout', duration: 30, color: '#ef4444' },
  { id: '3', name: 'Relax', duration: 15, color: '#10b981' },
];

export default function SessionFormModal({ open, onClose, onSaveSession, initialData = null }) {
  const [sessionName, setSessionName] = useState('');
  const [rounds, setRounds] = useState(3);
  const [cycles, setCycles] = useState(1);
  const [cycleRelax, setCycleRelax] = useState(60);
  const [customTimers, setCustomTimers] = useState([...DEFAULT_TIMERS]);
  const [saving, setSaving] = useState(false);

  // Synchronize form values whenever modal opens or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        setSessionName(initialData.name || '');
        setRounds(initialData.rounds ?? 3);
        setCycles(initialData.cycles ?? 1);
        setCycleRelax(initialData.cycleRelaxDuration ?? 60);
        setCustomTimers(initialData.timers?.length ? initialData.timers : [...DEFAULT_TIMERS]);
      } else {
        // Reset to default for creation mode
        setSessionName('');
        setRounds(3);
        setCycles(1);
        setCycleRelax(60);
        setCustomTimers([...DEFAULT_TIMERS]);
      }
    }
  }, [open, initialData]);

  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  const handleAddTimer = (name, duration) => {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    setCustomTimers((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name,
        duration: parseInt(duration, 10),
        color: randomColor,
      },
    ]);
  };

  const handleSave = async () => {
    if (!sessionName.trim() || customTimers.length === 0) return;

    try {
      setSaving(true);

      const payload = {
        name: sessionName.trim(),
        rounds: Number(rounds),
        cycles: Number(cycles),
        cycleRelaxDuration: Number(cycleRelax),
        timers: customTimers.map((t) => ({
          name: t.name,
          duration: t.duration,
          color: t.color,
        })),
      };

      let resultSession;
      if (initialData?.id) {
        // API Update call if editing
        resultSession = await workoutsApi.updateSession(initialData.id, payload);
      } else {
        // API Create call if creating new
        resultSession = await workoutsApi.createSession(payload);
      }

      onSaveSession(resultSession);
    } catch (err) {
      console.error('Failed to save session:', err);
    } finally {
      setSaving(false);
    }
  };

  const isEditing = Boolean(initialData?.id);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2, pr: 6, fontWeight: 'bold' }}>
        {isEditing ? 'Edit Session' : 'Create Custom Session'}
        <IconButton
          aria-label="close"
          onClick={handleClose}
          disabled={saving}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2} sx={{ mb: 3, mt: 1 }}>
          <TextField
            label="Session Title"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="e.g. Tabata, HIIT, Stretch"
            fullWidth
            size="small"
            autoFocus
          />

          <Grid container spacing={2}>
            <Grid item xs={4}>
              <TextField
                label="Rounds"
                type="number"
                value={rounds}
                onChange={(e) => setRounds(e.target.value)}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                label="Cycles"
                type="number"
                value={cycles}
                onChange={(e) => setCycles(e.target.value)}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                label="Cycle Relax (s)"
                type="number"
                value={cycleRelax}
                onChange={(e) => setCycleRelax(e.target.value)}
                size="small"
                fullWidth
              />
            </Grid>
          </Grid>
        </Stack>

        <Divider sx={{ my: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Interval Timers (Reorder & Edit)
          </Typography>
        </Divider>

        <TimerList
          timers={customTimers}
          onUpdateTimers={(updated) => setCustomTimers(updated)}
        />

        <TimerInputRow onAddTimer={handleAddTimer} />
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={saving} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!sessionName.trim() || customTimers.length === 0 || saving}
          onClick={handleSave}
          startIcon={saving ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {saving ? 'Saving...' : isEditing ? 'Update Session' : 'Save Session'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}