export type UserRole = 'Admin' | 'Writer' | 'Reader'

export interface AuthSession {
  token: string
  role: UserRole
  expires_at: string
  username?: string
}

export interface ApiError extends Error {
  code?: 'AUTH_REQUIRED' | 'FORBIDDEN' | 'API_ERROR' | 'AUTH_INVALID' | 'AUTH_LOGIN_FAILED'
  status?: number
  body?: string
}

export interface Location {
  id: number
  title: string
  tags: string[]
  url?: string
  lat: number
  lng: number
  description?: string
}

export type LocationPayload = Omit<Location, 'id'>

export interface Timer {
  id?: number
  sessionId?: number
  name: string
  duration: number
  color?: string
}

export interface Session {
  id?: number
  name: string
  rounds?: number
  cycles?: number
  CycleRestDuration?: number
  timers: Timer[]
}

export interface Workout {
  id?: number
  name: string
  sessions?: Session[]
  sessionIds?: number[]
}

export interface Project {
  id?: number
  name: string
}

export interface Task {
  id?: number
  title?: string
  description?: string
  status?: string
  sent?: boolean
}

export interface UserCredentials {
  username: string
  password: string
}

export interface User {
  id?: number
  username: string
  role: UserRole
  password?: string
  active?: boolean
}

export interface NoteStyle {
  bold: boolean
  italic: boolean
  textColor: string
  backgroundColor: string
  fontSize: number
}

export interface Note {
  id: number
  folderId: number
  title: string
  content: string
  style: NoteStyle
  createdAt: string
  updatedAt: string
}

export interface NoteFolderTree {
  id: number
  name: string
  parentId?: number | null
  children: NoteFolderTree[]
  notes: Note[]
}
