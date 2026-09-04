import { NoteFolderTree, Note } from "../../../types/notes";

export function findFolderByID(nodes: NoteFolderTree[], folderID: number): NoteFolderTree | null {
    for (const node of nodes) {
        if (node.id === folderID) return node;
        const nested = findFolderByID(node.children || [], folderID);
        if (nested) return nested;
    }
    return null;
}

export function findNoteByID(nodes: NoteFolderTree[], noteID: number): { note: Note; folderId: number } | null {
    for (const node of nodes) {
        const found = (node.notes || []).find((note) => note.id === noteID);
        if (found) return { note: found, folderId: node.id };
        const nested = findNoteByID(node.children || [], noteID);
        if (nested) return nested;
    }
    return null;
}