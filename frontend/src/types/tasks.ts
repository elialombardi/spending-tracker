export interface Task {
  id: string;
  name: string;
  cost: number;
  date: string;
  sentOn?: string | null;
  description?: string | null;
  projectId?: string | null;
  projectName?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
}

export interface TaskPayload {
  id?: string;
  name: string;
  cost: number;
  date: string;
  sentOn?: string | null;
  description?: string | null;
  projectId?: string | null;
}

export interface ProjectPayload {
  name: string;
  description?: string | null;
}

export type AssignProjectPayload = {
  taskIds: string[];
  projectId: string;
};

export type ViewType = "not-sent" | "prepare" | "history";
