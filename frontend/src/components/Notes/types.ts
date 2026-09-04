import { Note, NoteFolderTree, NoteStyle } from '../../types/notes';

export type NotesWorkspaceProps = {
    canWrite: boolean;
};

export const colorOptions = ['#1f2937', '#0f766e', '#7c2d12', '#7c3aed', '#be123c'];
export const backgroundOptions = ['#ffffff', '#eff6ff', '#f0fdf4', '#fff7ed', '#fdf2f8'];
export const defaultStyle: NoteStyle = {
    bold: false,
    italic: false,
    textColor: '#1f2937',
    backgroundColor: '#ffffff',
    fontSize: 16,
};