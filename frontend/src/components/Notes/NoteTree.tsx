import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { alpha } from '@mui/material/styles';
import { NoteFolderTree } from '../../types/notes';
import { folderTypeAppearance } from './types';

type NoteTreeProps = {
    tree: NoteFolderTree[];
    selectedFolderID: number | null;
    onSelectFolder: (folderId: number) => void;
};

export function NoteTree({ tree, selectedFolderID, onSelectFolder }: NoteTreeProps) {
    function renderTree(nodes: NoteFolderTree[]): ReactNode {
        return nodes.map((folder) => {
            const { icon: FolderTypeIcon, color } = folderTypeAppearance[folder.type];
            const selected = selectedFolderID === folder.id;
            return (
            <Box component="li" key={folder.id} sx={{ listStyle: 'none' }}>
                <ListItemButton
                    selected={selected}
                    aria-current={selected ? 'page' : undefined}
                    sx={(theme) => ({
                        gap: 1.25, px: 1.25, py: 1, mb: 0.5, minHeight: 52,
                        borderRadius: '12px', border: '1px solid', borderColor: 'transparent',
                        transition: theme.transitions.create(['background-color', 'border-color']),
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                        '&.Mui-selected': {
                            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.07),
                            borderColor: alpha(theme.palette.primary.main, 0.18),
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.12) },
                        },
                        '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                    })}
                    onClick={() => onSelectFolder(folder.id)}
                >
                    <Box sx={(theme) => ({
                        width: 36, height: 36, flexShrink: 0, borderRadius: '10px',
                        display: 'grid', placeItems: 'center', color: theme.palette[color][theme.palette.mode === 'dark' ? 'light' : 'main'],
                        bgcolor: alpha(theme.palette[color].main, 0.12),
                    })}>
                        <FolderTypeIcon sx={{ fontSize: 20 }} />
                    </Box>
                    <ListItemText
                        primary={folder.name}
                        sx={{ minWidth: 0, my: 0 }}
                        slotProps={{
                            primary: { variant: 'body2', noWrap: true, title: folder.name, sx: { fontWeight: selected ? 600 : 400 } },
                        }}
                    />
                    <Box component="span" aria-label={`${folder.notes.length} ${folder.notes.length === 1 ? 'item' : 'items'}`} sx={{
                        typography: 'caption',
                        flexShrink: 0, minWidth: 24, px: 0.75, py: 0.25, textAlign: 'center',
                        borderRadius: '7px', fontWeight: 600,
                        bgcolor: selected ? 'primary.main' : 'action.hover',
                        color: selected ? 'primary.contrastText' : 'text.secondary',
                    }}>
                        {folder.notes.length}
                    </Box>
                </ListItemButton>
                {folder.children?.length > 0 && (
                    <Box component="ul" sx={{ m: 0, ml: 2, pl: 1, borderLeft: '1px solid', borderColor: 'divider' }}>
                        {renderTree(folder.children)}
                    </Box>
                )}
            </Box>
            );
        });
    }

    return <>{renderTree(tree)}</>;
}