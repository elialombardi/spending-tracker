import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Card,
    CardContent,
    CardMedia,
    Chip,
    IconButton,
    Tooltip,
    Button,
    Menu,
    MenuItem,
    Checkbox,
    ListItemText,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Alert,
    TextField,
    InputAdornment,
} from '@mui/material';
import {
    MoreVert as MoreVertIcon,
    Tag as TagIcon,
    Sync as SyncIcon,
    Search as SearchIcon,
    FilterList as FilterListIcon,
} from '@mui/icons-material';
import { YoutubeChannel, Tag } from '../../api/youtube/types';
import { useAddTagsToChannelMutation, useRemoveTagsFromChannelMutation, useSyncChannelMutation } from '../../api/youtube/endpoints';

interface ChannelListProps {
    channels: YoutubeChannel[];
    loading: boolean;
    error: any;
    tags: Tag[];
    onRefresh: () => void;
}

export function ChannelList({ channels, loading, error, tags, onRefresh }: ChannelListProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedChannel, setSelectedChannel] = useState<YoutubeChannel | null>(null);
    const [tagDialogOpen, setTagDialogOpen] = useState(false);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false,
        message: '',
        severity: 'success',
    });

    const [addTags] = useAddTagsToChannelMutation();
    const [removeTags] = useRemoveTagsFromChannelMutation();
    const [syncChannel] = useSyncChannelMutation();

    const filteredChannels = channels.filter(channel =>
        channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        channel.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOpenTagDialog = (channel: YoutubeChannel) => {
        setSelectedChannel(channel);
        setSelectedTags(channel.tags.map(t => t.id));
        setTagDialogOpen(true);
        setAnchorEl(null);
    };

    const handleSaveTags = async () => {
        if (!selectedChannel) return;

        try {
            const currentTagIds = selectedChannel.tags.map(t => t.id);

            // Add new tags
            const tagsToAdd = selectedTags.filter(id => !currentTagIds.includes(id));
            if (tagsToAdd.length > 0) {
                await addTags({ channelId: selectedChannel.id, tagIds: tagsToAdd }).unwrap();
            }

            // Remove tags
            const tagsToRemove = currentTagIds.filter(id => !selectedTags.includes(id));
            if (tagsToRemove.length > 0) {
                await removeTags({ channelId: selectedChannel.id, tagIds: tagsToRemove }).unwrap();
            }

            setSnackbar({
                open: true,
                message: 'Tags updated successfully',
                severity: 'success',
            });
            setTagDialogOpen(false);
            onRefresh();
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Failed to update tags',
                severity: 'error',
            });
        }
    };

    const handleSyncChannel = async (channelId: string) => {
        try {
            await syncChannel(channelId).unwrap();
            setSnackbar({
                open: true,
                message: 'Sync started for channel',
                severity: 'success',
            });
            onRefresh();
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Failed to start sync',
                severity: 'error',
            });
        }
        setAnchorEl(null);
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
                Failed to load channels. Please try again.
            </Alert>
        );
    }

    return (
        <Box>
            {/* Search Bar */}
            <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
                <TextField
                    placeholder="Search channels..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }
                    }}
                    sx={{ flex: 1 }}
                />
                <Button
                    variant="outlined"
                    startIcon={<FilterListIcon />}
                    onClick={() => { }}
                >
                    Filters
                </Button>
            </Box>

            {/* Channel Grid */}
            <Grid container spacing={3}>
                {filteredChannels.map((channel) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={channel.id}>
                        <Card>
                            <Box sx={{ position: 'relative' }}>
                                <CardMedia
                                    component="img"
                                    height="140"
                                    image={channel.thumbnail || `https://picsum.photos/seed/${channel.id}/300/140`}
                                    alt={channel.name}
                                />
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                    }}
                                >
                                    <IconButton
                                        size="small"
                                        sx={{ bgcolor: 'rgba(255,255,255,0.8)' }}
                                        onClick={(e) => {
                                            setSelectedChannel(channel);
                                            setAnchorEl(e.currentTarget);
                                        }}
                                    >
                                        <MoreVertIcon />
                                    </IconButton>
                                </Box>
                            </Box>
                            <CardContent>
                                <Typography variant="h6" gutterBottom noWrap>
                                    {channel.name}
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }} noWrap>
                                    {channel.description || 'No description'}
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                                    {channel.tags.length > 0 ? (
                                        channel.tags.map((tag) => (
                                            <Chip
                                                key={tag.id}
                                                label={tag.name}
                                                size="small"
                                                sx={{
                                                    bgcolor: tag.color || '#e0e0e0',
                                                    color: '#fff',
                                                }}
                                            />
                                        ))
                                    ) : (
                                        <Typography variant="caption" color="textSecondary">
                                            No tags
                                        </Typography>
                                    )}
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="caption" color="textSecondary">
                                        {channel.subscriberCount?.toLocaleString() || '0'} subscribers
                                    </Typography>
                                    <Tooltip title="Add tags">
                                        <IconButton size="small" onClick={() => handleOpenTagDialog(channel)}>
                                            <TagIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Context Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
            >
                <MenuItem onClick={() => selectedChannel && handleOpenTagDialog(selectedChannel)}>
                    <TagIcon sx={{ mr: 1 }} /> Manage Tags
                </MenuItem>
                <MenuItem onClick={() => selectedChannel && handleSyncChannel(selectedChannel.id)}>
                    <SyncIcon sx={{ mr: 1 }} /> Sync Now
                </MenuItem>
            </Menu>

            {/* Tag Management Dialog */}
            <Dialog open={tagDialogOpen} onClose={() => setTagDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    Manage Tags for {selectedChannel?.name}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                            Select tags for this channel
                        </Typography>
                        {tags.length === 0 ? (
                            <Typography variant="body2" color="textSecondary">
                                No tags available. Create tags in the Tags tab.
                            </Typography>
                        ) : (
                            tags.map((tag) => (
                                <Box key={tag.id} sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}>
                                    <Checkbox
                                        checked={selectedTags.includes(tag.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedTags([...selectedTags, tag.id]);
                                            } else {
                                                setSelectedTags(selectedTags.filter(id => id !== tag.id));
                                            }
                                        }}
                                    />
                                    <Chip
                                        label={tag.name}
                                        size="small"
                                        sx={{
                                            bgcolor: tag.color || '#e0e0e0',
                                            color: '#fff',
                                        }}
                                    />
                                    {tag.description && (
                                        <Typography variant="caption" color="textSecondary" sx={{ ml: 1 }}>
                                            {tag.description}
                                        </Typography>
                                    )}
                                </Box>
                            ))
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTagDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveTags} variant="contained" disabled={tags.length === 0}>
                        Save Tags
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}