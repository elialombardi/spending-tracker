// components/WorkoutDisplay.jsx
import { Box, Typography, Stack, Paper, IconButton } from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { formatTime } from '../../../helpers/times';

export function WorkoutDisplay({ 
  currentStep, 
  timeLeft, 
  isActive, 
  onTogglePlay, 
  onSkip 
}) {
  const formattedTime = formatTime(timeLeft);
  // Check if we need to show hours for font size adjustment
  const hasHours = timeLeft >= 3600;
  
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        width: '100%',
        minHeight: 0,
        py: 1,
      }}
    >
      {/* Session Tag */}
      <Paper
        elevation={0}
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.25)',
          px: 2.5,
          py: 0.5,
          borderRadius: 8,
          color: '#fff',
        }}
      >
        <Typography variant="body1" fontWeight="700" sx={{ fontSize: '1rem' }}>
          {currentStep.sessionName}
        </Typography>
      </Paper>

      {/* Cycle & Round Info */}
      <Stack direction="row" spacing={3}>
        <Typography variant="body1" fontWeight="600" sx={{ fontSize: '1.1rem' }}>
          Cycle: <b>{currentStep.cycle} / {currentStep.totalCycles}</b>
        </Typography>
        <Typography variant="body1" fontWeight="600" sx={{ fontSize: '1.1rem' }}>
          Round: <b>{currentStep.round} / {currentStep.totalRounds}</b>
        </Typography>
      </Stack>

      {/* Action Name */}
      <Typography
        fontWeight="900"
        sx={{
          textTransform: 'uppercase',
          letterSpacing: 2,
          fontSize: { xs: '1.8rem', sm: '2.5rem' },
          lineHeight: 1.1,
        }}
      >
        {currentStep.timerName}
      </Typography>

      {/* Countdown Display - formatted time */}
      <Typography
        sx={{
          fontSize: hasHours ? 'clamp(3rem, 16vw, 6rem)' : 'clamp(5rem, 24vw, 8.5rem)',
          fontWeight: 900,
          fontFamily: 'monospace',
          lineHeight: 1,
          letterSpacing: hasHours ? 2 : 0,
        }}
      >
        {formattedTime}
      </Typography>

      {/* Controls Container */}
      <Stack
        direction="row"
        spacing={3}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconButton
          onClick={onTogglePlay}
          aria-label={isActive ? 'Pause' : 'Play'}
          sx={{
            width: 68,
            height: 68,
            bgcolor: '#ffffff',
            color: '#000000',
            boxShadow: '0px 6px 18px rgba(0,0,0,0.25)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
          }}
        >
          {isActive ? <PauseIcon sx={{ fontSize: 38 }} /> : <PlayArrowIcon sx={{ fontSize: 38 }} />}
        </IconButton>

        <IconButton
          onClick={onSkip}
          aria-label="Skip Step"
          sx={{
            width: 50,
            height: 50,
            color: '#fff',
            border: '2px solid rgba(255,255,255,0.6)',
            bgcolor: 'rgba(255,255,255,0.15)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
          }}
        >
          <SkipNextIcon sx={{ fontSize: 28 }} />
        </IconButton>
      </Stack>
    </Box>
  );
}