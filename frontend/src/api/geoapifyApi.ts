// Need to use the React-specific entry point to import createApi
import { baseApi } from './baseApi'

// Define a service using a base URL and expected endpoints
export const geoapifyApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        getGeocodeSearch: builder.query({
            query: (params) => ({
                url: '/geoapify/v1/geocode/search',
                params,
            }),
        }),
        getGeocodeReverse: builder.query({
            query: (params) => ({
                url: '/geoapify/v1/geocode/reverse',
                params,
            }),
        }),
        getGeocodeAutocomplete: builder.query({
            query: (params) => ({
                url: '/geoapify/v1/geocode/autocomplete',
                params,
            }),
        }),
        getPlaces: builder.query({
            query: (params) => ({
                url: '/geoapify/v2/places',
                params,
            }),
        }),
        getRouting: builder.query({
            query: (params) => ({
                url: '/geoapify/v1/routing',
                params,
            }),
        }),
    }),
    overrideExisting: false,
})

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const {
    useGetGeocodeSearchQuery,
    useGetGeocodeReverseQuery,
    useGetGeocodeAutocompleteQuery,
    useGetPlacesQuery,
    useGetRoutingQuery,
} = geoapifyApi