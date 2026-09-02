import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Stack,
} from '@mui/material';
import { BoxingEvent } from '../../api/boxing-events';

interface Props {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<BoxingEvent>) => void;
    initialData?: BoxingEvent;
}

const BoxingEventForm: React.FC<Props> = ({ open, onClose, onSubmit, initialData }) => {
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title);
            setStartDate(initialData.start_date.slice(0, 16));
            setEndDate(initialData.end_date ? initialData.end_date.slice(0, 16) : '');
            setLocation(initialData.location || '');
            setDescription(initialData.description || '');
        } else {
            setTitle('');
            setStartDate('');
            setEndDate('');
            setLocation('');
            setDescription('');
        }
        setErrors({});
    }, [initialData, open]);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!title.trim()) newErrors.title = 'Title is required.';
        if (!startDate) newErrors.startDate = 'Start date is required.';
        if (endDate && new Date(endDate) < new Date(startDate)) {
            newErrors.endDate = 'End date must be after start date.';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;
        const data: Partial<BoxingEvent> = {
            title,
            start_date: new Date(startDate).toISOString(),
            end_date: endDate ? new Date(endDate).toISOString() : null,
            location: location || undefined,
            description: description || undefined,
        };
        onSubmit(data);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{initialData ? 'Edit Event' : 'New Event'}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Title *"
                        fullWidth
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        error={!!errors.title}
                        helperText={errors.title}
                    />
                    <TextField
                        label="Start Date *"
                        type="datetime-local"
                        fullWidth
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        slotProps={{
                            inputLabel: { shrink: true }
                        }}
                        error={!!errors.startDate}
                        helperText={errors.startDate}
                    />
                    <TextField
                        label="End Date"
                        type="datetime-local"
                        fullWidth
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        slotProps={{
                            inputLabel: { shrink: true }
                        }}
                        error={!!errors.endDate}
                        helperText={errors.endDate}
                    />
                    <TextField
                        label="Location"
                        fullWidth
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                    />
                    <TextField
                        label="Description"
                        fullWidth
                        multiline
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSubmit}>
                    {initialData ? 'Update' : 'Create'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default BoxingEventForm;