import { fetchJSON } from '../client';
import { endpoints } from '../endpoints';

export const locationsApi = {
  listLocations: async () => fetchJSON(endpoints.listLocations.path),
  getLocation: async (id) => fetchJSON(endpoints.getLocation.path.replace(':id', encodeURIComponent(String(id)))),
  createLocation: async (location) => fetchJSON(endpoints.createLocation.path, { method: 'POST', body: JSON.stringify(location) }),
  updateLocation: async (id, location) => fetchJSON(endpoints.updateLocation.path.replace(':id', encodeURIComponent(String(id))), { method: 'PUT', body: JSON.stringify(location) }),
  deleteLocation: async (id) => fetchJSON(endpoints.deleteLocation.path.replace(':id', encodeURIComponent(String(id))), { method: 'DELETE' }),

  // Tags
  listTags: async () => fetchJSON(endpoints.listTags.path),
  createTag: async (name) => fetchJSON(endpoints.createTag.path, { method: 'POST', body: JSON.stringify({ name }) }),
  renameTag: async (oldName, newName) => fetchJSON(endpoints.renameTag.path.replace(':name', encodeURIComponent(String(oldName))), { method: 'PATCH', body: JSON.stringify({ newName }) }),
  deleteTag: async (name) => fetchJSON(endpoints.deleteTag.path.replace(':name', encodeURIComponent(String(name))), { method: 'DELETE' }),
  toggleLocationTag: async (id, tag, present) => fetchJSON(endpoints.toggleLocationTag.path.replace(':id', encodeURIComponent(String(id))), { method: 'POST', body: JSON.stringify({ tag, present }) }),
};