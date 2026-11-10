import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, isValid, parseISO } from 'date-fns';
import { NoteEditorToolbar } from './NoteEditorToolbar';
import { NotePreview } from './NotePreview';
import { NoteStyle } from '../../types/notes';
import { NoteFolderTree, NoteFolderType } from '../../types/notes';

type NoteEditorProps = {
    title: string;
    position: string;
    onPositionChange: (value: string) => void;
    content: string;
    style: NoteStyle;
    folderType: NoteFolderType;
    description: string;
    endDate: string;
    completed: boolean;
    onDescriptionChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
    onCompletedChange: (value: boolean) => void;
    canWrite: boolean;
    errorMessage: string;
    onTitleChange: (value: string) => void;
    onContentChange: (value: string) => void;
    onStyleChange: (style: NoteStyle) => void;
    tree?: NoteFolderTree[];
    selectedFolderID?: number | null;
    onFolderChange?: (id: number | null) => void;
};

export function NoteEditor({
    title,
    position,
    onPositionChange,
    content,
    style,
    folderType,
    description,
    endDate,
    completed,
    onDescriptionChange,
    onEndDateChange,
    onCompletedChange,
    canWrite,
    errorMessage,
    onTitleChange,
    onContentChange,
    onStyleChange,
    tree = [],
    selectedFolderID,
    onFolderChange,
}: NoteEditorProps) {

    function buildOptions(nodes: NoteFolderTree[], depth = 0, acc: { id: number; label: string }[] = []) {
        for (const node of nodes) {
            const prefix = depth > 0 ? '—'.repeat(depth) + ' ' : '';
            acc.push({ id: node.id, label: `${prefix}${node.name}` });
            if (node.children && node.children.length) buildOptions(node.children, depth + 1, acc);
        }
        return acc;
    }

    const folderOptions = buildOptions(tree || []);
    return (
        <Stack spacing={2}>
            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

            <TextField
                label={folderType === 'diary' ? 'Note title' : 'Title'}
                value={title}
                disabled={!canWrite}
                onChange={(e) => onTitleChange(e.target.value)}
            />

            <FormControl fullWidth>
                <InputLabel id="notes-folder-label">Folder</InputLabel>
                <Select
                    labelId="notes-folder-label"
                    label="Folder"
                    value={selectedFolderID ?? ''}
                    onChange={(e) => {
                        const val = e.target.value as number | string;
                        onFolderChange?.(val === '' ? null : Number(val));
                    }}
                    disabled={!canWrite}
                >
                    <MenuItem value="">(no folder)</MenuItem>
                    {folderOptions.map((opt) => (
                        <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
                    ))}
                </Select>
            </FormControl>

            <TextField
                label="Position"
                type="number"
                value={position}
                disabled={!canWrite}
                onChange={(e) => onPositionChange(e.target.value)}
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
                helperText="Lower positions appear first in this folder."
            />

            {folderType !== 'diary' && (
                <FormControlLabel
                    label={folderType === 'buy_list' ? 'Purchased' : 'Done'}
                    control={<Checkbox checked={completed} disabled={!canWrite} onChange={(e) => onCompletedChange(e.target.checked)} />}
                />
            )}

            {folderType === 'tasks_list' && (
                <>
                    <TextField
                        label="Description"
                        multiline
                        minRows={3}
                        value={description}
                        disabled={!canWrite}
                        onChange={(e) => onDescriptionChange(e.target.value)}
                    />
                    <DatePicker
                        label="End date (optional)"
                        value={endDate ? parseISO(endDate) : null}
                        disabled={!canWrite}
                        onChange={(date) => onEndDateChange(date ? (isValid(date) ? format(date, 'yyyy-MM-dd') : 'invalid') : '')}
                        slotProps={{ field: { clearable: true }, textField: { fullWidth: true } }}
                    />
                </>
            )}

            {folderType === 'diary' && (
                <>
                    <NoteEditorToolbar style={style} canWrite={canWrite} onStyleChange={onStyleChange} />
                    <TextField
                        label="Content"
                        multiline
                        minRows={12}
                        value={content}
                        disabled={!canWrite}
                        onChange={(e) => onContentChange(e.target.value)}
                        placeholder="Write your thoughts here. Multiline notes are fully supported."
                    />
                    <NotePreview content={content} style={style} />
                </>
            )}
        </Stack>
    );
}