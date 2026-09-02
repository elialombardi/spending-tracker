// workoutReducer.js
import { WorkoutActionTypes } from './types';

export const initialState = {
  currentStepIdx: 0,
  timeLeft: 0,
  isActive: true,
};

export function workoutReducer(state, action) {
  switch (action.type) {
    case WorkoutActionTypes.STEP_CHANGED:
      return {
        ...state,
        currentStepIdx: action.payload.stepIdx,
        timeLeft: action.payload.duration,
        isActive: true,
      };
    case WorkoutActionTypes.TICK:
      return {
        ...state,
        timeLeft: state.timeLeft - 1,
      };
    case WorkoutActionTypes.TOGGLE_PLAY:
      return {
        ...state,
        isActive: !state.isActive,
      };
    case WorkoutActionTypes.NEXT_STEP:
      return {
        ...state,
        currentStepIdx: action.payload.stepIdx,
        timeLeft: action.payload.duration,
        isActive: true,
      };
    case WorkoutActionTypes.COMPLETE:
      return {
        ...state,
        isActive: false,
      };
    default:
      return state;
  }
}