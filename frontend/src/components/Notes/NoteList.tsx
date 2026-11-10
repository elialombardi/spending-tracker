import Checkbox from '@mui/material/Checkbox';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { Note, NoteFolderTree } from '../../types/notes';
import { folderTypeAppearance } from './types';

type NoteListProps = {
    folder: NoteFolderTree;
    selectedNoteID: number | null;
    canWrite: boolean;
    isBusy: boolean;
    onSelectNote: (note: Note) => void;
    onToggleCompleted: (note: Note) => void;
};

export function NoteList({ folder, selectedNoteID, canWrite, isBusy, onSelectNote, onToggleCompleted }: NoteListProps) {
    const { icon: FolderTypeIcon, color } = folderTypeAppearance[folder.type];
    if (folder.notes.length === 0) {
        return (
            <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center', py: 6, px: 2, border: '1px dashed', borderColor: 'divider', borderRadius: '16px' }}>
                <Box sx={(theme) => ({
                    display: 'grid', placeItems: 'center', width: 56, height: 56, mb: 1,
                    borderRadius: '18px', bgcolor: alpha(theme.palette[color].main, 0.1), color: theme.palette[color][theme.palette.mode === 'dark' ? 'light' : 'main'],
                })}>
                    <FolderTypeIcon />
                </Box>
                <Typography role="status" sx={{ fontWeight: 700 }}>
                    {folder.type === 'diary' ? 'No notes in this folder.' : 'No items in this folder.'}
                </Typography>
                <Typography color="text.secondary" variant="body2">A clean slate for whatever comes next.</Typography>
            </Stack>
        );
    }

    return (
        <List disablePadding aria-label="Folder items">
            {folder.notes.map((note) => (
                <ListItem key={note.id} disablePadding sx={(theme) => ({
                    mb: 1, border: '1px solid', borderRadius: '14px', overflow: 'hidden',
                    borderColor: selectedNoteID === note.id ? alpha(theme.palette.primary.main, 0.3) : 'divider',
                    bgcolor: 'background.default',
                    transition: theme.transitions.create(['border-color', 'box-shadow']),
                    '&:last-child': { mb: 0 },
                    '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.3), boxShadow: `0 3px 12px ${alpha(theme.palette.text.primary, 0.04)}` },
                })}>
                    {folder.type !== 'diary' && (
                        <ListItemIcon sx={{ minWidth: 44, pl: 1 }}>
                            <Checkbox
                                checked={note.completed}
                                disabled={!canWrite || isBusy}
                                onChange={() => onToggleCompleted(note)}
                                slotProps={{ input: { 'aria-label': `${folder.type === 'buy_list' ? 'Purchased' : 'Done'}: ${note.title}` } }}
                            />
                        </ListItemIcon>
                    )}
                    <ListItemButton
                        selected={selectedNoteID === note.id}
                        disabled={isBusy}
                        onClick={() => onSelectNote(note)}
                        sx={(theme) => ({
                            gap: 1.5, py: 1.75, minHeight: 72,
                            '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                            '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
                        })}
                    >
                        {folder.type === 'diary' && (
                            <Box sx={(theme) => ({
                                display: 'grid', placeItems: 'center', width: 40, height: 40, flexShrink: 0,
                                borderRadius: '12px', bgcolor: alpha(theme.palette[color].main, 0.1), color: theme.palette[color][theme.palette.mode === 'dark' ? 'light' : 'main'],
                            })}>
                                <FolderTypeIcon fontSize="small" />
                            </Box>
                        )}
                        <ListItemText
                            primary={note.title}
                            sx={{ my: 0 }}
                            slotProps={{
                                primary: { sx: { fontWeight: 650, fontSize: '0.95rem', textDecoration: folder.type !== 'diary' && note.completed ? 'line-through' : 'none', overflowWrap: 'anywhere' } },
                                secondary: { sx: { mt: 0.5, fontSize: '0.8rem', overflowWrap: 'anywhere' } },
                            }}
                            secondary={folder.type === 'diary'
                                ? (note.updatedAt ? `Updated ${new Date(note.updatedAt).toLocaleString()}` : undefined)
                                : folder.type === 'tasks_list' && note.endDate ? `End date: ${note.endDate}` : undefined}
                        />
                        <ArrowForwardRoundedIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
                    </ListItemButton>
                </ListItem>
            ))}
        </List>
    );
}
