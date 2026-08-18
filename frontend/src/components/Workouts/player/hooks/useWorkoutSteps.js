// hooks/useWorkoutSteps.js
import { useMemo } from 'react';

export function useWorkoutSteps(workout) {
  return useMemo(() => {
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
}