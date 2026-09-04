import { baseApi } from "./baseApi";

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

export const diaryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listEntries: builder.query<ListEntriesResponse, ListEntriesParams>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.search) queryParams.append("search", params.search);
        if (params.from) queryParams.append("from", params.from);
        if (params.to) queryParams.append("to", params.to);
        if (params.page) queryParams.append("page", String(params.page));
        if (params.limit) queryParams.append("limit", String(params.limit));

        const queryString = queryParams.toString();
        return `/diary/entries${queryString ? `?${queryString}` : ""}`;
      },
      providesTags: ["Diary"],
    }),

    getEntryByDate: builder.query<DiaryEntry | null, string>({
      query: (date) => `/diary/entries/${date}`,
      providesTags: (result, error, date) => [{ type: "Diary", id: date }],
    }),

    createEntry: builder.mutation<
      DiaryEntry,
      { date: string; content: string }
    >({
      query: ({ date, content }) => ({
        url: "/diary/entries",
        method: "POST",
        body: { date, content },
      }),
      invalidatesTags: ["Diary"],
    }),

    updateEntry: builder.mutation<
      DiaryEntry,
      { date: string; content: string }
    >({
      query: ({ date, content }) => ({
        url: `/diary/entries/${date}`,
        method: "PUT",
        body: { content },
      }),
      invalidatesTags: (result, error, { date }) => [
        { type: "Diary", id: date },
        "Diary",
      ],
    }),

    deleteEntry: builder.mutation<void, string>({
      query: (date) => ({
        url: `/diary/entries/${date}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Diary"],
    }),
  }),
});

export const {
  useListEntriesQuery,
  useGetEntryByDateQuery,
  useCreateEntryMutation,
  useUpdateEntryMutation,
  useDeleteEntryMutation,
} = diaryApi;
