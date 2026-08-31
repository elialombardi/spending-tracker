// hooks/useWorkoutTimer.js
import { useEffect, useRef, useCallback } from 'react';
import { soundEffects } from '../../../../helpers/audio';
import { WorkoutActionTypes } from '../types';

export function useWorkoutTimer(state, dispatch, stepsSequence) {
  const { currentStepIdx, timeLeft, isActive } = state;
  const isTransitioningRef = useRef(false);

  const handleStepExpiration = useCallback(() => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    soundEffects.playBeep(1200, 0.4, 'triangle');

    const nextIdx = currentStepIdx + 1;
    if (nextIdx < stepsSequence.length) {
      dispatch({
        type: WorkoutActionTypes.NEXT_STEP,
        payload: {
          stepIdx: nextIdx,
          duration: stepsSequence[nextIdx].duration,
        },
      });
    } else {
      dispatch({ type: WorkoutActionTypes.COMPLETE });
    }
  }, [currentStepIdx, stepsSequence, dispatch]);

  // Timer tick effect
  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;

    const interval = setInterval(() => {
      dispatch({ type: WorkoutActionTypes.TICK });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, timeLeft, dispatch]);

  // Handle timeLeft reaching 0
  useEffect(() => {
    if (timeLeft === 0 && isActive && currentStepIdx < stepsSequence.length) {
      handleStepExpiration();
    }
  }, [timeLeft, isActive, currentStepIdx, stepsSequence.length, handleStepExpiration]);

  // Reset transition flag when step changes
  useEffect(() => {
    isTransitioningRef.current = false;
  }, [currentStepIdx]);

  // Sound effects for countdown
  useEffect(() => {
    if (timeLeft <= 3 && timeLeft > 0 && isActive) {
      soundEffects.playBeep(880, 0.15, 'sine');
    }
  }, [timeLeft, isActive]);

  return {
    handleStepExpiration,
    isTransitioningRef,
  };
}