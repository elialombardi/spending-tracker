export const endpoints = {
  // Tasks
  listTasks: { method: "GET", path: "/api/tasks" },
  createTask: { method: "POST", path: "/api/tasks" },
  listProjects: { method: "GET", path: "/api/projects" },
  createProject: { method: "POST", path: "/api/projects" },
  assignProjectToTasks: { method: "POST", path: "/api/tasks/assign-project" },

  // Transactions
  sendTransactions: { method: "POST", path: "/api/transactions/send" },

  // Locations
  listLocations: { method: "GET", path: "/api/locations" },
  getLocation: { method: "GET", path: "/api/locations/:id" },
  createLocation: { method: "POST", path: "/api/locations" },
  updateLocation: { method: "PUT", path: "/api/locations/:id" },
  deleteLocation: { method: "DELETE", path: "/api/locations/:id" },

  // Tags
  listTags: { method: "GET", path: "/api/tags" },
  createTag: { method: "POST", path: "/api/tags" },
  renameTag: { method: "PATCH", path: "/api/tags/:name" },
  deleteTag: { method: "DELETE", path: "/api/tags/:name" },
  toggleLocationTag: { method: "POST", path: "/api/locations/:id/tags" },

  // Sessions
  listSessions: { method: "GET", path: "/api/sessions" },
  getSession: { method: "GET", path: "/api/sessions/:id" },
  createSession: { method: "POST", path: "/api/sessions" },
  updateSession: { method: "PUT", path: "/api/sessions/:id" },
  deleteSession: { method: "DELETE", path: "/api/sessions/:id" },

  // Workouts
  listWorkouts: { method: "GET", path: "/api/workouts" },
  getWorkout: { method: "GET", path: "/api/workouts/:id" },
  createWorkout: { method: "POST", path: "/api/workouts" },
  updateWorkout: { method: "PUT", path: "/api/workouts/:id" },
  deleteWorkout: { method: "DELETE", path: "/api/workouts/:id" },

  // Users
  listUsers: { method: "GET", path: "/api/users" },
  getUser: { method: "GET", path: "/api/users/:id" },
  getUserByUsername: { method: "GET", path: "/api/users/username/:username" },
  createUser: { method: "POST", path: "/api/users" },
  updateUser: { method: "PUT", path: "/api/users/:id" },
  deleteUser: { method: "DELETE", path: "/api/users/:id" },
  login: { method: "POST", path: "/api/auth/login" },

  // Notes
  listNotesTree: { method: "GET", path: "/api/note-folders/tree" },
  createNoteFolder: { method: "POST", path: "/api/note-folders" },
  updateNoteFolder: { method: "PUT", path: "/api/note-folders/:id" },
  deleteNoteFolder: { method: "DELETE", path: "/api/note-folders/:id" },
  createNote: { method: "POST", path: "/api/notes" },
  updateNote: { method: "PUT", path: "/api/notes/:id" },
  deleteNote: { method: "DELETE", path: "/api/notes/:id" },

  diary: {
    entries: "/api/diary/entries",
    entry: (date: string) => `/api/diary/entries/${date}`,
  },

  boxingEvents: '/api/boxing-events',
};
