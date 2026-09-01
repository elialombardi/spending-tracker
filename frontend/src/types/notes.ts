export interface NoteStyle {
  bold: boolean;
  italic: boolean;
  textColor: string;
  backgroundColor: string;
  fontSize: number;
}

export interface Note {
  id: number;
  folderId: number;
  title: string;
  content: string;
  style: NoteStyle;
  createdAt: string;
  updatedAt: string;
}

export interface NoteFolderTree {
  id: number;
  name: string;
  parentId?: number | null;
  children: NoteFolderTree[];
  notes: Note[];
}
