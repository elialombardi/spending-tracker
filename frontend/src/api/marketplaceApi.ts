import { baseApi } from './baseApi';

export interface MarketplaceConfiguration {
    dailyEnabled: boolean;
    telegramConfigured: boolean;
    marketplaces: { id: string; name: string; available: boolean; configured: boolean }[];
}

export interface MarketplaceSearchInput {
    keywords: string;
    marketplaces: string[];
    maxPriceCents: number;
    enabled: boolean;
}

export interface MarketplaceSearch extends MarketplaceSearchInput {
    id: number;
    lastCheckedAt: string | null;
    lastError: string;
    nextCheckAt: string;
    createdAt: string;
    updatedAt: string;
}

export interface MarketplaceMatch {
    id: number;
    searchId: number;
    marketplace: string;
    itemId: string;
    title: string;
    url: string;
    priceCents: number;
    notifiedAt: string | null;
    createdAt: string;
}

export const marketplaceApi = baseApi.injectEndpoints({
    endpoints: builder => ({
        getMarketplaceConfiguration: builder.query<MarketplaceConfiguration, void>({
            query: () => '/marketplace-searches/configuration',
        }),
        getMarketplaceSearches: builder.query<MarketplaceSearch[], void>({
            query: () => '/marketplace-searches',
            providesTags: ['MarketplaceSearch'],
        }),
        saveMarketplaceSearch: builder.mutation<MarketplaceSearch, { id?: number; input: MarketplaceSearchInput }>({
            query: ({ id, input }) => ({
                url: `/marketplace-searches${id ? `/${id}` : ''}`,
                method: id ? 'PUT' : 'POST',
                body: input,
            }),
            invalidatesTags: ['MarketplaceSearch'],
        }),
        deleteMarketplaceSearch: builder.mutation<void, number>({
            query: id => ({ url: `/marketplace-searches/${id}`, method: 'DELETE' }),
            invalidatesTags: ['MarketplaceSearch'],
        }),
        getMarketplaceMatches: builder.query<MarketplaceMatch[], number>({
            query: id => `/marketplace-searches/${id}/matches`,
            providesTags: ['MarketplaceSearch'],
        }),
    }),
});

export const {
    useGetMarketplaceConfigurationQuery,
    useGetMarketplaceSearchesQuery,
    useSaveMarketplaceSearchMutation,
    useDeleteMarketplaceSearchMutation,
    useGetMarketplaceMatchesQuery,
} = marketplaceApi;
