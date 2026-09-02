import React from 'react';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, IconButton, Tooltip, TextField, MenuItem, Stack, Box, Typography,
    CircularProgress, TablePagination,
} from '@mui/material';
import { Edit, Delete, CalendarToday } from '@mui/icons-material';
import { format } from 'date-fns';
import { BoxingEvent, FilterParams } from '../../api/boxing-events';

interface Props {
    events: BoxingEvent[];
    total: number;
    loading: boolean;
    error: string | null;
    filters: FilterParams;
    onFilterChange: (filters: Partial<FilterParams>) => void;
    onEdit: (event: BoxingEvent) => void;
    onDelete: (id: number) => void;
    onRefresh: () => void;
}

const BoxingEventTable: React.FC<Props> = ({
    events,
    total,
    loading,
    error,
    filters,
    onFilterChange,
    onEdit,
    onDelete,
    onRefresh,
}) => {
    const handlePageChange = (event: unknown, newPage: number) => {
        onFilterChange({ page: newPage + 1 });
    };

    const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onFilterChange({ limit: parseInt(e.target.value, 10), page: 1 });
    };

    const addToCalendar = (event: BoxingEvent) => {
        // Generate Google Calendar link or download .ics
        const start = new Date(event.start_date);
        const end = event.end_date ? new Date(event.end_date) : new Date(start.getTime() + 3600000);
        const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}/${end.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}&location=${encodeURIComponent(event.location)}&details=${encodeURIComponent(event.description)}`;
        window.open(url, '_blank');
    };

    return (
        <Paper>
            <Box sx={{ p: 2 }}>
                <Stack sx={{ flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
                    <TextField
                        label="Search Title"
                        value={filters.title || ''}
                        onChange={(e) => onFilterChange({ title: e.target.value })}
                        size="small"
                    />
                    <TextField
                        label="Location"
                        value={filters.location || ''}
                        onChange={(e) => onFilterChange({ location: e.target.value })}
                        size="small"
                    />
                    <TextField
                        select
                        label="Status"
                        value={filters.status || ''}
                        onChange={(e) => onFilterChange({ status: e.target.value as any })}
                        size="small"
                        sx={{ minWidth: 120 }}
                    >
                        <MenuItem value="">All</MenuItem>
                        <MenuItem value="upcoming">Upcoming</MenuItem>
                        <MenuItem value="past">Past</MenuItem>
                    </TextField>
                    <TextField
                        type="datetime-local"
                        label="Start From"
                        value={filters.start_from || ''}
                        onChange={(e) => onFilterChange({ start_from: e.target.value })}
                        size="small"
                        slotProps={{
                            inputLabel: { shrink: true }
                        }}
                    />
                    <TextField
                        type="datetime-local"
                        label="Start To"
                        value={filters.start_to || ''}
                        onChange={(e) => onFilterChange({ start_to: e.target.value })}
                        size="small"
                        slotProps={{
                            inputLabel: { shrink: true }
                        }}
                    />
                </Stack>
            </Box>

            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Title</TableCell>
                            <TableCell>Start Date</TableCell>
                            <TableCell>End Date</TableCell>
                            <TableCell>Location</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center"><CircularProgress /></TableCell>
                            </TableRow>
                        ) : error ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" color="error">{error}</TableCell>
                            </TableRow>
                        ) : events.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center">No events found.</TableCell>
                            </TableRow>
                        ) : (
                            events.map((event) => (
                                <TableRow key={event.id}>
                                    <TableCell>{event.title}</TableCell>
                                    <TableCell>{format(new Date(event.start_date), 'MMM d, yyyy HH:mm')}</TableCell>
                                    <TableCell>{event.end_date ? format(new Date(event.end_date), 'MMM d, yyyy HH:mm') : '-'}</TableCell>
                                    <TableCell>{event.location}</TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Add to Calendar">
                                            <IconButton onClick={() => addToCalendar(event)}>
                                                <CalendarToday fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Edit">
                                            <IconButton onClick={() => onEdit(event)}>
                                                <Edit fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton onClick={() => onDelete(event.id)}>
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                component="div"
                count={total}
                page={filters.page ? filters.page - 1 : 0}
                onPageChange={handlePageChange}
                rowsPerPage={filters.limit || 20}
                onRowsPerPageChange={handleLimitChange}
                rowsPerPageOptions={[10, 20, 50]}
            />
        </Paper>
    );
};

export default BoxingEventTable;