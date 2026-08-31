import { fetchJSON } from '../client';
import { endpoints } from '../endpoints';
import type { Location, LocationPayload } from '../../types/domain';

export const locationsApi = {
  listLocations: async () => fetchJSON<Location[]>(endpoints.listLocations.path),
  getLocation: async (id: number | string) => fetchJSON<Location>(endpoints.getLocation.path.replace(':id', encodeURIComponent(String(id)))),
  createLocation: async (location: LocationPayload) => fetchJSON<Location>(endpoints.createLocation.path, { method: 'POST', body: JSON.stringify(location) }),
  updateLocation: async (id: number | string, location: Partial<LocationPayload>) => fetchJSON<Location>(endpoints.updateLocation.path.replace(':id', encodeURIComponent(String(id))), { method: 'PUT', body: JSON.stringify(location) }),
  deleteLocation: async (id: number | string) => fetchJSON(endpoints.deleteLocation.path.replace(':id', encodeURIComponent(String(id))), { method: 'DELETE' }),

  // Tags
  listTags: async () => fetchJSON<string[]>(endpoints.listTags.path),
  createTag: async (name: string) => fetchJSON<string>(endpoints.createTag.path, { method: 'POST', body: JSON.stringify({ name }) }),
  renameTag: async (oldName: string, newName: string) => fetchJSON<string>(endpoints.renameTag.path.replace(':name', encodeURIComponent(String(oldName))), { method: 'PATCH', body: JSON.stringify({ newName }) }),
  deleteTag: async (name: string) => fetchJSON(endpoints.deleteTag.path.replace(':name', encodeURIComponent(String(name))), { method: 'DELETE' }),
  toggleLocationTag: async (id: number | string, tag: string, present: boolean) => fetchJSON<Location>(endpoints.toggleLocationTag.path.replace(':id', encodeURIComponent(String(id))), { method: 'POST', body: JSON.stringify({ tag, present }) }),
};