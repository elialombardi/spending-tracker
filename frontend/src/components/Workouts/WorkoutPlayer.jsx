// components/WorkoutPlayer.jsx
import { useReducer } from 'react';
import { Box } from '@mui/material';
import { initialState, workoutReducer } from './player/workoutReducer';
import { useWorkoutSteps } from './player/hooks/useWorkoutSteps';
import { useWorkoutTimer } from './player/hooks/useWorkoutTimer';
import { WorkoutHeader } from './player/WorkoutHeader';
import { WorkoutComplete } from './player/WorkoutComplete';
import { WorkoutDisplay } from './player/WorkoutDisplay';
import { WorkoutProgress } from './player/WorkoutProgress';
import { WorkoutActionTypes } from './player/types';

export default function WorkoutPlayer({ workout, onFinish }) {
  const stepsSequence = useWorkoutSteps(workout);
  
  const [state, dispatch] = useReducer(workoutReducer, {
    ...initialState,
    currentStepIdx: 0,
    timeLeft: stepsSequence[0]?.duration || 0,
  });

  const { currentStepIdx, timeLeft, isActive } = state;
  const currentStep = stepsSequence[currentStepIdx] || {};

  useWorkoutTimer(state, dispatch, stepsSequence);

  const isCompleted = currentStepIdx === stepsSequence.length - 1 && timeLeft === 0;
  const totalProgress = stepsSequence.length > 0 
    ? ((currentStepIdx + 1) / stepsSequence.length) * 100 
    : 0;

  const togglePlay = () => dispatch({ type: WorkoutActionTypes.TOGGLE_PLAY });

  const handleSkip = () => {
    if (currentStepIdx < stepsSequence.length - 1) {
      const nextIdx = currentStepIdx + 1;
      dispatch({
        type: WorkoutActionTypes.STEP_CHANGED,
        payload: {
          stepIdx: nextIdx,
          duration: stepsSequence[nextIdx].duration,
        },
      });
    }
  };

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
      <WorkoutHeader workoutName={workout?.name} onFinish={onFinish} />

      {isCompleted ? (
        <WorkoutComplete onFinish={onFinish} />
      ) : (
        <WorkoutDisplay
          currentStep={currentStep}
          timeLeft={timeLeft}
          isActive={isActive}
          onTogglePlay={togglePlay}
          onSkip={handleSkip}
        />
      )}

      <WorkoutProgress
        currentStepIdx={currentStepIdx}
        totalSteps={stepsSequence.length}
        progress={totalProgress}
      />
    </Box>
  );
}