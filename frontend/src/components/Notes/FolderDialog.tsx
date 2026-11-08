import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

type FolderDialogProps = {
    open: boolean;
    mode: 'create' | 'rename';
    folderName: string;
    position: string;
    onPositionChange: (value: string) => void;
    isSaving: boolean;
    onClose: () => void;
    onChange: (value: string) => void;
    onSubmit: () => void;
};

export function FolderDialog({
    open,
    mode,
    folderName,
    position,
    onPositionChange,
    isSaving,
    onClose,
    onChange,
    onSubmit,
}: FolderDialogProps) {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>{mode === 'create' ? 'Create folder' : 'Edit folder'}</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    fullWidth
                    margin="dense"
                    label="Folder name"
                    value={folderName}
                    onChange={(e) => onChange(e.target.value)}
                />
                <TextField
                    fullWidth
                    margin="dense"
                    label="Position"
                    type="number"
                    value={position}
                    onChange={(e) => onPositionChange(e.target.value)}
                    slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    helperText="Lower positions appear first among sibling folders."
                    error={!position.trim() || !Number.isSafeInteger(Number(position)) || Number(position) < 0}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={onSubmit}
                    disabled={!folderName.trim() || !position.trim() || !Number.isSafeInteger(Number(position)) || Number(position) < 0 || isSaving}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}