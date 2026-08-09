import { useEffect, useState } from 'react';
import { sumCosts, groupNotSentByMonth, groupNotSentByProject, compareByDateDescending } from '../../helpers/comparers';
import { formatCurrency } from '../../helpers/formatters';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import AddIcon from '@mui/icons-material/Add';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import api from '../../api';
import ProjectCreateForm from './ProjectCreateForm';
import TaskCreateForm from './TaskCreateForm';
import PrepareSection from '../Tasks/PrepareSection';

import TaskLine from '../Tasks/TaskLine';
import EmptyState from '../Tasks/EmptyState';
import StatCard from '../Tasks/StatCard';
import NotSentSection from '../Tasks/NotSentSection';


const VIEW_NOT_SENT = 'not-sent';
const VIEW_PREPARE = 'prepare';
const VIEW_HISTORY = 'history';

export default function TasksBoard() {
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [view, setView] = useState(VIEW_NOT_SENT);
    const [isProjectDrawerOpen, setIsProjectDrawerOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);

    function openEditTask(task) {
        setEditingTask(task);
        setIsTaskDrawerOpen(true);
    }

    async function handleUpdateTask(payload) {
        setIsSaving(true);
        setErrorMessage('');
        try {
            const updated = await api.updateTask(payload);
            setTasks((current) => (Array.isArray(current) ? current.map((t) => (t.id === updated.id ? updated : t)) : [updated]));
            setIsTaskDrawerOpen(false);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to update the task.');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }

    useEffect(() => {
        let active = true;

        async function loadTasks() {
            setIsLoading(true);
            setErrorMessage('');
            try {
                const [tasksResponse, projectsResponse] = await Promise.all([api.listTasks(), api.listProjects()]);
                if (!active) {
                    return;
                }
                setTasks(Array.isArray(tasksResponse) ? tasksResponse : []);
                setProjects(Array.isArray(projectsResponse) ? projectsResponse : []);
            } catch (error) {
                if (!active) {
                    return;
                }
                setErrorMessage(error instanceof Error ? error.message : 'Failed to load tasks.');
            } finally {
                if (active) {
                    setIsLoading(false);
                }
            }
        }

        loadTasks();
        return () => {
            active = false;
        };
    }, []);

    async function handleCreateTask(payload) {
        setIsSaving(true);
        setErrorMessage('');
        try {
            const createdTask = await api.createTask(payload);
            setTasks((currentTasks) => {
                const nextTasks = Array.isArray(currentTasks) ? [...currentTasks] : [];
                nextTasks.unshift(createdTask);
                return nextTasks;
            });
            setView(payload.sentOn ? VIEW_HISTORY : VIEW_NOT_SENT);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to create the task.');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }

    async function handleCreateProject(payload) {
        setIsSaving(true);
        setErrorMessage('');
        try {
            const createdProject = await api.createProject(payload);
            setProjects((currentProjects) => {
                const nextProjects = Array.isArray(currentProjects) ? [...currentProjects] : [];
                nextProjects.push(createdProject);
                return nextProjects;
            });
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to create the project.');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }

    function handleTasksSent(taskIds, sentOnDate) {
        setTasks((currentTasks) => (Array.isArray(currentTasks) ? currentTasks.map((task) => (taskIds.includes(task.id) ? { ...task, sentOn: sentOnDate } : task)) : currentTasks));
    }

    const unsentTasks = tasks.filter((task) => !task.sentOn);
    const unsentTotal = sumCosts(unsentTasks);
    const monthlyGroups = groupNotSentByMonth(unsentTasks);
    const projectGroups = groupNotSentByProject(unsentTasks);
    const historyTasks = [...tasks].sort(compareByDateDescending);

    return (
        <Stack spacing={3}>
            <Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" justifyContent="space-between" spacing={2}>
                    <Box>
                        <Typography sx={{ fontWeight: 800, letterSpacing: '-0.02em' }} variant="h4">
                            Tasks
                        </Typography>
                        <Typography color="text.secondary" sx={{ maxWidth: 720, mt: 1 }} variant="body1">
                            Review work still to send, prepare grouped handoff totals by project, and inspect the full task history.
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Button
                            size="small"
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setIsProjectDrawerOpen(true)}
                            disabled={isLoading || isSaving}
                            sx={{ width: 'auto', px: 1.5 }}
                        >
                            Add Project
                        </Button>
                        <Drawer anchor="right" open={isProjectDrawerOpen} onClose={() => setIsProjectDrawerOpen(false)}>
                            <Box sx={{ width: 380, p: 3 }}>
                                <ProjectCreateForm
                                    isBusy={isLoading || isSaving}
                                    onCreate={async (payload) => {
                                        await handleCreateProject(payload);
                                        setIsProjectDrawerOpen(false);
                                    }}
                                />
                            </Box>
                        </Drawer>
                    </Box>
                </Stack>
            </Box>
            <TaskCreateForm isBusy={isLoading || isSaving} projects={projects} onCreate={handleCreateTask} />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <StatCard eyebrow="Pending total" title="All tasks without sentOn" value={formatCurrency(unsentTotal)} />
                <StatCard eyebrow="Pending count" title="Tasks waiting to be sent" value={String(unsentTasks.length)} />
                <StatCard eyebrow="History" title="All stored tasks" value={String(tasks.length)} />
            </Stack>


            <Box>
                <ToggleButtonGroup
                    color="primary"
                    exclusive
                    value={view}
                    onChange={(_, nextView) => {
                        if (nextView) {
                            setView(nextView);
                        }
                    }}
                    sx={{
                        flexWrap: 'wrap',
                        gap: 1,
                        '& .MuiToggleButton-root': {
                            borderRadius: 999,
                            border: '1px solid',
                        },
                    }}
                >
                    <ToggleButton value={VIEW_NOT_SENT}>Not sent</ToggleButton>
                    <ToggleButton value={VIEW_PREPARE}>Prepare</ToggleButton>
                    <ToggleButton value={VIEW_HISTORY}>History</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

            {isLoading ? (
                <Stack alignItems="center" spacing={2} sx={{ py: 8 }}>
                    <CircularProgress />
                    <Typography color="text.secondary" variant="body2">
                        Loading tasks...
                    </Typography>
                </Stack>
            ) : null}

            <Drawer anchor="right" open={isTaskDrawerOpen} onClose={() => setIsTaskDrawerOpen(false)}>
                <Box sx={{ width: 520, p: 3 }}>
                    <TaskCreateForm
                        isBusy={isSaving}
                        projects={projects}
                        initialTask={editingTask}
                        onSave={handleUpdateTask}
                    />
                </Box>
            </Drawer>

            {!isLoading && view === VIEW_NOT_SENT ? (
                monthlyGroups.length === 0 ? (
                    <EmptyState title="Nothing pending" body="Every task already has a sentOn date." />
                ) : (
                   <NotSentSection monthlyGroups={monthlyGroups} openEditTask={openEditTask} />
                )
            ) : null}

            {!isLoading && view === VIEW_PREPARE ? (
                projectGroups.length === 0 ? (
                    <EmptyState title="Nothing to prepare" body="There are no unsent tasks to group by project." />
                ) : (
                    <PrepareSection projectGroups={projectGroups} onTasksSent={handleTasksSent} openEditTask={openEditTask} />
                )
            ) : null}

            {!isLoading && view === VIEW_HISTORY ? (
                historyTasks.length === 0 ? (
                    <EmptyState title="No task history" body="Create tasks in the admin area and they will appear here." />
                ) : (
                    <Paper sx={{ borderRadius: 3, p: 2.5 }} variant="outlined">
                        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                            <Typography sx={{ fontWeight: 700 }} variant="h6">
                                Full history
                            </Typography>
                            <Button onClick={() => setView(VIEW_NOT_SENT)} size="small">
                                Back to pending
                            </Button>
                        </Stack>
                        <List disablePadding>
                            {historyTasks.map((task) => (
                                <TaskLine key={task.id} showProject showSentOn task={task} onEdit={openEditTask} />
                            ))}
                        </List>
                    </Paper>
                )
            ) : null}
        </Stack>
    );
}