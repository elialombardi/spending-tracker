import { fetchJSON } from '../client';
import { endpoints } from '../endpoints';

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page);
  if (params.limit) searchParams.set('limit', params.limit);
  if (params.search) searchParams.set('search', params.search);
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export const workoutsApi = {
  // Sessions
  listSessions: async (params) => fetchJSON(`${endpoints.listSessions.path}${buildQuery(params)}`),
  getSession: async (id) => fetchJSON(endpoints.getSession.path.replace(':id', encodeURIComponent(String(id)))),
  createSession: async (session) => fetchJSON(endpoints.createSession.path, { method: 'POST', body: JSON.stringify(session) }),
  updateSession: async (id, session) => fetchJSON(endpoints.updateSession.path.replace(':id', encodeURIComponent(String(id))), { method: 'PUT', body: JSON.stringify(session) }),
  deleteSession: async (id) => fetchJSON(endpoints.deleteSession.path.replace(':id', encodeURIComponent(String(id))), { method: 'DELETE' }),

  // Workouts
  listWorkouts: async (params) => fetchJSON(`${endpoints.listWorkouts.path}${buildQuery(params)}`),
  getWorkout: async (id) => fetchJSON(endpoints.getWorkout.path.replace(':id', encodeURIComponent(String(id)))),
  createWorkout: async (workout) => fetchJSON(endpoints.createWorkout.path, { method: 'POST', body: JSON.stringify(workout) }),
  updateWorkout: async (id, workout) => fetchJSON(endpoints.updateWorkout.path.replace(':id', encodeURIComponent(String(id))), { method: 'PUT', body: JSON.stringify(workout) }),
  deleteWorkout: async (id) => fetchJSON(endpoints.deleteWorkout.path.replace(':id', encodeURIComponent(String(id))), { method: 'DELETE' }),
};