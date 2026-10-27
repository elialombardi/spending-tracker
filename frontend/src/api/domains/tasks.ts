import { fetchJSON } from "../client";
import { endpoints } from "../endpoints";
import type { Project, Task, TaskPayload, ProjectPayload } from "../../types/tasks";

export const tasksApi = {
  listTasks: async () => fetchJSON<Task[]>(endpoints.listTasks.path),
  createTask: async (task: TaskPayload) =>
    fetchJSON<Task>(endpoints.createTask.path, {
      method: "POST",
      body: JSON.stringify(task),
    }),
  updateTask: async (task: TaskPayload) => {
    if (!task || task.id == null)
      throw new Error("Task id is required for update");
    const path = `${endpoints.createTask.path.replace(/\/$/, "")}/${encodeURIComponent(String(task.id))}`;
    return fetchJSON<Task>(path, { method: "PUT", body: JSON.stringify(task) });
  },
  listProjects: async () => fetchJSON<Project[]>(endpoints.listProjects.path),
  createProject: async (project: ProjectPayload) =>
    fetchJSON<Project>(endpoints.createProject.path, {
      method: "POST",
      body: JSON.stringify(project),
    }),
  assignProjectToTasks: async (payload: {
    taskIds: string[];
    projectId: string;
  }) => {
    if (!payload || !payload.taskIds || !payload.projectId) {
      throw new Error(
        "Both taskIds and projectId are required for assigning a project to tasks",
      );
    }
    return fetchJSON<void>(endpoints.assignProjectToTasks.path, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
