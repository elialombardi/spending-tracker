import React, { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Tabs,
    Tab,
    Paper,
    Button,
    Chip,
    CircularProgress,
    Alert,
    Grid,
    Card,
    CardContent,
    CardMedia,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Snackbar,
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Add as AddIcon,
    Tag as TagIcon,
    VideoLibrary as VideoIcon,
    Sync as SyncIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
} from '@mui/icons-material';
import { youtubeApi, useGetChannelsQuery, useGetTagsQuery, useGetLatestVideosQuery, useSyncAllMutation, useGetSyncStatusQuery } from '../api/youtube/endpoints';
import { ChannelList } from '../components/youtube/ChannelList';
import { SyncStatus } from '../components/youtube/SyncStatus';
import { TagManager } from '../components/youtube/TagManager';
import { VideoFeed } from '../components/youtube/VideoFeed';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`youtube-tabpanel-${index}`}
            aria-labelledby={`youtube-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

export function YoutubeManager() {
    const [tabValue, setTabValue] = useState(0);
    const [syncDialogOpen, setSyncDialogOpen] = useState(false);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
        open: false,
        message: '',
        severity: 'info',
    });

    const { data: channels, isLoading: channelsLoading, error: channelsError, refetch: refetchChannels } = useGetChannelsQuery({ includeVideos: true, limit: 10 });
    const { data: tags, isLoading: tagsLoading, error: tagsError, refetch: refetchTags } = useGetTagsQuery();
    const { data: videos, isLoading: videosLoading, error: videosError, refetch: refetchVideos } = useGetLatestVideosQuery({ limit: 20 });
    const { data: cachedSyncStatus } = youtubeApi.endpoints.getSyncStatus.useQueryState();
    const { data: syncStatus, isLoading: syncStatusLoading, error: syncStatusError, refetch: refetchSyncStatus } = useGetSyncStatusQuery(undefined, {
        pollingInterval: cachedSyncStatus?.isSyncing ? 2000 : 0,
        refetchOnMountOrArgChange: true,
    });
    const [syncAll, { isLoading: syncAllLoading }] = useSyncAllMutation();

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleSyncAll = async () => {
        try {
            await syncAll().unwrap();
            setSnackbar({
                open: true,
                message: 'Sync started successfully',
                severity: 'success',
            });
            setSyncDialogOpen(false);
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Failed to start sync',
                severity: 'error',
            });
        }
    };

    const handleRefresh = () => {
        refetchChannels();
        refetchTags();
        refetchVideos();
        refetchSyncStatus();
        setSnackbar({
            open: true,
            message: 'Refreshed successfully',
            severity: 'info',
        });
    };

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h4" gutterBottom>
                        YouTube Subscriptions Manager
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Manage your YouTube subscriptions and organize channels with tags
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Tooltip title="Refresh all data">
                        <IconButton onClick={handleRefresh} color="primary">
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    <Button
                        variant="contained"
                        startIcon={<SyncIcon />}
                        onClick={() => setSyncDialogOpen(true)}
                        disabled={syncAllLoading || syncStatus?.isSyncing}
                    >
                        {syncStatus?.isSyncing ? 'Syncing...' : 'Sync All'}
                    </Button>
                </Box>
            </Box>

            {/* Sync Status */}
            <Box sx={{ mb: 3 }}>
                <SyncStatus status={syncStatus} loading={syncStatusLoading} error={syncStatusError} />
            </Box>

            {/* Tabs */}
            <Paper sx={{ width: '100%' }}>
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    aria-label="youtube manager tabs"
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                    <Tab label="Channels" icon={<TagIcon />} iconPosition="start" />
                    <Tab label="Tags" icon={<TagIcon />} iconPosition="start" />
                    <Tab label="Videos" icon={<VideoIcon />} iconPosition="start" />
                </Tabs>

                <TabPanel value={tabValue} index={0}>
                    <ChannelList
                        channels={channels || []}
                        loading={channelsLoading}
                        error={channelsError}
                        tags={tags || []}
                        onRefresh={refetchChannels}
                    />
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    <TagManager
                        tags={tags || []}
                        loading={tagsLoading}
                        error={tagsError}
                        onRefresh={refetchTags} />
                </TabPanel>

                <TabPanel value={tabValue} index={2}>
                    <VideoFeed
                        videos={videos || []}
                        loading={videosLoading}
                        error={videosError}
                        tags={tags || []}
                        onRefresh={refetchVideos}
                    />
                </TabPanel>
            </Paper>

            {/* Sync Dialog */}
            <Dialog open={syncDialogOpen} onClose={() => setSyncDialogOpen(false)}>
                <DialogTitle>Sync All Channels</DialogTitle>
                <DialogContent>
                    <Typography>
                        This will fetch the latest videos from all your subscribed YouTube channels.
                        This process may take a few minutes depending on the number of channels.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSyncDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSyncAll} variant="contained" disabled={syncAllLoading}>
                        {syncAllLoading ? <CircularProgress size={24} /> : 'Start Sync'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
            >
                <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
}