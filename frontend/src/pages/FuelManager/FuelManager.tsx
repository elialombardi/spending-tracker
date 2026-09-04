import React, { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Button,
    Card,
    CardContent,
    Grid,
    Alert,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Snackbar,
    Tooltip,
    useTheme,
    Divider,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    LocalGasStation as GasStationIcon,
    DeleteSweep as DeleteSweepIcon,
    Info as InfoIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import {
    useCreateFuelRecordMutation,
    useGetFuelRecordsQuery,
    useGetFuelStatsQuery,
    useDeleteFuelRecordMutation,
    useDeleteAllFuelRecordsMutation,
} from '../../api/fuelApi';
import { format, parseISO } from 'date-fns';

const StyledCard = styled(Card)(({ theme }) => ({
    marginBottom: theme.spacing(3),
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[3],
}));

const StatsCard = styled(Card)(({ theme }) => ({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(2),
    transition: 'transform 0.2s',
    '&:hover': {
        transform: 'scale(1.02)',
    },
}));

const FuelManager: React.FC = () => {
    const theme = useTheme();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
        open: false,
        message: '',
        severity: 'info',
    });

    const { data: stats, isLoading: statsLoading, error: statsError } = useGetFuelStatsQuery();
    const { data: records, isLoading: recordsLoading, error: recordsError } = useGetFuelRecordsQuery();
    const [createRecord, { isLoading: isCreating }] = useCreateFuelRecordMutation();
    const [deleteRecord] = useDeleteFuelRecordMutation();
    const [deleteAllRecords] = useDeleteAllFuelRecordsMutation();

    const handleAddGPL = async () => {
        try {
            const result = await createRecord({ fillType: 'gpl' }).unwrap();
            setSnackbar({
                open: true,
                message: `GPL fill recorded successfully!`,
                severity: 'success',
            });
        } catch (error: any) {
            const message = error.data?.message || 'Failed to record GPL fill';
            setSnackbar({
                open: true,
                message,
                severity: 'error',
            });
        }
    };

    const handleAddBenzina = async () => {
        try {
            const result = await createRecord({ fillType: 'benzina' }).unwrap();
            setSnackbar({
                open: true,
                message: `Benzina fill recorded successfully!`,
                severity: 'success',
            });
        } catch (error: any) {
            const message = error.data?.message || 'Failed to record benzina fill';
            setSnackbar({
                open: true,
                message,
                severity: 'error',
            });
        }
    };

    const handleDeleteRecord = (id: string) => {
        setDeleteRecordId(id);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!deleteRecordId) return;
        try {
            await deleteRecord(deleteRecordId).unwrap();
            setSnackbar({
                open: true,
                message: 'Fuel record deleted successfully',
                severity: 'success',
            });
        } catch (error: any) {
            setSnackbar({
                open: true,
                message: error.data?.message || 'Failed to delete record',
                severity: 'error',
            });
        } finally {
            setShowDeleteConfirm(false);
            setDeleteRecordId(null);
        }
    };

    const handleDeleteAll = async () => {
        try {
            await deleteAllRecords().unwrap();
            setSnackbar({
                open: true,
                message: 'All fuel records deleted successfully',
                severity: 'success',
            });
        } catch (error: any) {
            setSnackbar({
                open: true,
                message: error.data?.message || 'Failed to delete all records',
                severity: 'error',
            });
        }
    };

    const getFillTypeColor = (fillType: string) => {
        return fillType === 'gpl' ? 'info' : 'warning';
    };

    const getFillTypeLabel = (fillType: string) => {
        return fillType === 'gpl' ? 'GPL' : 'Benzina';
    };

    // Check if user should fill with benzina
    const shouldFillBenzina = stats?.fillsUntilBenzina === 0;

    return (
        <Container maxWidth="lg">
            <Box sx={{ py: 4 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 4 }}>
                    <Typography variant="h4" component="h1">
                        Fuel Manager
                    </Typography>
                    <Box>
                        <Tooltip title="Delete all records (admin only)">
                            <IconButton color="error" onClick={handleDeleteAll}>
                                <DeleteSweepIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                {statsError && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        Failed to load fuel statistics
                    </Alert>
                )}

                {statsLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : stats && (
                    <Grid container spacing={3} sx={{ mb: 4 }}>
                        <Grid size={{ xs: 12, md: 3 }} >
                            <StatsCard>
                                <Typography variant="h3" color="primary">
                                    {stats.totalFills}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    Total Fills
                                </Typography>
                            </StatsCard>
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <StatsCard>
                                <Typography variant="h3" color="info.main">
                                    {stats.gplCount}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    GPL Fills
                                </Typography>
                            </StatsCard>
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <StatsCard>
                                <Typography variant="h3" color="warning.main">
                                    {stats.benzinaCount}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    Benzina Fills
                                </Typography>
                            </StatsCard>
                        </Grid>
                        <Grid size={{ xs: 12, md: 3 }}>
                            <StatsCard sx={{
                                bgcolor: shouldFillBenzina ? theme.palette.warning.light : 'transparent',
                            }}>
                                <Typography variant="h3" color={shouldFillBenzina ? 'warning.main' : 'text.primary'}>
                                    {stats.fillsUntilBenzina}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    Fills Until Benzina
                                </Typography>
                                {shouldFillBenzina && (
                                    <Chip
                                        label="Time for Benzina!"
                                        color="warning"
                                        size="small"
                                        sx={{ mt: 1 }}
                                    />
                                )}
                            </StatsCard>
                        </Grid>
                    </Grid>
                )}

                <StyledCard>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            <GasStationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                            Add Fuel Fill
                        </Typography>
                        <Divider sx={{ mb: 3 }} />
                        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                            <Button
                                variant="contained"
                                color="info"
                                onClick={handleAddGPL}
                                disabled={isCreating || shouldFillBenzina}
                                startIcon={<AddIcon />}
                                sx={{ flexGrow: 1 }}
                            >
                                Add GPL Fill
                            </Button>
                            <Button
                                variant="contained"
                                color="warning"
                                onClick={handleAddBenzina}
                                disabled={isCreating || !shouldFillBenzina}
                                startIcon={<AddIcon />}
                                sx={{ flexGrow: 1 }}
                            >
                                Add Benzina Fill
                            </Button>
                        </Box>
                        {shouldFillBenzina && (
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                ⚠️ You need to fill with Benzina before adding more GPL fills!
                            </Alert>
                        )}
                        {!shouldFillBenzina && stats && stats.fillsUntilBenzina > 0 && (
                            <Alert severity="info" sx={{ mt: 2 }}>
                                Add {stats.fillsUntilBenzina} more GPL fill{stats.fillsUntilBenzina > 1 ? 's' : ''} before adding Benzina
                            </Alert>
                        )}
                    </CardContent>
                </StyledCard>

                <Card>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Recent Fuel Records
                        </Typography>

                        {recordsError && (
                            <Alert severity="error">
                                Failed to load fuel records
                            </Alert>
                        )}

                        {recordsLoading ? (
                            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : records && records.length === 0 ? (
                            <Alert severity="info">
                                No fuel records found. Start tracking your fills!
                            </Alert>
                        ) : records && (
                            <TableContainer component={Paper} variant="outlined">
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Type</TableCell>
                                            <TableCell>Date & Time</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {records.map((record) => (
                                            <TableRow key={record.id}>
                                                <TableCell>
                                                    <Chip
                                                        label={getFillTypeLabel(record.fillType)}
                                                        color={getFillTypeColor(record.fillType)}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {format(parseISO(record.createdAt), 'PPP p')}
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Tooltip title="Delete record (admin only)">
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => handleDeleteRecord(record.id)}
                                                        >
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </CardContent>
                </Card>
            </Box>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
                <DialogTitle>Delete Fuel Record</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete this fuel record? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                    <Button onClick={confirmDelete} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar for notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    severity={snackbar.severity}
                    variant="filled"
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default FuelManager;