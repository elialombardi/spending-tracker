import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import MenuItem from '@mui/material/MenuItem';
import { folderTypeLabels, isNoteFolderType, NoteFolderType } from '../../types/notes';

type FolderDialogProps = {
    open: boolean;
    mode: 'create' | 'rename';
    folderName: string;
    folderType: NoteFolderType;
    onTypeChange: (value: NoteFolderType) => void;
    errorMessage: string;
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
    folderType,
    onTypeChange,
    errorMessage,
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
                {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
                <TextField
                    autoFocus
                    fullWidth
                    margin="dense"
                    label="Folder name"
                    value={folderName}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={isSaving}
                />
                <TextField
                    select
                    fullWidth
                    margin="dense"
                    label="Folder type"
                    value={folderType}
                    disabled={isSaving}
                    onChange={(e) => {
                        if (isNoteFolderType(e.target.value)) onTypeChange(e.target.value);
                    }}
                    helperText="Changing type preserves hidden note fields. Child folders keep their own type."
                >
                    {Object.entries(folderTypeLabels).map(([value, label]) => (
                        <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                </TextField>
                <TextField
                    fullWidth
                    margin="dense"
                    label="Position"
                    type="number"
                    value={position}
                    disabled={isSaving}
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