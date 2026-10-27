import React from 'react';
import {
    Box,
    Paper,
    Typography,
    LinearProgress,
    Chip,
    Grid,
    CircularProgress,
} from '@mui/material';
import { SyncStatus as SyncStatusType } from '../../api/youtube/types';

interface SyncStatusProps {
    status?: SyncStatusType;
    loading: boolean;
}

export function SyncStatus({ status, loading }: SyncStatusProps) {
    if (loading) {
        return (
            <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <CircularProgress size={24} />
                <Typography variant="body2">Loading sync status...</Typography>
            </Paper>
        );
    }

    if (!status) {
        return (
            <Paper sx={{ p: 2 }}>
                <Typography variant="body2" color="textSecondary">
                    No sync data available.
                </Typography>
            </Paper>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running':
                return 'warning';
            case 'completed':
                return 'success';
            case 'failed':
                return 'error';
            default:
                return 'default';
        }
    };

    return (
        <Paper sx={{ p: 2 }}>
            <Grid container spacing={2}>
                {/* Current Sync */}
                {status.isSyncing && status.currentSync && (
                    <Grid size={12}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <Typography variant="subtitle2">Syncing...</Typography>
                            <Chip
                                label={status.currentSync.type}
                                size="small"
                                color="warning"
                            />
                            <Typography variant="caption" color="textSecondary">
                                {status.currentSync.processedChannels || 0} / {status.currentSync.totalChannels || 0} channels
                            </Typography>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={status.currentSync.totalChannels > 0
                                ? (status.currentSync.processedChannels / status.currentSync.totalChannels) * 100
                                : 0}
                            sx={{ height: 8, borderRadius: 4 }}
                        />
                        <Typography variant="caption" color="textSecondary">
                            Videos added: {status.currentSync.totalVideosAdded || 0}
                        </Typography>
                    </Grid>
                )}

                {/* Last Sync */}
                {status.lastSync && (
                    <Grid size={12}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="caption" color="textSecondary">
                                Last sync:
                            </Typography>
                            <Chip
                                label={status.lastSync.status}
                                size="small"
                                color={getStatusColor(status.lastSync.status)}
                            />
                            <Typography variant="caption" color="textSecondary">
                                {status.lastSync.type} • {status.lastSync.totalVideosAdded} videos added
                            </Typography>
                            {status.lastSync.completedAt && (
                                <Typography variant="caption" color="textSecondary">
                                    {new Date(status.lastSync.completedAt).toLocaleString()}
                                </Typography>
                            )}
                            {status.lastSync.errorMessage && (
                                <Typography variant="caption" color="error">
                                    Error: {status.lastSync.errorMessage}
                                </Typography>
                            )}
                        </Box>
                    </Grid>
                )}

                {/* No sync data */}
                {!status.isSyncing && !status.lastSync && (
                    <Grid size={12}>
                        <Typography variant="body2" color="textSecondary">
                            No sync has been performed yet.
                        </Typography>
                    </Grid>
                )}
            </Grid>
        </Paper>
    );
}