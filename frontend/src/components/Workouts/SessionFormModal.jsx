// components/SessionFormModal.jsx
import { useState, useEffect, useRef } from 'react';
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
import { timeToSeconds, secondsToTime } from '../../helpers/times';

const DEFAULT_TIMERS = [
  { id: '1', name: 'Workout', duration: 30, color: '#ef4444' },
  { id: '2', name: 'Rest', duration: 15, color: '#10b981' },
];

const getInitialFormValues = (initialData) => {
  if (initialData) {
    return {
      sessionName: initialData.name || '',
      rounds: initialData.rounds ?? 3,
      cycles: initialData.cycles ?? 1,
      cycleRest: secondsToTime(initialData.CycleRestDuration ?? 60),
      roundPrepare: secondsToTime(initialData.roundPrepareDuration ?? 15),
      customTimers: initialData.timers?.length ? initialData.timers : [...DEFAULT_TIMERS],
    };
  }
  return {
    sessionName: '',
    rounds: 3,
    cycles: 1,
    cycleRest: '01:00',
    roundPrepare: '00:15',
    customTimers: [...DEFAULT_TIMERS],
  };
};

export default function SessionFormModal({ open, onClose, onSaveSession, initialData = null }) {
  // Use a ref to track the previous open state and initialData
  const prevOpenRef = useRef(open);
  const prevInitialDataRef = useRef(initialData);
  
  // Initialize state with derived values
  const initialValues = getInitialFormValues(initialData);
  const [sessionName, setSessionName] = useState(initialValues.sessionName);
  const [rounds, setRounds] = useState(initialValues.rounds);
  const [cycles, setCycles] = useState(initialValues.cycles);
  const [cycleRest, setCycleRest] = useState(initialValues.cycleRest);
  const [roundPrepare, setRoundPrepare] = useState(initialValues.roundPrepare);
  const [customTimers, setCustomTimers] = useState(initialValues.customTimers);
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens or initialData changes
  useEffect(() => {
    const shouldReset = 
      (open && !prevOpenRef.current) || // Modal just opened
      (open && initialData?.id !== prevInitialDataRef.current?.id); // Different session being edited
    
    if (shouldReset) {
      const values = getInitialFormValues(initialData);
      setSessionName(values.sessionName);
      setRounds(values.rounds);
      setCycles(values.cycles);
      setCycleRest(values.cycleRest);
      setRoundPrepare(values.roundPrepare);
      setCustomTimers(values.customTimers);
    }
    
    // Update refs for next comparison
    prevOpenRef.current = open;
    prevInitialDataRef.current = initialData;
  }, [open, initialData]);

  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  const handleAddTimer = (name, duration) => {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const durationInSeconds = typeof duration === 'string' && duration.includes(':')
      ? timeToSeconds(duration)
      : parseInt(duration, 10);

    setCustomTimers((prev) => [
      ...prev,
      {
        id: Date.now().toString(), // This is in an event handler, not during render ✅
        name,
        duration: durationInSeconds,
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
        CycleRestDuration: timeToSeconds(cycleRest),
        roundPrepareDuration: timeToSeconds(roundPrepare),
        timers: customTimers.map((t) => ({
          name: t.name,
          duration: t.duration,
          color: t.color,
        })),
      };

      let resultSession;
      if (initialData?.id) {
        resultSession = await workoutsApi.updateSession(initialData.id, payload);
      } else {
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
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
    >
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
                inputProps={{ min: 1 }}
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
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                label="Cycle Rest (MM:SS)"
                value={cycleRest}
                onChange={(e) => setCycleRest(e.target.value)}
                size="small"
                fullWidth
                placeholder="01:00"
                inputProps={{ pattern: '[0-9]{2}:[0-9]{2}' }}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                label="Round Prepare (MM:SS)"
                value={roundPrepare}
                onChange={(e) => setRoundPrepare(e.target.value)}
                size="small"
                fullWidth
                placeholder="00:15"
                inputProps={{ pattern: '[0-9]{2}:[0-9]{2}' }}
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