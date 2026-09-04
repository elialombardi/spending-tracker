import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { API_BASE } from "../config";
import { ensureAuthenticated, logout } from "../auth";

// Custom base query that adds auth and handles 401/403
const baseQuery = fetchBaseQuery({
  baseUrl: `${API_BASE}/api`, // or just API_BASE if it already includes /api
  prepareHeaders: async (headers, { getState, endpoint, extra }) => {
    // You can check if the endpoint should be anonymous via a custom property
    // For simplicity, we'll assume all requests need auth unless you add a meta flag.
    // We'll handle that later using a custom query function.
    // But we can also check the endpoint name or pass a flag via the query argument.
    // For now, let's add auth by default.
    const session = await ensureAuthenticated();
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
    return headers;
  },
});

// Wrap to handle 401/403 and transform errors to your ApiError shape
// Wrap to handle 401/403 and transform errors to your ApiError shape
const wrappedBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await baseQuery(args, api, extraOptions);

  if (result.error) {
    const { status } = result.error;
    if (status === 401) {
      logout("Your session expired. Please sign in again.");
      return {
        error: {
          status: 401,
          data: { message: "Authentication is required." },
        },
      };
    }
    if (status === 403) {
      const body = result.error.data;
      let message = "You do not have permission to perform that action.";
      if (body && typeof body === "object") {
        // Cast to a record to safely access common error fields
        const data = body as Record<string, any>;
        message =
          data.title || data.detail || data.message || JSON.stringify(body);
      } else if (typeof body === "string") {
        message = body;
      }
      return {
        error: {
          status: 403,
          data: { message },
        },
      };
    }
    // For other errors, keep as is
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: "baseApi",
  baseQuery: wrappedBaseQuery,
  endpoints: () => ({}),
  tagTypes: ["Location", "Fuel", "Diary"],
});
