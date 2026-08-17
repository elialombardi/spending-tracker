// components/WorkoutPlayer.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Button, Typography, Stack, LinearProgress, Paper, Container, IconButton } from '@mui/material';
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

  const isTransitioningRef = useRef(false);

  useEffect(() => {
    if (currentStep.duration !== undefined) {
      setTimeLeft(currentStep.duration);
      isTransitioningRef.current = false;
    }
  }, [currentStepIdx, currentStep.duration]);

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
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: 9999,
        bgcolor: isCompleted ? '#064e3b' : currentStep.color || '#1e293b',
        color: '#ffffff',
        p: 2,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        overflow: 'hidden',
        transition: 'background-color 0.5s ease',
        userSelect: 'none',
      }}
    >
      {/* 1. Header Bar: Grid ensures horizontal symmetry */}
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
          {workout?.name || 'Workout'}
        </Typography>

        <Box />
      </Box>

      {/* 2. Main Workout Display */}
      {isCompleted ? (
        <Container
          maxWidth="xs"
          sx={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            flex: 1,
          }}
        >
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Workout Complete! 🎉
          </Typography>
          <Typography variant="body1" sx={{ mb: 3, opacity: 0.9 }}>
            Great job pushing through your session.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={onFinish}
            sx={{
              color: '#000',
              bgcolor: '#fff',
              fontWeight: 'bold',
              px: 4,
              py: 1,
              borderRadius: 4,
            }}
          >
            Back to Setup
          </Button>
        </Container>
      ) : (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-evenly',
            alignItems: 'center',
            width: '100%',
            minHeight: 0, // Critical to prevent flex item pushing
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

          {/* Countdown Digit */}
          <Typography
            sx={{
              fontSize: 'clamp(5rem, 24vw, 8.5rem)',
              fontWeight: 900,
              fontFamily: 'monospace',
              lineHeight: 1,
            }}
          >
            {timeLeft}s
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
              onClick={togglePlay}
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
              onClick={handleSkip}
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
      )}

      {/* 3. Footer Progress Bar */}
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
            Step {currentStepIdx + 1} of {stepsSequence.length}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={totalProgress}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: 'rgba(255,255,255,0.3)',
            '& .MuiLinearProgress-bar': { bgcolor: '#ffffff' },
          }}
        />
      </Box>
    </Box>
  );
}