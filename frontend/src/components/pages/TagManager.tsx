import { useState } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteIcon from '@mui/icons-material/Delete';
import TagMultiSelect from '../TagMultiSelect';

interface Props {
    canWrite?: boolean
    tags?: string[]
    locations?: any[]
    onRenameTag?: (oldTag: string, newTag: string) => void
    onDeleteTag?: (tag: string) => void
    onCreateTag?: (tag: string) => void
    onToggleLocationTag?: (locId: number, tag: string, present: boolean) => void
    onUpdateLocation?: (locId: number, updated: any) => void
    onDeleteLocation?: (locId: number) => void
}

export default function TagManager({ canWrite, tags, locations, onRenameTag, onDeleteTag, onCreateTag, onToggleLocationTag, onUpdateLocation, onDeleteLocation }: Props) {
    const safeTags = Array.isArray(tags) ? tags : [];
    const safeLocations = Array.isArray(locations) ? locations : [];
    const [selectedTag, setSelectedTag] = useState<string>(safeTags[0] || '');
    const [newTagName, setNewTagName] = useState('');
    const [createInput, setCreateInput] = useState('');

    function handleRename() {
        if (!selectedTag || !newTagName) return;
        onRenameTag && onRenameTag(selectedTag, newTagName);
        setSelectedTag(newTagName);
        setNewTagName('');
    }

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmPayload, setConfirmPayload] = useState<any>(null);

    function handleDelete() {
        if (!selectedTag) return;
        setConfirmPayload({ type: 'tag', name: selectedTag });
        setConfirmOpen(true);
    }

    const [editingLoc, setEditingLoc] = useState<any>(null);
    const [editValues, setEditValues] = useState<any>({});

    const beginEdit = (loc: any) => {
        setEditingLoc(loc);
        setEditValues({
            title: loc.title || '',
            tags: loc.tags || [],
            lat: loc.lat || '',
            lng: loc.lng || '',
            description: loc.description || '',
            url: loc.url || '',
        });
    };

    const cancelEdit = () => {
        setEditingLoc(null);
        setEditValues({});
    };

    const saveEdit = () => {
        if (!editingLoc) return;
        const updated = {
            ...editingLoc,
            title: editValues.title,
            tags: Array.isArray(editValues.tags) ? editValues.tags : (String(editValues.tags || '').split(',').map((s: string) => s.trim()).filter(Boolean)),
            lat: parseFloat(editValues.lat),
            lng: parseFloat(editValues.lng),
            description: editValues.description,
            url: editValues.url || '',
        };
        onUpdateLocation && onUpdateLocation(editingLoc.id, updated);
        cancelEdit();
    };

    return (
        <Box>
            <Typography variant="h5" gutterBottom>Manage Tags</Typography>

            <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 2, mb: 2 }}>
                        <Typography variant="subtitle2">Select tag</Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Select value={selectedTag} onChange={(e) => setSelectedTag((e.target as any).value)} displayEmpty size="small" sx={{ minWidth: 140 }}>
                                <MenuItem value="">--</MenuItem>
                                {safeTags.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                            </Select>
                            {canWrite ? (
                                <>
                                    <TextField size="small" placeholder="New name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
                                    <Button variant="contained" size="small" onClick={handleRename}>Rename</Button>
                                    <Button variant="outlined" color="error" size="small" onClick={handleDelete} startIcon={<DeleteIcon />}>Delete</Button>
                                </>
                            ) : null}
                        </Box>

                        {canWrite ? (
                            <Box sx={{ mt: 2 }}>
                                <Typography variant="subtitle2">Create new tag</Typography>
                                <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                                    <TextField size="small" placeholder="Tag name" value={createInput} onChange={(e) => setCreateInput(e.target.value)} onKeyDown={(e) => { if ((e as any).key === 'Enter') { e.preventDefault(); if (createInput) { onCreateTag && onCreateTag(createInput); setCreateInput(''); } } }} />
                                    <Button variant="contained" size="small" onClick={() => { if (createInput) { onCreateTag && onCreateTag(createInput); setCreateInput(''); } }}>Add</Button>
                                </Box>
                            </Box>
                        ) : null}
                    </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>Locations with tag: {selectedTag || '—'}</Typography>
                    <Paper>
                        {selectedTag ? (
                            <List>
                                {safeLocations.map((loc) => (
                                    <ListItem key={loc.id} divider>
                                        <Checkbox edge="start" checked={Array.isArray(loc.tags) ? loc.tags.includes(selectedTag) : false} disabled={!canWrite} onChange={(e) => onToggleLocationTag && onToggleLocationTag(loc.id, selectedTag, (e.target as any).checked)} />
                                        <ListItemText
                                            primary={loc.title || loc.name || `#${loc.id}`}
                                            secondary={
                                                <span>{loc.description}</span>
                                            }
                                            sx={{ ml: 1 }}
                                        />
                                        <ListItemSecondaryAction>
                                            {canWrite ? (
                                                <>
                                                    {loc.url && <IconButton
                                                        edge="end"
                                                        component="a"
                                                        href={loc.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        aria-label="open"
                                                    >
                                                        <OpenInNewIcon />
                                                    </IconButton>}
                                                    <IconButton edge="end" onClick={() => beginEdit(loc)} aria-label="edit"><EditIcon /></IconButton>
                                                    <IconButton
                                                        edge="end"
                                                        onClick={() => {
                                                            const title = loc.title || loc.name || `#${loc.id}`;
                                                            setConfirmPayload({ type: 'location', id: loc.id, name: title });
                                                            setConfirmOpen(true);
                                                        }}
                                                        aria-label="delete"
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </>
                                            ) : null}
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Box sx={{ p: 2 }}>No tag selected.</Box>
                        )}
                    </Paper>
                </Grid>

                <Grid item xs={12} md={3}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="subtitle1">Actions</Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>Select a tag to edit or delete it. Use the list to manage locations for the selected tag.</Typography>
                    </Paper>
                </Grid>
            </Grid>

            <Drawer anchor="bottom" open={confirmOpen} onClose={() => setConfirmOpen(false)}>
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6">Confirm delete</Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>{confirmPayload?.type === 'tag' ? `Delete tag "${confirmPayload?.name}"? This will remove it from all locations.` : `Delete location "${confirmPayload?.name}"? This cannot be undone.`}</Typography>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Button onClick={() => { setConfirmOpen(false); setConfirmPayload(null); }}>Cancel</Button>
                        <Button
                            variant="contained"
                            color="error"
                            onClick={() => {
                                if (!confirmPayload) return;
                                if (confirmPayload.type === 'tag') {
                                    onDeleteTag && onDeleteTag(confirmPayload.name);
                                    const idx = safeTags.indexOf(confirmPayload.name);
                                    const next = safeTags[idx + 1] || safeTags[idx - 1] || '';
                                    setSelectedTag(next);
                                } else if (confirmPayload.type === 'location') {
                                    onDeleteLocation && onDeleteLocation(confirmPayload.id);
                                }
                                setConfirmOpen(false);
                                setConfirmPayload(null);
                            }}
                        >Delete</Button>
                    </Box>
                </Box>
            </Drawer>

            <Dialog open={!!editingLoc} onClose={cancelEdit} fullWidth maxWidth="sm">
                <DialogTitle>Edit location</DialogTitle>
                <DialogContent>
                    <Grid container spacing={1} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} md={6}>
                            <TextField fullWidth label="Title" size="small" value={editValues.title || ''} onChange={(e) => setEditValues((v: any) => ({ ...v, title: e.target.value }))} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TagMultiSelect options={safeTags} value={editValues.tags || []} onChange={(arr) => setEditValues((v: any) => ({ ...v, tags: arr }))} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField fullWidth label="Latitude" size="small" value={editValues.lat || ''} onChange={(e) => setEditValues((v: any) => ({ ...v, lat: e.target.value }))} />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField fullWidth label="Longitude" size="small" value={editValues.lng || ''} onChange={(e) => setEditValues((v: any) => ({ ...v, lng: e.target.value }))} />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth label="Description" size="small" multiline minRows={2} value={editValues.description || ''} onChange={(e) => setEditValues((v: any) => ({ ...v, description: e.target.value }))} />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth label="URL" size="small" value={editValues.url || ''} onChange={(e) => setEditValues((v: any) => ({ ...v, url: e.target.value }))} placeholder="https://example.com" />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={cancelEdit}>Cancel</Button>
                    <Button variant="contained" onClick={saveEdit}>Save</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
