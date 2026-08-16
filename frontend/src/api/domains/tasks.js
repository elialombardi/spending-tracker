import { fetchJSON } from '../client';
import { endpoints } from '../endpoints';

export const tasksApi = {
  listTasks: async () => fetchJSON(endpoints.listTasks.path),
  createTask: async (task) => fetchJSON(endpoints.createTask.path, { method: 'POST', body: JSON.stringify(task) }),
  updateTask: async (task) => {
    if (!task || task.id == null) throw new Error('Task id is required for update');
    const path = `${endpoints.createTask.path.replace(/\/$/, '')}/${encodeURIComponent(String(task.id))}`;
    return fetchJSON(path, { method: 'PUT', body: JSON.stringify(task) });
  },
  listProjects: async () => fetchJSON(endpoints.listProjects.path),
  createProject: async (project) => fetchJSON(endpoints.createProject.path, { method: 'POST', body: JSON.stringify(project) }),
};