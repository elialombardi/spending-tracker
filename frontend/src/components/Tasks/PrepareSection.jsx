import { useState } from 'react';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import Alert from '@mui/material/Alert';
import TaskLine from './TaskLine';
import { formatCurrency } from '../../helpers/formatters';
import { Button } from '@mui/material';
import api from '../../api';

export default function PrepareSection({ projectGroups, onTasksSent }) {
    const [isSending, setIsSending] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    async function handleSendAll() {
        const tasksToSend = projectGroups.flatMap((group) => (group.tasks || []).filter((task) => task && task.id && !task.sentOn));

        if (tasksToSend.length === 0) {
            setErrorMessage('There are no tasks to send.');
            setSuccessMessage('');
            return;
        }

        const sentOnDate = new Date().toISOString().slice(0, 10);
        const payloads = tasksToSend.map((task) => ({
            id: task.id,
            projectId: task.projectId ?? task.project_id ?? task.projectID,
            name: task.name ?? '',
            cost: task.cost ?? 0,
            date: task.date ?? '',
            sentOn: sentOnDate,
            description: task.description ?? '',
        }));

        setIsSending(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            for (const payload of payloads) {
                await api.updateTask(payload);
            }
            onTasksSent?.(payloads.map((payload) => payload.id), sentOnDate);
            setSuccessMessage(`Successfully sent ${payloads.length} task${payloads.length === 1 ? '' : 's'}.`);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to send tasks.');
        } finally {
            setIsSending(false);
        }
    }

    return (
        <Stack spacing={2.5}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1.5, alignItems: 'center' }}>
                <Button variant="contained" color="primary" onClick={handleSendAll} disabled={isSending}>
                    {isSending ? 'Sending…' : 'Send all tasks'}
                </Button>
                {errorMessage ? <Typography color="error">{errorMessage}</Typography> : null}
            </Box>
            {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
            {projectGroups.map((group) => (
                <Paper key={group.projectName} sx={{ borderRadius: 3, p: 2.5 }} variant="outlined">
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                        <Box>
                            <Typography sx={{ fontWeight: 700 }} variant="h6">
                                {group.projectName}
                            </Typography>
                        </Box>
                        <Typography sx={{ fontWeight: 700 }} variant="h6">
                            {formatCurrency(group.totalCost)}
                        </Typography>
                    </Stack>
                    <List disablePadding>
                        {group.tasks.map((task) => (
                            <TaskLine key={task.id} task={task} showDate={false} />
                        ))}
                    </List>
                </Paper>
            ))}
        </Stack>
    )
}