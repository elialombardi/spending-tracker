import { baseApi } from './baseApi';

export interface RegisteredDevice {
    device_id: string;
    device_name: string;
}

export const devicesApi = baseApi.injectEndpoints({
    endpoints: builder => ({
        getRegisteredDevices: builder.query<RegisteredDevice[], void>({
            query: () => '/v1/auth/devices',
            providesTags: ['RegisteredDevice'],
        }),
        renameRegisteredDevice: builder.mutation<RegisteredDevice, RegisteredDevice>({
            query: ({ device_id, device_name }) => ({
                url: `/v1/auth/devices/${encodeURIComponent(device_id)}`,
                method: 'PATCH',
                body: { device_name },
            }),
            invalidatesTags: ['RegisteredDevice'],
        }),
        revokeRegisteredDevice: builder.mutation<void, string>({
            query: deviceId => ({
                url: `/v1/auth/devices/${encodeURIComponent(deviceId)}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['RegisteredDevice'],
        }),
    }),
});

export const {
    useGetRegisteredDevicesQuery,
    useRenameRegisteredDeviceMutation,
    useRevokeRegisteredDeviceMutation,
} = devicesApi;
