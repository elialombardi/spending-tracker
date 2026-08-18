// components/WorkoutProgress.jsx
import { Box, Typography, LinearProgress } from '@mui/material';

export function WorkoutProgress({ currentStepIdx, totalSteps, progress }) {
  return (
    <Box sx={{ width: '100%', flexShrink: 0, pt: 1 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 0.5
        }}
      >
        <Typography variant="body2" fontWeight="700" sx={{ opacity: 0.95 }}>
          Step {currentStepIdx + 1} of {totalSteps}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: 'rgba(255,255,255,0.3)',
          '& .MuiLinearProgress-bar': { bgcolor: '#ffffff' },
        }}
      />
    </Box>
  );
}