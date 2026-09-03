// Need to use the React-specific entry point to import createApi
import { baseApi } from './baseApi'
import { Location, LocationPayload } from '../types/domain'

//   listLocations: async () => fetchJSON<Location[]>(endpoints.listLocations.path),
//   getLocation: async (id: number | string) => fetchJSON<Location>(endpoints.getLocation.path.replace(':id', encodeURIComponent(String(id)))),
//   createLocation: async (location: LocationPayload) => fetchJSON<Location>(endpoints.createLocation.path, { method: 'POST', body: JSON.stringify(location) }),
//   updateLocation: async (id: number | string, location: Partial<LocationPayload>) => fetchJSON<Location>(endpoints.updateLocation.path.replace(':id', encodeURIComponent(String(id))), { method: 'PUT', body: JSON.stringify(location) }),
//   deleteLocation: async (id: number | string) => fetchJSON(endpoints.deleteLocation.path.replace(':id', encodeURIComponent(String(id))), { method: 'DELETE' }),

//   // Tags
//   listTags: async () => fetchJSON<string[]>(endpoints.listTags.path),
//   createTag: async (name: string) => fetchJSON<string>(endpoints.createTag.path, { method: 'POST', body: JSON.stringify({ name }) }),
//   renameTag: async (oldName: string, newName: string) => fetchJSON<string>(endpoints.renameTag.path.replace(':name', encodeURIComponent(String(oldName))), { method: 'PATCH', body: JSON.stringify({ newName }) }),
//   deleteTag: async (name: string) => fetchJSON(endpoints.deleteTag.path.replace(':name', encodeURIComponent(String(name))), { method: 'DELETE' }),
//   toggleLocationTag: async (id: number | string, tag: string, present: boolean) => fetchJSON<Location>(endpoints.toggleLocationTag.path.replace(':id', encodeURIComponent(String(id))), { method: 'POST', body: JSON.stringify({ tag, present }) }),


// Define a service using a base URL and expected endpoints
export const locationsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        listLocations: builder.query<Location[], void>({
            query: () => '/locations',
            providesTags: ['Location'],
        }),
        getLocation: builder.query<Location, number>({
            query: (id) => `/locations/${id}`,
            providesTags: (result, error, id) => [{ type: 'Location', id }],
        }),
        createLocation: builder.mutation<Location, LocationPayload>({
            query: (location) => ({
                url: '/locations',
                method: 'POST',
                body: location,
            }),
        }),
        toggleLocationTag: builder.mutation<Location, { id: number; tag: string; present: boolean }>({
            query: ({ id, tag, present }) => ({
                url: `/locations/${id}/toggle-tag`,
                method: 'POST',
                body: { tag, present },
            }),
            invalidatesTags: (result, error, { id }) => [{ type: 'Location', id }],
        }),
        updateLocation: builder.mutation<Location, { id: number; location: Partial<LocationPayload> }>({
            query: ({ id, location }) => ({
                url: `/locations/${id}`,
                method: 'PUT',
                body: location,
            }),
            invalidatesTags: (result, error, { id }) => [{ type: 'Location', id }],
        }),
        deleteLocation: builder.mutation<void, number>({
            query: (id) => ({
                url: `/locations/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: (result, error, id) => [{ type: 'Location', id }],
        }),
    }),
    overrideExisting: false,
})

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const { useListLocationsQuery, useGetLocationQuery, useCreateLocationMutation, useUpdateLocationMutation, useDeleteLocationMutation } = locationsApi