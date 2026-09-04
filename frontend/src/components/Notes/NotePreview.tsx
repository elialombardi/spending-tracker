import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { NoteStyle } from '../../types/notes';

type NotePreviewProps = {
    content: string;
    style: NoteStyle;
};

export function NotePreview({ content, style }: NotePreviewProps) {
    return (
        <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Live preview</Typography>
            <Paper
                variant="outlined"
                sx={{
                    p: 2,
                    minHeight: 140,
                    whiteSpace: 'pre-wrap',
                    color: style.textColor,
                    backgroundColor: style.backgroundColor,
                    fontWeight: style.bold ? 700 : 400,
                    fontStyle: style.italic ? 'italic' : 'normal',
                    fontSize: `${style.fontSize}px`,
                }}
            >
                {content || 'Your styled note preview appears here.'}
            </Paper>
        </Box>
    );
}