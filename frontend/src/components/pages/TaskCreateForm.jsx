import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

function getTodayValue() {
    return new Date().toISOString().slice(0, 10);
}

export default function TaskCreateForm({ isBusy = false, projects = [], onCreate }) {
    const projectOptions = useMemo(() => [...projects].sort((left, right) => left.name.localeCompare(right.name)), [projects]);
    const [projectId, setProjectId] = useState('');
    const [name, setName] = useState('');
    const [cost, setCost] = useState('');
    const [date, setDate] = useState(getTodayValue);
    const [sentOn, setSentOn] = useState('');
    const [description, setDescription] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    async function handleSubmit(event) {
        event.preventDefault();
        setErrorMessage('');

        if (!projectId) {
            setErrorMessage('Project is required.');
            return;
        }
        if (!name.trim()) {
            setErrorMessage('Task name is required.');
            return;
        }
        if (!cost.trim() || Number.isNaN(Number(cost))) {
            setErrorMessage('Cost must be a valid number.');
            return;
        }
        if (!date) {
            setErrorMessage('Date is required.');
            return;
        }

        try {
            await onCreate?.({
                projectId: Number(projectId),
                name: name.trim(),
                cost: Number(cost),
                date,
                sentOn: sentOn || '',
                description: description.trim(),
            });
            setName('');
            setCost('');
            setDate(getTodayValue());
            setSentOn('');
            setDescription('');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to create the task.');
        }
    }

    return (
        <Paper
            component="form"
            onSubmit={handleSubmit}
            sx={{
                borderRadius: 3,
                p: { xs: 2, md: 2.5 },
                background: 'linear-gradient(135deg, rgba(184,115,51,0.12) 0%, rgba(17,94,89,0.06) 100%)',
            }}
            variant="outlined"
        >
            <Stack spacing={2}>
                <Box>
                    <Typography sx={{ fontWeight: 700 }} variant="h6">
                        Create task
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                        Add a task and immediately include it in the pending and history views.
                    </Typography>
                </Box>

                {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                        required
                        fullWidth
                        select
                        label="Project"
                        value={projectId}
                        onChange={(event) => setProjectId(event.target.value)}
                        disabled={isBusy || projectOptions.length === 0}
                        helperText={projectOptions.length === 0 ? 'Create a project with the form above first.' : 'Select the owning project.'}
                    >
                        {projectOptions.map((project) => (
                            <MenuItem key={project.id} value={String(project.id)}>
                                {project.name}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        required
                        fullWidth
                        label="Task name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        disabled={isBusy}
                    />
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                        required
                        fullWidth
                        label="Cost"
                        type="number"
                        value={cost}
                        onChange={(event) => setCost(event.target.value)}
                        disabled={isBusy}
                        inputProps={{ min: 0, step: '0.01' }}
                    />

                    <TextField
                        required
                        fullWidth
                        label="Date"
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                        disabled={isBusy}
                        InputLabelProps={{ shrink: true }}
                    />

                    <TextField
                        fullWidth
                        label="Sent on"
                        type="date"
                        value={sentOn}
                        onChange={(event) => setSentOn(event.target.value)}
                        disabled={isBusy}
                        InputLabelProps={{ shrink: true }}
                    />
                </Stack>

                <TextField
                    fullWidth
                    label="Description"
                    multiline
                    minRows={2}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    disabled={isBusy}
                />

                <Stack alignItems={{ xs: 'stretch', md: 'center' }} direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                    <Typography color="text.secondary" variant="body2">
                        Leave sentOn empty to keep the task in the pending workflow.
                    </Typography>
                    <Button type="submit" variant="contained" disabled={isBusy || projectOptions.length === 0}>
                        {isBusy ? 'Saving...' : 'Create task'}
                    </Button>
                </Stack>
            </Stack>
        </Paper>
    );
}