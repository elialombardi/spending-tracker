import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

export default function ProjectCreateForm({ isBusy = false, onCreate }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    async function handleSubmit(event) {
        event.preventDefault();
        setErrorMessage('');

        if (!name.trim()) {
            setErrorMessage('Project name is required.');
            return;
        }

        try {
            await onCreate?.({
                name: name.trim(),
                description: description.trim(),
            });
            setName('');
            setDescription('');
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to create the project.');
        }
    }

    return (
        <Paper
            component="form"
            onSubmit={handleSubmit}
            sx={{
                borderRadius: 3,
                p: { xs: 2, md: 2.5 },
                background: 'linear-gradient(135deg, rgba(7,89,133,0.12) 0%, rgba(184,115,51,0.06) 100%)',
            }}
            variant="outlined"
        >
            <Stack spacing={2}>
                <Box>
                    <Typography sx={{ fontWeight: 700 }} variant="h6">
                        Create project
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                        Add a project here so it becomes available in the task form immediately.
                    </Typography>
                </Box>

                {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                        required
                        fullWidth
                        label="Project name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        disabled={isBusy}
                    />

                    <TextField
                        fullWidth
                        label="Description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        disabled={isBusy}
                    />
                </Stack>

                <Stack alignItems={{ xs: 'stretch', md: 'center' }} direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                    <Typography color="text.secondary" variant="body2">
                        Keep names distinct so the project selector stays clear.
                    </Typography>
                    <Button type="submit" variant="contained" disabled={isBusy}>
                        {isBusy ? 'Saving...' : 'Create project'}
                    </Button>
                </Stack>
            </Stack>
        </Paper>
    );
}