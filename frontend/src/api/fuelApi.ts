import { baseApi } from './baseApi';

export interface FuelRecord {
    id: string;
    userId: string;
    fillType: 'gpl' | 'benzina';
    createdAt: string;
}

export interface CreateFuelRequest {
    fillType: 'gpl' | 'benzina';
}

export interface FuelStats {
    totalFills: number;
    gplCount: number;
    benzinaCount: number;
    fillsUntilBenzina: number;
    nextFillType: 'gpl' | 'benzina';
}

export const fuelApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        createFuelRecord: builder.mutation<FuelRecord, CreateFuelRequest>({
            query: (data) => ({
                url: '/fuel/records',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Fuel'],
        }),
        getFuelRecords: builder.query<FuelRecord[], void>({
            query: () => '/fuel/records',
            providesTags: ['Fuel'],
        }),
        getFuelStats: builder.query<FuelStats, void>({
            query: () => '/fuel/stats',
            providesTags: ['Fuel'],
        }),
        getLastFuelRecord: builder.query<FuelRecord | null, void>({
            query: () => '/fuel/records/last',
            providesTags: ['Fuel'],
        }),
        deleteFuelRecord: builder.mutation<void, string>({
            query: (id) => ({
                url: `/fuel/admin/records/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Fuel'],
        }),
        deleteAllFuelRecords: builder.mutation<void, void>({
            query: () => ({
                url: '/fuel/admin/records',
                method: 'DELETE',
            }),
            invalidatesTags: ['Fuel'],
        }),
    }),
});

export const {
    useCreateFuelRecordMutation,
    useGetFuelRecordsQuery,
    useGetFuelStatsQuery,
    useGetLastFuelRecordQuery,
    useDeleteFuelRecordMutation,
    useDeleteAllFuelRecordsMutation,
} = fuelApi;