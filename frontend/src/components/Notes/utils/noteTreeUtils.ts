import { NoteFolderTree, Note } from "../../../types/notes";

type PositionedItem = { id: number; position: number };

export async function reorderItems(
    items: readonly PositionedItem[],
    id: number,
    direction: -1 | 1,
    savePosition: (id: number, position: number) => Promise<unknown>,
): Promise<PositionedItem[]> {
    const index = items.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return [];

    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const updates = reordered.flatMap((item, position) => (
        item.position === position ? [] : [{ id: item.id, position }]
    ));
    // Unique positions also make moves deterministic when existing positions are tied.
    for (const update of updates) {
        await savePosition(update.id, update.position);
    }
    return updates;
}

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