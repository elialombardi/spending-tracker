import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import MenuItem from '@mui/material/MenuItem';
import { NoteStyle } from '../../types/notes';
import { backgroundOptions, colorOptions } from './types';

type NoteEditorToolbarProps = {
    style: NoteStyle;
    canWrite: boolean;
    onStyleChange: (style: NoteStyle) => void;
};

export function NoteEditorToolbar({ style, canWrite, onStyleChange }: NoteEditorToolbarProps) {
    const handleToggleChange = (_: React.MouseEvent<HTMLElement>, values: string[]) => {
        onStyleChange({
            ...style,
            bold: values.includes('bold'),
            italic: values.includes('italic'),
        });
    };

    return (
        <Stack sx={{ flexWrap: 'wrap', flexDirection: { xs: 'column', sm: 'row' }, spacing: 1.5, alignItems: { xs: 'stretch', sm: 'center' } }}>
            <ToggleButtonGroup
                value={[style.bold ? 'bold' : '', style.italic ? 'italic' : ''].filter(Boolean)}
                onChange={handleToggleChange}
                size="small"
                exclusive={false}
                disabled={!canWrite}
            >
                <ToggleButton value="bold" sx={{ fontWeight: 700 }}>B</ToggleButton>
                <ToggleButton value="italic" sx={{ fontStyle: 'italic' }}>I</ToggleButton>
            </ToggleButtonGroup>

            <TextField
                select
                size="small"
                label="Text color"
                value={style.textColor}
                disabled={!canWrite}
                onChange={(e) => onStyleChange({ ...style, textColor: e.target.value })}
                sx={{ minWidth: 150 }}
            >
                {colorOptions.map((color) => (
                    <MenuItem key={color} value={color}>{color}</MenuItem>
                ))}
            </TextField>

            <TextField
                select
                size="small"
                label="Background"
                value={style.backgroundColor}
                disabled={!canWrite}
                onChange={(e) => onStyleChange({ ...style, backgroundColor: e.target.value })}
                sx={{ minWidth: 150 }}
            >
                {backgroundOptions.map((color) => (
                    <MenuItem key={color} value={color}>{color}</MenuItem>
                ))}
            </TextField>

            <TextField
                select
                size="small"
                label="Font size"
                value={style.fontSize}
                disabled={!canWrite}
                onChange={(e) => onStyleChange({ ...style, fontSize: Number(e.target.value) })}
                sx={{ minWidth: 120 }}
            >
                {[14, 16, 18, 20, 24].map((fontSize) => (
                    <MenuItem key={fontSize} value={fontSize}>{fontSize}px</MenuItem>
                ))}
            </TextField>
        </Stack>
    );
}