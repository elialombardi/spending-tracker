// components/WorkoutHeader.jsx
import { Box, Button, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export function WorkoutHeader({ workoutName, onFinish }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '80px 1fr 80px',
        alignItems: 'center',
        width: '100%',
        flexShrink: 0,
      }}
    >
      <Button
        startIcon={<ArrowBackIcon />}
        sx={{
          color: '#fff',
          textTransform: 'none',
          fontSize: '1rem',
          fontWeight: 700,
          justifySelf: 'start',
          p: 0,
          minWidth: 'auto',
        }}
        onClick={onFinish}
      >
        Exit
      </Button>

      <Typography
        variant="h6"
        fontWeight="800"
        noWrap
        sx={{
          textAlign: 'center',
          fontSize: '1.15rem',
          letterSpacing: 0.5,
        }}
      >
        {workoutName || 'Workout'}
      </Typography>

      <Box />
    </Box>
  );
}