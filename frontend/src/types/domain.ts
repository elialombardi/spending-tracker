export type UserRole = "Admin" | "Writer" | "Reader";

export interface AuthSession {
  token: string;
  role: UserRole;
  expires_at: string;
  username?: string;
}

export interface ApiError extends Error {
  code?:
    | "AUTH_REQUIRED"
    | "FORBIDDEN"
    | "API_ERROR"
    | "AUTH_INVALID"
    | "AUTH_LOGIN_FAILED";
  status?: number;
  body?: string;
}

export interface Location {
  id: number;
  title: string;
  tags: string[];
  url?: string;
  lat: number;
  lng: number;
  description?: string;
}

export type LocationPayload = Omit<Location, "id">;

export interface UserCredentials {
  username: string;
  password: string;
}

export interface User {
  id?: number;
  username: string;
  role: UserRole;
  password?: string;
  active?: boolean;
}
