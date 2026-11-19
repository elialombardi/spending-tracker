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
  url: string;
  description: string | null;
  endDate: string | null;
  completed: boolean;
  style: NoteStyle;
  createdAt: string;
  updatedAt: string;
}

export interface NoteFolderTree {
  id: number;
  name: string;
  type: NoteFolderType;
  position: number;
  parentId?: number | null;
  children: NoteFolderTree[];
  notes: Note[];
}
export type NoteFolderType = 'buy_list' | 'tasks_list' | 'diary' | 'links';

export const folderTypeLabels: Record<NoteFolderType, string> = {
  buy_list: 'Buy list',
  tasks_list: 'Tasks list',
  diary: 'Diary',
  links: 'Bookmarks',
};

export function isNoteFolderType(value: string): value is NoteFolderType {
  return value === 'buy_list' || value === 'tasks_list' || value === 'diary' || value === 'links';
}

export function getBookmarkURL(value: string): string | null {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed) || /[\s\\]/u.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return url.hostname && !url.username && !url.password ? trimmed : null;
  } catch {
    // URL parsing throws for incomplete or malformed addresses.
    return null;
  }
}
