// components/SessionLibrary.jsx
import React, { useState } from 'react';
import { Box, Button, Card, CardContent, List, Paper, Typography, IconButton } from '@mui/material';
import Add from '@mui/icons-material/Add';
import Delete from '@mui/icons-material/Delete';
import Pencil from '@mui/icons-material/Edit';
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
    <Paper sx={{ p: 3 }} elevation={2}>
      <Typography variant="h6" gutterBottom fontWeight="bold">
        Session Library
      </Typography>
      <List size="small">
        {sessions.map((sess) => (
          <Card key={sess.id} variant="outlined" sx={{ mb: 1 }}>
            <CardContent sx={{ p: '12px !important' }}>
              <Box display="flex">
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {sess.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {sess.cycles} Cycle(s) • {sess.rounds} Round(s) • {sess.timers?.length || 0} Timers
                  </Typography>
                </Box>
                <Box display="flex" gap={1}>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => handleEdit(sess.id)}
                  >
                    <Pencil fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    disabled={deletingId === sess.id}
                    onClick={() => handleDelete(sess.id)}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
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