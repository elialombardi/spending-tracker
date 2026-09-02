import { fetchJSON } from './client';
import { endpoints } from './endpoints';

export interface BoxingEvent {
    id: number;
    title: string;
    start_date: string; // ISO datetime
    end_date?: string | null;
    location: string;
    description: string;
    created_at: string;
    updated_at: string;
}

export interface ListResponse {
    data: BoxingEvent[];
    total: number;
    page: number;
    limit: number;
}

export interface FilterParams {
    title?: string;
    location?: string;
    start_from?: string;
    start_to?: string;
    status?: 'upcoming' | 'past';
    page?: number;
    limit?: number;
}

export const boxingEventsApi = {
    list: (params: FilterParams) =>
        fetchJSON<ListResponse>(endpoints.boxingEvents, { method: 'GET', params }),

    get: (id: number) =>
        fetchJSON<BoxingEvent>(`${endpoints.boxingEvents}/${id}`, { method: 'GET' }),

    create: (data: Partial<BoxingEvent>) =>
        fetchJSON<BoxingEvent>(endpoints.boxingEvents, {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    update: (id: number, data: Partial<BoxingEvent>) =>
        fetchJSON<BoxingEvent>(`${endpoints.boxingEvents}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        }),

    delete: (id: number) =>
        fetchJSON(`${endpoints.boxingEvents}/${id}`, {
            method: 'DELETE'
        }),

    export: (params: FilterParams, format: 'csv' | 'ics' = 'csv') =>
        fetchJSON<Blob>(`${endpoints.boxingEvents}/export`, {
            params: { ...params, format },
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ResponseType: 'blob',
            },
        }),
};