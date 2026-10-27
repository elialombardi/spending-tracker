import { useState } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import DeleteIcon from '@mui/icons-material/Delete';
import CircularProgress from '@mui/material/CircularProgress';
import { Tag } from '../../api/youtube/types';

type TagManagerProps = {
    tags: Tag[];
    onRenameTag?: (oldName: Tag, newName: string) => void;
    onDeleteTag?: (name: Tag) => void;
    onCreateTag?: (name: string) => void;
    loading: boolean;
    error?: string;
    onRefresh: () => void;
};

function TagManager({
    tags,
    onRenameTag,
    onDeleteTag,
    onCreateTag,
    loading,
    onRefresh
}: TagManagerProps) {
    const safeTags = Array.isArray(tags) ? tags : [];
    const [selectedTag, setSelectedTag] = useState<Tag | null>(safeTags[0] || null);
    const [newTagName, setNewTagName] = useState('');
    const [createInput, setCreateInput] = useState('');

    // intentionally do not auto-update selectedTag on every tags change
    // to avoid cascading renders; users can re-select as needed.

    function handleRename() {
        if (!selectedTag || !newTagName) return;
        onRenameTag && onRenameTag(selectedTag, newTagName);
        setSelectedTag({ name: newTagName } as Tag);
        setNewTagName('');
    }

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmPayload, setConfirmPayload] = useState(null);

    function handleDelete() {
        if (!selectedTag) return;
        setConfirmPayload({ type: 'tag', name: selectedTag?.name });
        setConfirmOpen(true);
    }

    function handleChangeTag(tagName: string) {
        const tag = safeTags.find(t => t.name === tagName) || null;
        setSelectedTag(tag);
    }

    if (loading) return <CircularProgress size={24} />;

    return (
        <Box>
            <Typography variant="h5" gutterBottom>Manage Tags</Typography>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="outlined" size="small" onClick={onRefresh}>Refresh</Button>
            </Box>

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                    <Paper sx={{ p: 2, mb: 2 }}>
                        <Typography variant="subtitle2">Select tag</Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Select
                                value={selectedTag?.name || ''}
                                onChange={(e) => handleChangeTag(e.target.value)}
                                displayEmpty size="small" sx={{ minWidth: 140 }}>
                                <MenuItem value="">--</MenuItem>
                                {safeTags.map((t) => <MenuItem key={t.name} value={t.name}>{t.name}</MenuItem>)}
                            </Select>
                            <TextField size="small" placeholder="New name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
                            <Button variant="contained" size="small" onClick={handleRename}>Rename</Button>
                            <Button variant="outlined" color="error" size="small" onClick={handleDelete} startIcon={<DeleteIcon />}>Delete</Button>
                        </Box>

                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2">Create new tag</Typography>
                            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                                <TextField size="small" placeholder="Tag name" value={createInput} onChange={(e) => setCreateInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (createInput) { onCreateTag && onCreateTag(createInput); setCreateInput(''); } } }} />
                                <Button variant="contained" size="small" onClick={() => { if (createInput) { onCreateTag && onCreateTag(createInput); setCreateInput(''); } }}>Add</Button>
                            </Box>
                        </Box>
                    </Paper>
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="subtitle1">Actions</Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>Select a tag to edit or delete it. Use the list to manage locations for the selected tag.</Typography>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}

export default TagManager;
