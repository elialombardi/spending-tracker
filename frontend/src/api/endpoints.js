export const endpoints = {
  // Tasks
  listTasks: { method: 'GET', path: '/api/tasks' },
  createTask: { method: 'POST', path: '/api/tasks' },
  listProjects: { method: 'GET', path: '/api/projects' },
  createProject: { method: 'POST', path: '/api/projects' },

  // Transactions
  sendTransactions: { method: 'POST', path: '/api/transactions/send' },

  // Locations
  listLocations: { method: 'GET', path: '/locations' },
  getLocation: { method: 'GET', path: '/locations/:id' },
  createLocation: { method: 'POST', path: '/locations' },
  updateLocation: { method: 'PUT', path: '/locations/:id' },
  deleteLocation: { method: 'DELETE', path: '/locations/:id' },

  // Tags
  listTags: { method: 'GET', path: '/tags' },
  createTag: { method: 'POST', path: '/tags' },
  renameTag: { method: 'PATCH', path: '/tags/:name' },
  deleteTag: { method: 'DELETE', path: '/tags/:name' },
  toggleLocationTag: { method: 'POST', path: '/locations/:id/tags' },

  // Sessions (NEW)
  listSessions: { method: 'GET', path: '/api/sessions' },
  getSession: { method: 'GET', path: '/api/sessions/:id' },
  createSession: { method: 'POST', path: '/api/sessions' },
  updateSession: { method: 'PUT', path: '/api/sessions/:id' },
  deleteSession: { method: 'DELETE', path: '/api/sessions/:id' },

  // Workouts (NEW)
  listWorkouts: { method: 'GET', path: '/api/workouts' },
  getWorkout: { method: 'GET', path: '/api/workouts/:id' },
  createWorkout: { method: 'POST', path: '/api/workouts' },
  updateWorkout: { method: 'PUT', path: '/api/workouts/:id' },
  deleteWorkout: { method: 'DELETE', path: '/api/workouts/:id' },
};