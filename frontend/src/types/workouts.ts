export interface Timer {
  id?: number;
  sessionId?: number;
  name: string;
  duration: number;
  color?: string;
}

export interface Session {
  id?: number;
  name: string;
  rounds?: number;
  cycles?: number;
  CycleRestDuration?: number;
  timers: Timer[];
}

export interface Workout {
  id?: number;
  name: string;
  sessions?: Session[];
  sessionIds?: number[];
}
