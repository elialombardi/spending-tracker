import { fetchJSON } from '../client';
import { endpoints } from '../endpoints';
import type { Note, NoteFolderTree, NoteFolderType, NoteStyle } from '../../types/notes';

type CreateFolderPayload = {
  name: string
  type?: NoteFolderType
  position?: number
  parentId?: number
}

type UpdateFolderPayload = {
  name?: string
  type?: NoteFolderType
  position?: number
  parentId?: number
}

type CreateNotePayload = {
  folderId: number
  position?: number
  title: string
  content?: string
  style?: NoteStyle
  description?: string
  endDate?: string
  completed?: boolean
}

type UpdateNotePayload = {
  folderId?: number
  position?: number
  title?: string
  content?: string
  style?: NoteStyle
  description?: string
  endDate?: string
  completed?: boolean
}

export const notesApi = {
  listNotesTree: async () => fetchJSON<NoteFolderTree[]>(endpoints.listNotesTree.path),
  createNoteFolder: async (payload: CreateFolderPayload) => fetchJSON<NoteFolderTree>(endpoints.createNoteFolder.path, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateNoteFolder: async (id: number, payload: UpdateFolderPayload) => fetchJSON<NoteFolderTree>(endpoints.updateNoteFolder.path.replace(':id', String(id)), {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  deleteNoteFolder: async (id: number) => fetchJSON(endpoints.deleteNoteFolder.path.replace(':id', String(id)), {
    method: 'DELETE',
  }),
  createNote: async (payload: CreateNotePayload) => fetchJSON<Note>(endpoints.createNote.path, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateNote: async (id: number, payload: UpdateNotePayload) => fetchJSON<Note>(endpoints.updateNote.path.replace(':id', String(id)), {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  deleteNote: async (id: number) => fetchJSON(endpoints.deleteNote.path.replace(':id', String(id)), {
    method: 'DELETE',
  }),
};
