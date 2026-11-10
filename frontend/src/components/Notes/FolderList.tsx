import List from '@mui/material/List';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { NoteTree } from './NoteTree';
import { NoteFolderTree } from '../../types/notes';

type FolderListProps = {
    tree: NoteFolderTree[];
    isLoading: boolean;
    selectedFolderID: number | null;
    onSelectFolder: (folderId: number) => void;
};

export function FolderList({
    tree,
    isLoading,
    selectedFolderID,
    onSelectFolder,
}: FolderListProps) {
    if (isLoading) {
        return (
            <Stack sx={{ alignItems: 'center', py: 6 }}>
                <CircularProgress size={26} />
            </Stack>
        );
    }

    if (tree.length === 0) {
        return (
            <Typography role="status" color="text.secondary" sx={{ p: 3, textAlign: 'center', fontSize: '0.85rem' }}>
                No folders yet. Your next idea starts here.
            </Typography>
        );
    }

    return (
        <List dense aria-label="Folders" sx={{ p: 1.5 }}>
            <NoteTree
                tree={tree}
                selectedFolderID={selectedFolderID}
                onSelectFolder={onSelectFolder}
            />
        </List>
    );
}