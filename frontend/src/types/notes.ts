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
  position: number;
  title: string;
  content: string;
  style: NoteStyle;
  createdAt: string;
  updatedAt: string;
}

export interface NoteFolderTree {
  id: number;
  name: string;
  position: number;
  parentId?: number | null;
  children: NoteFolderTree[];
  notes: Note[];
}
