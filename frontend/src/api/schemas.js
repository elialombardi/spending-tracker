export const schemas = {
  Location: {
    example: {
      id: 1,
      title: 'Central Park',
      tags: ['kids'],
      url: 'https://example.com',
      lat: 40.7829,
      lng: -73.9654,
      description: 'Great for kids',
    },
  },
  CreateLocation: {
    example: {
      title: "Joe's Pizza",
      tags: ['restaurant'],
      url: 'https://www.joespizza.com',
      lat: 40.7308,
      lng: -73.9973,
      description: 'Classic NY slice',
    },
  },
  UpdateLocation: {
    example: {
      title: 'Updated title',
      tags: ['restaurant', 'favorite'],
      url: 'https://example.com',
      lat: 40.7308,
      lng: -73.9973,
      description: 'Updated',
    },
  },
  Tag: {
    example: 'restaurant',
  },

  // --- Workouts & Sessions Schemas (NEW) ---
  Timer: {
    example: {
      id: 10,
      sessionId: 1,
      name: 'Sprint',
      duration: 30, // seconds
      color: '#FF0000',
      createdAt: '2026-08-16T10:00:00Z',
      updatedAt: '2026-08-16T10:00:00Z'
    }
  },
  Session: {
    example: {
      id: 1,
      name: 'HIIT Leg Circuit',
      rounds: 3,
      cycles: 2,
      CycleRestDuration: 60,
      timers: [
        { id: 10, name: 'Sprint', duration: 30, color: '#FF0000' },
        { id: 11, name: 'Rest', duration: 15, color: '#00FF00' }
      ],
      createdAt: '2026-08-16T10:00:00Z',
      updatedAt: '2026-08-16T10:00:00Z'
    }
  },
  CreateSession: {
    example: {
      name: 'HIIT Leg Circuit',
      rounds: 3,
      cycles: 2,
      CycleRestDuration: 60,
      timers: [
        { name: 'Sprint', duration: 30, color: '#FF0000' },
        { name: 'Rest', duration: 15, color: '#00FF00' }
      ]
    }
  },
  Workout: {
    example: {
      id: 5,
      name: 'Full Body Conditioning',
      sessions: [
        { id: 1, name: 'HIIT Leg Circuit', rounds: 3, cycles: 2, CycleRestDuration: 60, timers: [] }
      ],
      createdAt: '2026-08-16T10:00:00Z',
      updatedAt: '2026-08-16T10:00:00Z'
    }
  },
  CreateWorkout: {
    example: {
      name: 'Full Body Conditioning',
      sessionIds: [1, 2] // Ordered array of Session IDs
    }
  }
};