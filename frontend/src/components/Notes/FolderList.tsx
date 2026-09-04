import List from '@mui/material/List';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import { NoteTree } from './NoteTree';
import { Note, NoteFolderTree } from '../../types/notes';

type FolderListProps = {
    tree: NoteFolderTree[];
    isLoading: boolean;
    selectedFolderID: number | null;
    selectedNoteID: number | null;
    onSelectFolder: (folderId: number) => void;
    onSelectNote: (note: Note, folderId: number) => void;
};

export function FolderList({
    tree,
    isLoading,
    selectedFolderID,
    selectedNoteID,
    onSelectFolder,
    onSelectNote,
}: FolderListProps) {
    if (isLoading) {
        return (
            <Stack sx={{ alignItems: 'center', py: 6 }}>
                <CircularProgress size={26} />
            </Stack>
        );
    }

    return (
        <List dense disablePadding>
            <NoteTree
                tree={tree}
                selectedFolderID={selectedFolderID}
                selectedNoteID={selectedNoteID}
                onSelectFolder={onSelectFolder}
                onSelectNote={onSelectNote}
            />
        </List>
    );
}