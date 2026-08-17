// components/WorkoutHeader.jsx
import React from 'react';
import {
  Stack,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

export default function WorkoutHeader({
  selectedWorkoutId,
  workouts = [],
  onSelectWorkout,
  onOpenCreateModal,
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      mb={3}
    >
      <Typography variant="h5" fontWeight="bold">
        Workout Builder
      </Typography>

      <Stack direction="row" spacing={2} >
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="workout-select-label">Load Saved Workout</InputLabel>
          <Select
            labelId="workout-select-label"
            value={selectedWorkoutId}
            label="Load Saved Workout"
            onChange={(e) => onSelectWorkout(e.target.value)}
          >
            <MenuItem value="">
              <em>+ New Blank Workout</em>
            </MenuItem>
            {workouts.map((w) => (
              <MenuItem key={w.id} value={w.id}>
                {w.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onOpenCreateModal}
        >
          New Session
        </Button>
      </Stack>
    </Stack>
  );
}