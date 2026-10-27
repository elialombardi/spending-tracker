import { baseApi } from '../baseApi';
import type {
    YoutubeChannel,
    Video,
    Tag,
    CreateTagRequest,
    UpdateTagRequest,
    AddTagsRequest,
    RemoveTagsRequest,
    SyncStatus
} from './types';

export const youtubeApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        // Channels
        getChannels: builder.query<YoutubeChannel[], { includeVideos?: boolean; limit?: number }>({
            query: (params) => ({
                url: '/youtube/channels',
                params,
            }),
            providesTags: ['Channels'],
        }),

        getUntaggedChannels: builder.query<YoutubeChannel[], void>({
            query: () => '/youtube/channels/untagged',
            providesTags: ['Channels'],
        }),

        getChannel: builder.query<YoutubeChannel, string>({
            query: (id) => `/youtube/channels/${id}`,
            providesTags: (result, error, id) => [{ type: 'Channels', id }],
        }),

        addTagsToChannel: builder.mutation<void, { channelId: string; tagIds: string[] }>({
            query: ({ channelId, tagIds }) => ({
                url: `/youtube/channels/${channelId}/tags`,
                method: 'POST',
                body: { tagIds },
            }),
            invalidatesTags: ['Channels'],
        }),

        removeTagsFromChannel: builder.mutation<void, { channelId: string; tagIds: string[] }>({
            query: ({ channelId, tagIds }) => ({
                url: `/youtube/channels/${channelId}/tags`,
                method: 'DELETE',
                body: { tagIds },
            }),
            invalidatesTags: ['Channels'],
        }),

        // Tags
        getTags: builder.query<Tag[], void>({
            query: () => '/youtube/tags',
            providesTags: ['Tags'],
        }),

        createTag: builder.mutation<Tag, CreateTagRequest>({
            query: (body) => ({
                url: '/youtube/tags',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Tags'],
        }),

        updateTag: builder.mutation<Tag, { id: string; data: UpdateTagRequest }>({
            query: ({ id, data }) => ({
                url: `/youtube/tags/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: ['Tags'],
        }),

        deleteTag: builder.mutation<void, string>({
            query: (id) => ({
                url: `/youtube/tags/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Tags', 'Channels'],
        }),

        // Videos
        getLatestVideos: builder.query<Video[], { limit?: number }>({
            query: (params) => ({
                url: '/youtube/videos/latest',
                params,
            }),
            providesTags: ['Videos'],
        }),

        getVideosForTag: builder.query<Video[], { tagId: string; limit?: number }>({
            query: ({ tagId, limit }) => ({
                url: `/youtube/videos/tag/${tagId}`,
                params: { limit },
            }),
            providesTags: (result, error, { tagId }) => [{ type: 'Videos', id: tagId }],
        }),

        // Sync
        syncAll: builder.mutation<{ syncId: string }, void>({
            query: () => ({
                url: '/youtube/sync',
                method: 'POST',
            }),
            invalidatesTags: ['Sync'],
        }),

        syncChannel: builder.mutation<{ syncId: string }, string>({
            query: (channelId) => ({
                url: `/youtube/sync/channel/${channelId}`,
                method: 'POST',
            }),
            invalidatesTags: ['Sync'],
        }),

        syncTagChannels: builder.mutation<{ syncId: string }, string>({
            query: (tagId) => ({
                url: `/youtube/sync/tag/${tagId}`,
                method: 'POST',
            }),
            invalidatesTags: ['Sync'],
        }),

        getSyncStatus: builder.query<SyncStatus, void>({
            query: () => '/youtube/sync/status',
            providesTags: ['Sync'],
            async onQueryStarted(_arg, { dispatch, getState, queryFulfilled }) {
                const previous = youtubeApi.endpoints.getSyncStatus.select()(getState()).data
                try {
                    const { data } = await queryFulfilled
                    if (previous && data.lastSync && previous.lastSync?.id !== data.lastSync.id) {
                        dispatch(baseApi.util.invalidateTags(['Channels', 'Videos']))
                    }
                } catch {
                    console.error('Failed to refresh YouTube sync status.')
                }
            },
        }),
    }),
});

export const {
    useGetChannelsQuery,
    useGetUntaggedChannelsQuery,
    useGetChannelQuery,
    useAddTagsToChannelMutation,
    useRemoveTagsFromChannelMutation,
    useGetTagsQuery,
    useCreateTagMutation,
    useUpdateTagMutation,
    useDeleteTagMutation,
    useGetLatestVideosQuery,
    useGetVideosForTagQuery,
    useSyncAllMutation,
    useSyncChannelMutation,
    useSyncTagChannelsMutation,
    useGetSyncStatusQuery,
} = youtubeApi;