import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    IconButton,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Alert,
    Chip,
    Grid,
    Tooltip,
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    ColorLens as ColorIcon,
} from '@mui/icons-material';
import { Tag, CreateTagRequest, UpdateTagRequest } from '../../api/youtube/types';
import { useCreateTagMutation, useUpdateTagMutation, useDeleteTagMutation } from '../../api/youtube/endpoints';

interface TagManagerProps {
    tags: Tag[];
    loading: boolean;
    error: any;
    onRefresh: () => void;
}

export function TagManager({ tags, loading, error, onRefresh }: TagManagerProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTag, setEditingTag] = useState<Tag | null>(null);
    const [formData, setFormData] = useState<CreateTagRequest>({
        name: '',
        description: '',
        color: '#1976d2',
    });
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false,
        message: '',
        severity: 'success',
    });

    const [createTag] = useCreateTagMutation();
    const [updateTag] = useUpdateTagMutation();
    const [deleteTag] = useDeleteTagMutation();

    const handleOpenCreateDialog = () => {
        setEditingTag(null);
        setFormData({ name: '', description: '', color: '#1976d2' });
        setDialogOpen(true);
    };

    const handleOpenEditDialog = (tag: Tag) => {
        setEditingTag(tag);
        setFormData({
            name: tag.name,
            description: tag.description || '',
            color: tag.color || '#1976d2',
        });
        setDialogOpen(true);
    };

    const handleSaveTag = async () => {
        try {
            if (editingTag) {
                await updateTag({ id: editingTag.id, data: formData }).unwrap();
                setSnackbar({ open: true, message: 'Tag updated successfully', severity: 'success' });
            } else {
                await createTag(formData).unwrap();
                setSnackbar({ open: true, message: 'Tag created successfully', severity: 'success' });
            }
            setDialogOpen(false);
            onRefresh();
        } catch (error) {
            setSnackbar({
                open: true,
                message: `Failed to ${editingTag ? 'update' : 'create'} tag`,
                severity: 'error',
            });
        }
    };

    const handleDeleteTag = async () => {
        if (!tagToDelete) return;

        try {
            await deleteTag(tagToDelete.id).unwrap();
            setSnackbar({ open: true, message: 'Tag deleted successfully', severity: 'success' });
            setDeleteDialogOpen(false);
            setTagToDelete(null);
            onRefresh();
        } catch (error) {
            setSnackbar({ open: true, message: 'Failed to delete tag', severity: 'error' });
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                Failed to load tags. Please try again.
            </Alert>
        );
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                    Tags ({tags.length})
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleOpenCreateDialog}
                >
                    Create Tag
                </Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Color</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell align="center">Channels</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {tags.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    <Typography variant="body2" color="textSecondary" sx={{ py: 4 }}>
                                        No tags created yet. Click "Create Tag" to get started.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            tags.map((tag) => (
                                <TableRow key={tag.id}>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Chip
                                                label={tag.name}
                                                size="small"
                                                sx={{
                                                    bgcolor: tag.color || '#e0e0e0',
                                                    color: '#fff',
                                                }}
                                            />
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <ColorIcon sx={{ color: tag.color || '#e0e0e0' }} />
                                            <Typography variant="caption">{tag.color || '#e0e0e0'}</Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>{tag.description || '-'}</TableCell>
                                    <TableCell align="center">{tag.channelCount || 0}</TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Edit">
                                            <IconButton size="small" onClick={() => handleOpenEditDialog(tag)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => {
                                                    setTagToDelete(tag);
                                                    setDeleteDialogOpen(true);
                                                }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingTag ? 'Edit Tag' : 'Create New Tag'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                        <TextField
                            label="Tag Name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            fullWidth
                        />
                        <TextField
                            label="Description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            multiline
                            rows={2}
                            fullWidth
                        />
                        <Box>
                            <Typography variant="subtitle2" gutterBottom>
                                Color
                            </Typography>
                            <TextField
                                type="color"
                                value={formData.color}
                                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                sx={{ width: 64 }}
                            />
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveTag} variant="contained" disabled={!formData.name}>
                        {editingTag ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Delete Tag</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete the tag "{tagToDelete?.name}"? This will remove it from all channels.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleDeleteTag} variant="contained" color="error">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}