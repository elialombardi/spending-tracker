import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';

type NoteActionsProps = {
    canWrite: boolean;
    isSaving: boolean;
    hasTitle: boolean;
    hasSelectedNote: boolean;
    onSaveNote: () => void;
    onDeleteNote: () => void;
};

export function NoteActions({
    canWrite,
    isSaving,
    hasTitle,
    hasSelectedNote,
    onSaveNote,
    onDeleteNote,
}: NoteActionsProps) {
    return (
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
            <Button
                variant="contained"
                startIcon={<SaveRoundedIcon />}
                loading={isSaving}
                onClick={onSaveNote}
                disabled={!canWrite || isSaving || !hasTitle}
            >
                Save changes
            </Button>
            <Button
                variant="text"
                color="error"
                startIcon={<DeleteOutlineRoundedIcon />}
                onClick={onDeleteNote}
                disabled={!canWrite || isSaving || !hasSelectedNote}
            >
                Delete
            </Button>
        </Stack>
    );
}