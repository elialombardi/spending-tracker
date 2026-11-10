import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import NoteAddIcon from '@mui/icons-material/NoteAdd';

type NoteActionsProps = {
    canWrite: boolean;
    isSaving: boolean;
    hasTitle: boolean;
    hasSelectedNote: boolean;
    isList: boolean;
    onNewNote: () => void;
    onSaveNote: () => void;
    onDeleteNote: () => void;
};

export function NoteActions({
    canWrite,
    isSaving,
    hasTitle,
    hasSelectedNote,
    isList,
    onNewNote,
    onSaveNote,
    onDeleteNote,
}: NoteActionsProps) {
    return (
        <Stack direction="row" spacing={1}>
            <Button
                variant="outlined"
                startIcon={<NoteAddIcon />}
                onClick={onNewNote}
                disabled={!canWrite || isSaving}
            >
                {isList ? 'New item' : 'New note'}
            </Button>
            <Button
                variant="contained"
                onClick={onSaveNote}
                disabled={!canWrite || isSaving || !hasTitle}
            >
                {isList ? 'Save item' : 'Save note'}
            </Button>
            <Button
                variant="text"
                color="error"
                onClick={onDeleteNote}
                disabled={!canWrite || isSaving || !hasSelectedNote}
            >
                Delete
            </Button>
        </Stack>
    );
}