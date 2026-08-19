import { fetchJSON } from '../client';
import { endpoints } from '../endpoints';

export const usersApi = {
  // Authentication
  login: async (credentials) => {
    return fetchJSON(endpoints.login.path, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  // User CRUD
  listUsers: async (page = 1, limit = 10) => {
    const query = new URLSearchParams({ page, limit }).toString();
    return fetchJSON(`${endpoints.listUsers.path}?${query}`);
  },

  getUser: async (id) => {
    const path = endpoints.getUser.path.replace(':id', id);
    return fetchJSON(path);
  },

  getUserByUsername: async (username) => {
    const path = endpoints.getUserByUsername.path.replace(':username', username);
    return fetchJSON(path);
  },

  createUser: async (userData) => {
    return fetchJSON(endpoints.createUser.path, {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  updateUser: async (id, userData) => {
    const path = endpoints.updateUser.path.replace(':id', id);
    return fetchJSON(path, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  deleteUser: async (id) => {
    const path = endpoints.deleteUser.path.replace(':id', id);
    return fetchJSON(path, {
      method: 'DELETE',
    });
  },
};