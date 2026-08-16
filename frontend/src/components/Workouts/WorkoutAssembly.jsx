import React from 'react';
import {
  Button,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import Delete from '@mui/icons-material/Delete';
import PlayArrow from '@mui/icons-material/PlayArrow';
import FitnessCenter from '@mui/icons-material/FitnessCenter';

export default function WorkoutAssembly({
  workoutName,
  onWorkoutNameChange,
  workoutSequence,
  onRemoveFromWorkout,
  onStartWorkout,
}) {
  return (
    <Paper sx={{ p: 3, bgcolor: 'action.hover' }} elevation={2}>
      <Typography variant="h6" gutterBottom fontWeight="bold" display="flex" gap={1}>
        <FitnessCenter /> Active Workout Assembly
      </Typography>

      <TextField
        label="Workout Title"
        value={workoutName}
        onChange={(e) => onWorkoutNameChange(e.target.value)}
        size="small"
        fullWidth
        sx={{ mb: 2, bgcolor: 'background.paper' }}
      />

      {workoutSequence.length === 0 ? (
        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
          Add sessions from the library above to build your workout.
        </Typography>
      ) : (
        <List size="small">
          {workoutSequence.map((sess, idx) => (
            <ListItem
              key={sess.instanceId}
              sx={{ bgcolor: 'background.paper', mb: 1, borderRadius: 1 }}
            >
              <ListItemText
                primary={`${idx + 1}. ${sess.name}`}
                secondary={`${sess.rounds} Rds | ${sess.timers.map((t) => t.name).join(', ')}`}
              />
              <ListItemSecondaryAction>
                <IconButton edge="end" onClick={() => onRemoveFromWorkout(sess.instanceId)}>
                  <Delete />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}

      <Button
        variant="contained"
        color="success"
        size="large"
        fullWidth
        disabled={workoutSequence.length === 0}
        startIcon={<PlayArrow />}
        onClick={onStartWorkout}
        sx={{ mt: 2 }}
      >
        Start Workout
      </Button>
    </Paper>
  );
}