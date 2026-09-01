import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

function getTodayValue() {
    return new Date().toISOString().slice(0, 10);
}

const getInitialFormState = (task = null) => ({
    projectId: task ? String(task.projectId || '') : '',
    name: task ? task.name || '' : '',
    cost: task && task.cost != null ? String(task.cost) : '',
    date: task ? task.date || getTodayValue() : getTodayValue(),
    sentOn: task ? task.sentOn || '' : '',
    description: task ? task.description || '' : '',
});

// This component handles the form logic without useEffect
function TaskCreateFormContent({
    isBusy = false,
    projects = [],
    onCreate,
    initialTask = null,
    onSave,
    onSuccess // optional callback after successful submit
}) {
    const projectOptions = useMemo(() => [...projects].sort((left, right) => left.name.localeCompare(right.name)), [projects]);
    const [formState, setFormState] = useState(() => getInitialFormState(initialTask));
    const [errorMessage, setErrorMessage] = useState('');

    const { projectId, name, cost, date, sentOn, description } = formState;

    const updateField = (field) => (value) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

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
            const payload = {
                projectId: projectId,
                name: name.trim(),
                cost: Number(cost),
                date,
                sentOn: sentOn || '',
                description: description.trim(),
            };
            if (initialTask && onSave) {
                await onSave({ ...initialTask, ...payload });
            } else {
                await onCreate?.(payload);
            }
            // Reset form to empty state after successful submission
            setFormState(getInitialFormState(null));
            onSuccess?.(); // Notify parent if needed
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
                        {initialTask ? 'Edit task' : 'Create task'}
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                        {initialTask ? 'Update the task details and save changes.' : 'Add a task and immediately include it in the pending and history views.'}
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
                        onChange={(event) => updateField('projectId')(event.target.value)}
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
                        onChange={(event) => updateField('name')(event.target.value)}
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
                        onChange={(event) => updateField('cost')(event.target.value)}
                        disabled={isBusy}
                    />

                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DatePicker
                            label="Date"
                            value={date ? new Date(date) : null}
                            onChange={(newValue) => updateField('date')(newValue ? newValue.toISOString().slice(0, 10) : '')}
                            disabled={isBusy}
                            slotProps={{
                                textField: {
                                    required: true,
                                    fullWidth: true,
                                }
                            }}
                        />

                        <DatePicker
                            label="Sent on"
                            value={sentOn ? new Date(sentOn) : null}
                            onChange={(newValue) => updateField('sentOn')(newValue ? newValue.toISOString().slice(0, 10) : '')}
                            disabled={isBusy}
                            slotProps={{
                                textField: {
                                    fullWidth: true,
                                }
                            }}
                        />
                    </LocalizationProvider>
                </Stack>

                <TextField
                    fullWidth
                    label="Description"
                    multiline
                    minRows={2}
                    value={description}
                    onChange={(event) => updateField('description')(event.target.value)}
                    disabled={isBusy}
                />

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <Typography color="text.secondary" variant="body2">
                        Leave sentOn empty to keep the task in the pending workflow.
                    </Typography>
                    <Button type="submit" variant="contained" disabled={isBusy || projectOptions.length === 0}>
                        {isBusy ? 'Saving...' : initialTask ? 'Save changes' : 'Create task'}
                    </Button>
                </Stack>
            </Stack>
        </Paper>
    );
}

// Main export - uses key to reset the form when initialTask changes
export default function TaskCreateForm(props) {
    // Use a key that changes when initialTask changes
    // This forces React to unmount and remount the form with new initial values
    const key = props.initialTask ? `task-${props.initialTask.id}` : 'new-task';

    return <TaskCreateFormContent key={key} {...props} />;
}