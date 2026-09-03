// Need to use the React-specific entry point to import createApi
import { baseApi } from './baseApi'

// Define a service using a base URL and expected endpoints
export const locationTagsApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        listTags: builder.query<string[], void>({
            query: () => '/tags',
            providesTags: ['Location'],
        }),
        createTag: builder.mutation<string, string>({
            query: (name) => ({
                url: '/tags',
                method: 'POST',
                body: { name },
            }),
            invalidatesTags: ['Location'],
        }),
        renameTag: builder.mutation<string, { oldName: string; newName: string }>({
            query: ({ oldName, newName }) => ({
                url: `/tags/${oldName}`,
                method: 'PATCH',
                body: { newName },
            }),
            invalidatesTags: ['Location'],
        }),
        deleteTag: builder.mutation<void, string>({
            query: (name) => ({
                url: `/tags/${name}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Location'],
        }),
    }),
    overrideExisting: false,
})

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const { useListTagsQuery, useCreateTagMutation, useRenameTagMutation, useDeleteTagMutation } = locationTagsApi