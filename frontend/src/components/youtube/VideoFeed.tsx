import React, { useState } from 'react';
import {
    Box,
    Grid,
    Card,
    CardContent,
    CardMedia,
    Typography,
    Chip,
    CircularProgress,
    Alert,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    IconButton,
    Tooltip,
    Button,
    SelectChangeEvent,
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    PlayArrow as PlayIcon,
} from '@mui/icons-material';
import { Video, Tag } from '../../api/youtube/types';
import { useGetVideosForTagQuery } from '../../api/youtube/endpoints';

interface VideoFeedProps {
    videos: Video[];
    loading: boolean;
    error: any;
    tags: Tag[];
    onRefresh: () => void;
}

export function VideoFeed({ videos, loading, error, tags, onRefresh }: VideoFeedProps) {
    const [selectedTagId, setSelectedTagId] = useState<string>('');

    // If a tag is selected, fetch videos for that tag
    const { data: tagVideos, isFetching: tagVideosLoading } = useGetVideosForTagQuery(
        { tagId: selectedTagId, limit: 20 },
        { skip: !selectedTagId }
    );

    const displayVideos = selectedTagId ? (tagVideos || []) : videos;

    const handleTagChange = (event: SelectChangeEvent) => {
        setSelectedTagId(event.target.value as string);
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
                Failed to load videos. Please try again.
            </Alert>
        );
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
                <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel>Filter by Tag</InputLabel>
                    <Select
                        value={selectedTagId}
                        onChange={handleTagChange}
                        label="Filter by Tag"
                    >
                        <MenuItem value="">All Videos</MenuItem>
                        {tags.map((tag) => (
                            <MenuItem key={tag.id} value={tag.id}>
                                <Chip
                                    label={tag.name}
                                    size="small"
                                    sx={{
                                        bgcolor: tag.color || '#e0e0e0',
                                        color: '#fff',
                                        mr: 1,
                                    }}
                                />
                                {tag.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Tooltip title="Refresh videos">
                    <IconButton onClick={onRefresh}>
                        <RefreshIcon />
                    </IconButton>
                </Tooltip>
                {(selectedTagId && tagVideosLoading) && <CircularProgress size={24} />}
            </Box>

            {displayVideos.length === 0 ? (
                <Alert severity="info">
                    {selectedTagId ? 'No videos found for this tag.' : 'No videos found. Try syncing your channels.'}
                </Alert>
            ) : (
                <Grid container spacing={3}>
                    {displayVideos.map((video) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={video.id}>
                            <Card>
                                <Box sx={{ position: 'relative' }}>
                                    <CardMedia
                                        component="img"
                                        height="140"
                                        image={video.thumbnail || `https://picsum.photos/seed/${video.id}/300/140`}
                                        alt={video.title}
                                    />
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            bottom: 8,
                                            right: 8,
                                            bgcolor: 'rgba(0,0,0,0.7)',
                                            color: '#fff',
                                            px: 1,
                                            py: 0.5,
                                            borderRadius: 1,
                                            fontSize: '0.75rem',
                                        }}
                                    >
                                        {video.duration || 'Unknown duration'}
                                    </Box>
                                </Box>
                                <CardContent>
                                    <Typography variant="subtitle1" gutterBottom noWrap>
                                        {video.title}
                                    </Typography>
                                    {/* <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }} noWrap>
                                        {video.channel?.name || 'Unknown channel'}
                                    </Typography> */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="caption" color="textSecondary">
                                            {video.viewCount?.toLocaleString() || 0} views
                                        </Typography>
                                        <Typography variant="caption" color="textSecondary">
                                            {new Date(video.publishedAt).toLocaleDateString()}
                                        </Typography>
                                    </Box>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        fullWidth
                                        sx={{ mt: 2 }}
                                        startIcon={<PlayIcon />}
                                        onClick={() => window.open(video.url, '_blank')}
                                    >
                                        Watch on YouTube
                                    </Button>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
}