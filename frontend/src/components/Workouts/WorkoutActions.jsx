// components/WorkoutActions.jsx
import React from 'react';
import { Stack, Button, IconButton, Tooltip } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';

export default function WorkoutActions({
  selectedWorkoutId,
  workoutSequence = [],
  savingWorkout,
  onSaveWorkout,
  onDeleteWorkout,
  onStartWorkout,
}) {
  const isSequenceEmpty = workoutSequence.length === 0;

  return (
    <Stack direction="row" spacing={1} mb={2}>
      {selectedWorkoutId && (
        <Tooltip title="Delete Saved Workout">
          <IconButton
            color="error"
            onClick={onDeleteWorkout}
            disabled={savingWorkout}
          >
            <DeleteOutlineIcon />
          </IconButton>
        </Tooltip>
      )}

      <Button
        variant="outlined"
        color="primary"
        startIcon={<SaveIcon />}
        onClick={onSaveWorkout}
        disabled={savingWorkout || isSequenceEmpty}
      >
        {selectedWorkoutId ? 'Update Workout' : 'Save Workout'}
      </Button>

      <Button
        variant="contained"
        color="success"
        startIcon={<PlayArrowIcon />}
        onClick={onStartWorkout}
        disabled={savingWorkout || isSequenceEmpty}
      >
        Start Workout
      </Button>
    </Stack>
  );
}