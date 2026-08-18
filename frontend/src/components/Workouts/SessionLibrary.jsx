// components/SessionLibrary.jsx
import { useState, useMemo } from 'react';
import { Box, Button, Card, CardContent, List, Paper, Typography, Stack } from '@mui/material';
import Add from '@mui/icons-material/Add';
import Delete from '@mui/icons-material/Delete';
import Pencil from '@mui/icons-material/Edit';
import RepeatIcon from '@mui/icons-material/Repeat';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import TimerIcon from '@mui/icons-material/Timer';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { workoutsApi } from '../../api';

// Utility function to format duration
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);
  
  return parts.join(' ');
}

// Calculate total duration of a session
function calculateSessionDuration(session) {
  if (!session || !session.timers || session.timers.length === 0) {
    return 0;
  }
  
  // Calculate duration per round (sum of all timers)
  const durationPerRound = session.timers.reduce((sum, timer) => sum + (timer.duration || 0), 0);
  
  // Add prepare duration if present
  const prepareDuration = session.roundPrepareDuration || 0;
  
  // Total rounds including prepare
  const totalRounds = session.rounds;
  
  // Calculate total: (prepare + timers per round) * rounds * cycles
  // Plus cycle rests between cycles
  const totalWorkDuration = (prepareDuration + durationPerRound) * totalRounds * session.cycles;
  
  // Add cycle rests (between cycles, not after the last one)
  const cycleRestDuration = session.CycleRestDuration || 0;
  const totalRestDuration = cycleRestDuration * Math.max(0, session.cycles - 1);
  
  return totalWorkDuration + totalRestDuration;
}

export default function SessionLibrary({ sessions, onAddToWorkout, onDeleteSession, onEditSession }) {
  const [deletingId, setDeletingId] = useState(null);

  // Memoize calculated durations for performance
  const sessionsWithDuration = useMemo(() => {
    return sessions.map(session => ({
      ...session,
      totalDuration: calculateSessionDuration(session)
    }));
  }, [sessions]);

  const handleDelete = async (id) => {
    try {
      setDeletingId(id);
      await workoutsApi.deleteSession(id);
      if (onDeleteSession) onDeleteSession(id);
    } catch (err) {
      console.error('Failed to delete session:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (id) => {
    if (onEditSession) onEditSession(id);
  };

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 }, width: '100%' }} elevation={2}>
      <Typography variant="h6" gutterBottom fontWeight="bold">
        Session Library
      </Typography>
      <List size="small" disablePadding>
        {sessionsWithDuration.map((sess) => (
          <Card key={sess.id} variant="outlined" sx={{ mb: 1, width: '100%' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: 1.5,
                  width: '100%'
                }}
              >
                {/* Session Details */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="subtitle1" fontWeight="bold" noWrap>
                      {sess.name}
                    </Typography>
                    {/* Total Duration Badge */}
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        bgcolor: 'primary.main',
                        color: 'white',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 2,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      <AccessTimeIcon sx={{ fontSize: '0.9rem' }} />
                      {formatDuration(sess.totalDuration)}
                    </Box>
                  </Box>
                  
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                    {/* Cycles */}
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        bgcolor: 'action.hover',
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        color: 'text.secondary'
                      }}
                    >
                      <RepeatIcon sx={{ fontSize: '1rem' }} />
                      <Typography variant="caption" fontWeight="600">{sess.cycles}</Typography>
                    </Box>

                    {/* Rounds */}
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        bgcolor: 'action.hover',
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        color: 'text.secondary'
                      }}
                    >
                      <FitnessCenterIcon sx={{ fontSize: '1rem' }} />
                      <Typography variant="caption" fontWeight="600">{sess.rounds}</Typography>
                    </Box>

                    {/* Timers */}
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        bgcolor: 'action.hover',
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        color: 'text.secondary'
                      }}
                    >
                      <TimerIcon sx={{ fontSize: '1rem' }} />
                      <Typography variant="caption" fontWeight="600">{sess.timers?.length || 0}</Typography>
                    </Box>

                    {/* Per Round Duration */}
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        bgcolor: 'action.hover',
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        color: 'text.secondary'
                      }}
                    >
                      <AccessTimeIcon sx={{ fontSize: '0.9rem' }} />
                      <Typography variant="caption" fontWeight="600">
                        {formatDuration(
                          (sess.timers?.reduce((sum, t) => sum + (t.duration || 0), 0) || 0) + 
                          (sess.roundPrepareDuration || 0)
                        )}/round
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

                {/* Actions Row */}
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1,
                    alignItems: 'center',
                    alignSelf: { xs: 'flex-end', sm: 'center' },
                    flexWrap: 'wrap',
                  }}
                >
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Pencil />}
                    onClick={() => handleEdit(sess.id)}
                  >
                    Edit
                  </Button>

                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Delete />}
                    color="error"
                    disabled={deletingId === sess.id}
                    onClick={() => handleDelete(sess.id)}
                  >
                    Delete
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Add />}
                    onClick={() => onAddToWorkout(sess)}
                  >
                    Add
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </List>
    </Paper>
  );
}