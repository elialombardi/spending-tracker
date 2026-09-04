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
    isSaving: boolean;
    onClose: () => void;
    onChange: (value: string) => void;
    onSubmit: () => void;
};

export function FolderDialog({
    open,
    mode,
    folderName,
    isSaving,
    onClose,
    onChange,
    onSubmit,
}: FolderDialogProps) {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>{mode === 'create' ? 'Create folder' : 'Rename folder'}</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    fullWidth
                    margin="dense"
                    label="Folder name"
                    value={folderName}
                    onChange={(e) => onChange(e.target.value)}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={onSubmit}
                    disabled={!folderName.trim() || isSaving}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}