import  { useState } from 'react';
import Paper from '@mui/material/Paper';
import SessionBuilder from '../components/Workouts/SessionBuilder';
import WorkoutPlayer from '../components/Workouts/WorkoutPlayer';

export default function WorkoutPage() {
  const [activeWorkout, setActiveWorkout] = useState(null);

  return (
    <Paper sx={{ p: { xs: 2, md: 3 }, minHeight: '90vh' }}>
      {!activeWorkout ? (
        <SessionBuilder onStartWorkout={(workout) => setActiveWorkout(workout)} />
      ) : (
        <WorkoutPlayer workout={activeWorkout} onFinish={() => setActiveWorkout(null)} />
      )}
    </Paper>
  );
}