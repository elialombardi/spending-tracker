import { fetchJSON } from '../client';
import { endpoints } from '../endpoints';
import type { Session, Workout } from '../../types/domain';

type QueryParams = {
  page?: number
  limit?: number
  search?: string
}

function buildQuery(params: QueryParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.search) searchParams.set('search', params.search);
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export const workoutsApi = {
  // Sessions
  listSessions: async (params?: QueryParams) => fetchJSON<Session[]>(`${endpoints.listSessions.path}${buildQuery(params)}`),
  getSession: async (id: number | string) => fetchJSON<Session>(endpoints.getSession.path.replace(':id', encodeURIComponent(String(id)))),
  createSession: async (session: Session) => fetchJSON<Session>(endpoints.createSession.path, { method: 'POST', body: JSON.stringify(session) }),
  updateSession: async (id: number | string, session: Partial<Session>) => fetchJSON<Session>(endpoints.updateSession.path.replace(':id', encodeURIComponent(String(id))), { method: 'PUT', body: JSON.stringify(session) }),
  deleteSession: async (id: number | string) => fetchJSON(endpoints.deleteSession.path.replace(':id', encodeURIComponent(String(id))), { method: 'DELETE' }),

  // Workouts
  listWorkouts: async (params?: QueryParams) => fetchJSON<Workout[]>(`${endpoints.listWorkouts.path}${buildQuery(params)}`),
  getWorkout: async (id: number | string) => fetchJSON<Workout>(endpoints.getWorkout.path.replace(':id', encodeURIComponent(String(id)))),
  createWorkout: async (workout: Workout) => fetchJSON<Workout>(endpoints.createWorkout.path, { method: 'POST', body: JSON.stringify(workout) }),
  updateWorkout: async (id: number | string, workout: Partial<Workout>) => fetchJSON<Workout>(endpoints.updateWorkout.path.replace(':id', encodeURIComponent(String(id))), { method: 'PUT', body: JSON.stringify(workout) }),
  deleteWorkout: async (id: number | string) => fetchJSON(endpoints.deleteWorkout.path.replace(':id', encodeURIComponent(String(id))), { method: 'DELETE' }),
};