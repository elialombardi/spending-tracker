// components/SessionLibrary.jsx
import React, { useState } from 'react';
import { Box, Button, Card, CardContent, List, Paper, Typography, IconButton, Stack } from '@mui/material';
import Add from '@mui/icons-material/Add';
import Delete from '@mui/icons-material/Delete';
import Pencil from '@mui/icons-material/Edit';
import RepeatIcon from '@mui/icons-material/Repeat';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import TimerIcon from '@mui/icons-material/Timer';
import { workoutsApi } from '../../api';

export default function SessionLibrary({ sessions, onAddToWorkout, onDeleteSession, onEditSession }) {
  const [deletingId, setDeletingId] = useState(null);

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
        {sessions.map((sess) => (
          <Card key={sess.id} variant="outlined" sx={{ mb: 1, width: '100%' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  justify: 'space-between',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: 1.5,
                  width: '100%'
                }}
              >
                {/* Session Details */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" fontWeight="bold" noWrap>
                    {sess.name}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
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
                  </Stack>
                </Box>

                {/* Actions Row */}
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1,
                    alignItems: 'center',
                    alignSelf: { xs: 'flex-end', sm: 'center' }
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