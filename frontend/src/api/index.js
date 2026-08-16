import { API_BASE } from '../config';
import { endpoints } from './endpoints';
import { schemas } from './schemas';
import { fetchApiResponse, fetchJSON, readError, downloadFile } from './client';

import { tasksApi } from './domains/tasks';
import { transactionsApi } from './domains/transactions';
import { locationsApi } from './domains/locations';
import { workoutsApi } from './domains/workouts';

// Aggregated client object preserving previous backward compatibility
const api = {
  endpoints,
  schemas,
  API_BASE,
  ...tasksApi,
  ...transactionsApi,
  ...locationsApi,
  ...workoutsApi,
};

export default api;

// Named exports
export {
  API_BASE,
  endpoints,
  schemas,
  fetchApiResponse,
  fetchJSON,
  readError,
  downloadFile,
  tasksApi,
  transactionsApi,
  locationsApi,
  workoutsApi,
};