import { Alert, Box, Stack, Typography, Button } from "@mui/material";
import { useState } from "react";
import { useSnackbar } from "../../hooks/useSnackbar";
import { BoxingEvent, FilterParams, boxingEventsApi, useListBoxingEventsQuery } from "../../api/boxing-events";
import BoxingEventForm from "../../components/BoxingEvents/BoxingEventForm";
import BoxingEventsCalendar from '../../components/BoxingEvents/BoxingEventsCalendar'
import AddIcon from '@mui/icons-material/Add';


const BoxingEventsPage: React.FC = () => {
    const filters: FilterParams = { page: 1, limit: 20 };
    const { data, error, refetch: fetchEvents } = useListBoxingEventsQuery(filters);
    const events = data?.data || [];
    const [openForm, setOpenForm] = useState(false);
    const [editingEvent, setEditingEvent] = useState<BoxingEvent | null>(null);
    const snackbar = useSnackbar();

    const handleCreate = () => {
        setEditingEvent(null);
        setOpenForm(true);
    };

    const handleEdit = (event: BoxingEvent) => {
        setEditingEvent(event);
        setOpenForm(true);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Delete this event?')) return;
        try {
            await boxingEventsApi.delete(id);
            snackbar.success('Event deleted.');
            fetchEvents();
        } catch (err) {
            snackbar.error('Failed to delete.');
        }
    };

    const handleFormSubmit = async (data: Partial<BoxingEvent>) => {
        try {
            if (editingEvent) {
                await boxingEventsApi.update(editingEvent.id, data);
                snackbar.success('Event updated.');
            } else {
                await boxingEventsApi.create(data);
                snackbar.success('Event created.');
            }
            setOpenForm(false);
            fetchEvents();
        } catch (err) {
            snackbar.error('Failed to save.');
        }
    };

    const handleExport = async (format: 'csv' | 'ics') => {
        try {
            const blob = await boxingEventsApi.export(filters, format);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `boxing_events.${format === 'ics' ? 'ics' : 'csv'}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            snackbar.error('Export failed.');
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            {error && <Alert severity="error">Failed to load events.</Alert>}
            <Stack sx={{ direction: 'row', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">Boxing Events</Typography>
                <Stack direction="row" spacing={1}>
                    <Button variant="outlined" onClick={() => handleExport('csv')}>
                        Export CSV
                    </Button>
                    <Button variant="outlined" onClick={() => handleExport('ics')}>
                        Export iCal
                    </Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                        Add Event
                    </Button>
                </Stack>
            </Stack>

            <BoxingEventsCalendar
                events={events}
                onEdit={handleEdit}
                onCreate={(date) => {
                    setEditingEvent({ id: 0, title: '', start_date: date.toISOString(), end_date: null, location: '', description: '', created_at: '', updated_at: '' })
                    setOpenForm(true)
                }}
                onDelete={(id) => handleDelete(id)}
                onRefresh={fetchEvents}
            />

            <BoxingEventForm
                open={openForm}
                onClose={() => setOpenForm(false)}
                onSubmit={handleFormSubmit}
                initialData={editingEvent || undefined}
            />
        </Box>
    );
};

export default BoxingEventsPage;