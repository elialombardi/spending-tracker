export const WorkoutPlayerState = {
  currentStepIdx: 0,
  timeLeft: 0,
  isActive: true,
};

export const WorkoutActionTypes = {
  STEP_CHANGED: 'STEP_CHANGED',
  TICK: 'TICK',
  TOGGLE_PLAY: 'TOGGLE_PLAY',
  NEXT_STEP: 'NEXT_STEP',
  COMPLETE: 'COMPLETE',
};