import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { NoteEditorToolbar } from './NoteEditorToolbar';
import { NotePreview } from './NotePreview';
import { NoteStyle } from '../../types/notes';
import { NoteFolderTree } from '../../types/notes';

type NoteEditorProps = {
    title: string;
    content: string;
    style: NoteStyle;
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
    content,
    style,
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
                label="Note title"
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
                        onFolderChange && onFolderChange(val === '' ? null : Number(val));
                    }}
                    disabled={!canWrite}
                >
                    <MenuItem value="">(no folder)</MenuItem>
                    {folderOptions.map((opt) => (
                        <MenuItem key={opt.id} value={opt.id}>{opt.label}</MenuItem>
                    ))}
                </Select>
            </FormControl>

            <NoteEditorToolbar
                style={style}
                canWrite={canWrite}
                onStyleChange={onStyleChange}
            />

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
        </Stack>
    );
}