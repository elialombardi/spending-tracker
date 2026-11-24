import { Note, NoteFolderTree } from '../../../types/notes';

function formatNote(note: Note, type: NoteFolderTree['type']): string {
    const title = note.title.trim();
    switch (type) {
        case 'buy_list':
            return `${note.completed ? '[x]' : '[ ]'} ${title}`;
        case 'tasks_list': {
            const extras = [note.description?.trim(), note.endDate ? `due ${note.endDate}` : ''].filter(Boolean);
            return `${note.completed ? '[x]' : '[ ]'} ${title}${extras.length ? ` (${extras.join(' — ')})` : ''}`;
        }
        case 'links': {
            const parts = [title, note.url?.trim()].filter(Boolean).join(' — ');
            const description = note.description?.trim();
            return description ? `${parts}\n  ${description}` : parts;
        }
        case 'diary': {
            const content = note.content?.trim();
            return content ? `${title}\n${content}` : title;
        }
    }
}

// Plain-text export of a folder's direct items, in display order.
export function formatFolderAsText(folder: NoteFolderTree): string {
    const lines = folder.notes.map((note) => formatNote(note, folder.type));
    const separator = folder.type === 'diary' ? '\n\n' : '\n';
    return [folder.name.trim(), lines.join(separator)].filter(Boolean).join('\n\n');
}
