// components/WorkoutPlayer.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Button, Typography, Stack, LinearProgress, Paper, Container } from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { soundEffects } from '../../helpers/audio';

export default function WorkoutPlayer({ workout, onFinish }) {
  // Unroll workout API model into a flat executable sequence of timer steps
  const stepsSequence = useMemo(() => {
    const list = [];
    if (!workout || !workout.sessions) return list;



    workout.sessions.forEach((session) => {
      if (session.roundPrepareDuration > 0) {
        list.push({
          sessionName: 'Prepare',
          cycle: 1,
          totalCycles: 1,
          round: 1,
          totalRounds: 1,
          timerName: 'Prepare',
          duration: session.roundPrepareDuration,
          color: '#facc15',
        });
      }
      for (let c = 1; c <= session.cycles; c++) {
        for (let r = 1; r <= session.rounds; r++) {
          (session.timers || []).forEach((t) => {
            list.push({
              sessionName: session.name,
              cycle: c,
              totalCycles: session.cycles,
              round: r,
              totalRounds: session.rounds,
              timerName: t.name,
              duration: t.duration,
              color: t.color || '#3b82f6',
            });
          });
        }
        if (c < session.cycles && session.CycleRestDuration > 0) {
          list.push({
            sessionName: session.name,
            cycle: c,
            totalCycles: session.cycles,
            round: session.rounds,
            timerName: 'Cycle Rest',
            duration: session.CycleRestDuration,
            color: '#10b981',
          });
        }
      }
    });
    return list;
  }, [workout]);

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const currentStep = stepsSequence[currentStepIdx] || {};

  const [timeLeft, setTimeLeft] = useState(currentStep.duration || 0);
  const [isActive, setIsActive] = useState(true);

  // Ref guard to prevent double-advancing during Strict Mode or race conditions
  const isTransitioningRef = useRef(false);

  // Sync duration when currentStepIdx or step duration changes
  useEffect(() => {
    if (currentStep.duration !== undefined) {
      setTimeLeft(currentStep.duration);
      isTransitioningRef.current = false; // Reset lock for the new step
    }
  }, [currentStepIdx, currentStep.duration]);

  // Main countdown timer engine
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(interval);
          handleStepExpiration();
          return 0;
        }

        const nextTime = prevTime - 1;

        // Sound effects
        if (nextTime <= 3 && nextTime > 0) {
          soundEffects.playBeep(880, 0.15, 'sine');
        } else if (nextTime === 0) {
          soundEffects.playBeep(1200, 0.4, 'triangle');
        }

        return nextTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, currentStepIdx]);

  const handleStepExpiration = () => {
    // Guard against duplicate triggers
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    soundEffects.playBeep(1200, 0.4, 'triangle');

    setCurrentStepIdx((prevIdx) => {
      if (prevIdx < stepsSequence.length - 1) {
        return prevIdx + 1;
      } else {
        setIsActive(false);
        return prevIdx;
      }
    });
  };

  const togglePlay = () => setIsActive(!isActive);

  const handleSkip = () => {
    if (currentStepIdx < stepsSequence.length - 1) {
      setCurrentStepIdx((prev) => prev + 1);
    }
  };

  const isCompleted = currentStepIdx === stepsSequence.length - 1 && timeLeft === 0;
  const totalProgress = stepsSequence.length > 0 ? ((currentStepIdx + 1) / stepsSequence.length) * 100 : 0;

  return (
    <Box
      sx={{
        minHeight: '85vh',
        bgcolor: isCompleted ? '#064e3b' : currentStep.color || '#1e293b',
        color: '#ffffff',
        borderRadius: 4,
        p: { xs: 2, md: 4 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'background-color 0.5s ease',
      }}
    >
      {/* Top Header Controls */}
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Button startIcon={<ArrowBackIcon />} sx={{ color: '#fff' }} onClick={onFinish}>
          Exit
        </Button>
        <Typography variant="h6" fontWeight="bold">
          {workout?.name || 'Workout Session'}
        </Typography>
        <Box width={60} />
      </Box>

      {/* Main Counter Display */}
      {isCompleted ? (
        <Container maxWidth="sm" sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h2" fontWeight="bold" gutterBottom>
            Workout Complete! 🎉
          </Typography>
          <Typography variant="h6" sx={{ mb: 4, opacity: 0.8 }}>
            Great job pushing through your session.
          </Typography>
          <Button variant="contained" size="large" onClick={onFinish} sx={{ color: '#000', bgcolor: '#fff' }}>
            Back to Setup
          </Button>
        </Container>
      ) : (
        <Stack spacing={3} alignItems="center" sx={{ my: 'auto', textAlign: 'center' }}>
          <Paper
            elevation={0}
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.15)',
              px: 3,
              py: 1,
              borderRadius: 8,
              color: '#fff',
            }}
          >
            <Typography variant="h5" fontWeight="medium">
              Session: {currentStep.sessionName}
            </Typography>
          </Paper>

          <Stack direction="row" spacing={3}>
            <Typography variant="h6" sx={{ opacity: 0.9 }}>
              Cycle: <b>{currentStep.cycle} / {currentStep.totalCycles}</b>
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9 }}>
              Round: <b>{currentStep.round} / {currentStep.totalRounds}</b>
            </Typography>
          </Stack>

          <Typography variant="h3" fontWeight="bold" sx={{ textTransform: 'uppercase', tracking: 2 }}>
            {currentStep.timerName}
          </Typography>

          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '6rem', md: '10rem' },
              fontWeight: 900,
              fontFamily: 'monospace',
              lineHeight: 1,
              my: 2,
            }}
          >
            {timeLeft}s
          </Typography>

          {/* Controls */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="contained"
              size="large"
              onClick={togglePlay}
              sx={{
                borderRadius: '50%',
                minWidth: 72,
                height: 72,
                bgcolor: '#ffffff',
                color: '#000000',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.8)' },
              }}
            >
              {isActive ? <PauseIcon fontSize="large" /> : <PlayArrowIcon fontSize="large" />}
            </Button>
            <Button
              variant="outlined"
              onClick={handleSkip}
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}
            >
              <SkipNextIcon fontSize="medium" />
            </Button>
          </Stack>
        </Stack>
      )}

      {/* Progress Footer */}
      <Box sx={{ width: '100%', mt: 4 }}>
        <Box display="flex" justifyContent="space-between" mb={1}>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            Overall Progress
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            Step {currentStepIdx + 1} of {stepsSequence.length}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={totalProgress}
          sx={{
            height: 10,
            borderRadius: 5,
            bgcolor: 'rgba(255,255,255,0.2)',
            '& .MuiLinearProgress-bar': { bgcolor: '#ffffff' },
          }}
        />
      </Box>
    </Box>
  );
}