import { fetchJSON } from '../client';
import { endpoints } from '../endpoints';
import type { AuthSession, User, UserCredentials } from '../../types/domain';

export const usersApi = {
  // Authentication
  login: async (credentials: UserCredentials) => {
    return fetchJSON<AuthSession>(endpoints.login.path, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  // User CRUD
  listUsers: async (page = 1, limit = 10) => {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) }).toString();
    return fetchJSON<User[]>(`${endpoints.listUsers.path}?${query}`);
  },

  getUser: async (id: number | string) => {
    const path = endpoints.getUser.path.replace(':id', String(id));
    return fetchJSON<User>(path);
  },

  getUserByUsername: async (username: string) => {
    const path = endpoints.getUserByUsername.path.replace(':username', username);
    return fetchJSON<User>(path);
  },

  createUser: async (userData: User) => {
    return fetchJSON<User>(endpoints.createUser.path, {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  updateUser: async (id: number | string, userData: Partial<User>) => {
    const path = endpoints.updateUser.path.replace(':id', String(id));
    return fetchJSON<User>(path, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  deleteUser: async (id: number | string) => {
    const path = endpoints.deleteUser.path.replace(':id', String(id));
    return fetchJSON(path, {
      method: 'DELETE',
    });
  },
};