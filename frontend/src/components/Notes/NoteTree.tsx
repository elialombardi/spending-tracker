import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { NoteFolderTree, Note } from '../../types/notes';

type NoteTreeProps = {
    tree: NoteFolderTree[];
    selectedFolderID: number | null;
    selectedNoteID: number | null;
    onSelectFolder: (folderId: number) => void;
    onSelectNote: (note: Note, folderId: number) => void;
};

export function NoteTree({ tree, selectedFolderID, selectedNoteID, onSelectFolder, onSelectNote }: NoteTreeProps) {
    function renderTree(nodes: NoteFolderTree[], depth = 0): ReactNode {
        return nodes.map((folder) => (
            <Box key={folder.id}>
                <ListItemButton
                    selected={selectedFolderID === folder.id}
                    sx={{ pl: 2 + depth * 2 }}
                    onClick={() => onSelectFolder(folder.id)}
                >
                    <FolderIcon color="primary" fontSize="small" sx={{ mr: 1 }} />
                    <ListItemText primary={folder.name} />
                </ListItemButton>
                {(folder.notes || []).map((note) => (
                    <ListItemButton
                        key={note.id}
                        selected={selectedNoteID === note.id}
                        sx={{ pl: 6 + depth * 2 }}
                        onClick={() => onSelectNote(note, folder.id)}
                    >
                        <InsertDriveFileIcon color="action" fontSize="small" sx={{ mr: 1 }} />
                        <ListItemText
                            primary={note.title}
                            secondary={note.updatedAt ? `Updated ${new Date(note.updatedAt).toLocaleString()}` : undefined}
                        />
                    </ListItemButton>
                ))}
                {renderTree(folder.children || [], depth + 1)}
            </Box>
        ));
    }

    return <>{renderTree(tree)}</>;
}