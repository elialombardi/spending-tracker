import { fetchJSON } from './client';
import { endpoints } from './endpoints';

export interface DiaryEntry {
  id: number;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ListEntriesParams {
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface ListEntriesResponse {
  data: DiaryEntry[];
  total: number;
  page: number;
  limit: number;
}

function buildQuery(params: ListEntriesParams): string {
  const q = new URLSearchParams();
  if (params.search) q.append('search', params.search);
  if (params.from) q.append('from', params.from);
  if (params.to) q.append('to', params.to);
  if (params.page) q.append('page', String(params.page));
  if (params.limit) q.append('limit', String(params.limit));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const diaryApi = {
  list: (params: ListEntriesParams) =>
    fetchJSON<ListEntriesResponse>(`${endpoints.diary.entries}${buildQuery(params)}`, {
      method: 'GET',
    }),

  getByDate: (date: string) =>
    fetchJSON<DiaryEntry>(endpoints.diary.entry(date), { method: 'GET' }),

  create: (date: string, content: string) =>
    fetchJSON<DiaryEntry>(endpoints.diary.entries, {
      method: 'POST',
      body: JSON.stringify({ date, content }),
    }),

  update: (date: string, content: string) =>
    fetchJSON<DiaryEntry>(endpoints.diary.entry(date), {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
};