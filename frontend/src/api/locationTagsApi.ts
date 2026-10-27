// Need to use the React-specific entry point to import createApi
import { baseApi } from './baseApi'

// Define a service using a base URL and expected endpoints
export const locationTagsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        listTags: builder.query<string[], void>({
            query: () => '/tags',
            providesTags: ['LocationTag'],
        }),
        createLocationTag: builder.mutation<string, string>({
            query: (name) => ({
                url: '/tags',
                method: 'POST',
                body: { name },
            }),
            invalidatesTags: ['LocationTag'],
        }),
        renameLocationTag: builder.mutation<string, { oldName: string; newName: string }>({
            query: ({ oldName, newName }) => ({
                url: `/tags/${encodeURIComponent(oldName)}`,
                method: 'PATCH',
                body: { newName },
            }),
            invalidatesTags: ['Location', 'LocationTag'],
        }),
        deleteLocationTag: builder.mutation<void, string>({
            query: (name) => ({
                url: `/tags/${encodeURIComponent(name)}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Location', 'LocationTag'],
        }),
    }),
    overrideExisting: false,
})

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const { useListTagsQuery, useCreateLocationTagMutation, useRenameLocationTagMutation, useDeleteLocationTagMutation } = locationTagsApi