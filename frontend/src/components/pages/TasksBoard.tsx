import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import AddIcon from '@mui/icons-material/Add';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import api from '../../api';
import ProjectCreateForm from './ProjectCreateForm';
import TaskCreateForm from './TaskCreateForm';

const VIEW_NOT_SENT = 'not-sent';
const VIEW_PREPARE = 'prepare';
const VIEW_HISTORY = 'history';

function monthKey(dateValue: any) {
    const parsed = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
        return 'Unknown month';
    }
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(parsed);
}

function formatDate(dateValue: any) {
    if (!dateValue) {
        return 'Not sent';
    }
    const parsed = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
        return dateValue;
    }
    return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}

function formatCurrency(value: any) {
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(Number(value || 0));
}

function sumCosts(tasks: any[]) {
    return tasks.reduce((total, task) => total + Number(task.cost || 0), 0);
}

function compareByDateAscending(left: any, right: any) {
    return String(left.date || '').localeCompare(String(right.date || '')) || left.id - right.id;
}

function compareByDateDescending(left: any, right: any) {
    return String(right.date || '').localeCompare(String(left.date || '')) || right.id - left.id;
}

function groupNotSentByMonth(tasks: any[]) {
    const groups: any[] = [];
    let currentGroup: any = null;

    [...tasks].sort(compareByDateAscending).forEach((task) => {
        const key = monthKey(task.date);
        if (!currentGroup || currentGroup.key !== key) {
            currentGroup = { key, tasks: [] };
            groups.push(currentGroup);
        }
        currentGroup.tasks.push(task);
    });

    return groups;
}

function groupNotSentByProject(tasks: any[]) {
    const grouped = new Map();
    [...tasks].sort(compareByDateAscending).forEach((task) => {
        const key = task.projectName || 'Unknown project';
        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key).push(task);
    });

    return [...grouped.entries()]
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map(([projectName, projectTasks]) => ({
            projectName,
            totalCost: sumCosts(projectTasks),
            tasks: projectTasks,
        }));
}

function StatCard({ eyebrow, title, value }: any) {
    return (
        <Paper
            variant="outlined"
            sx={{
                borderRadius: 3,
                minWidth: 0,
                p: 2,
                background: 'linear-gradient(180deg, rgba(17,94,89,0.08) 0%, rgba(17,94,89,0.02) 100%)',
            }}
        >
            <Typography color="text.secondary" variant="overline">
                {eyebrow}
            </Typography>
            <Typography sx={{ fontWeight: 700 }} variant="h5">
                {value}
            </Typography>
            <Typography color="text.secondary" variant="body2">
                {title}
            </Typography>
        </Paper>
    );
}

function TaskLine({ task, showProject = false, showSentOn = false, onEdit }: any) {
    return (
        <ListItem
            disableGutters
            sx={{
                alignItems: 'flex-start',
                py: 1.25,
            }}
        >
            <ListItemText
                primary={
                    <Stack alignItems={{ xs: 'flex-start', sm: 'center' }} direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <Typography sx={{ fontWeight: 600 }} variant="body1">
                            {task.name}
                        </Typography>
                        {showProject ? <Chip label={task.projectName} size="small" variant="outlined" /> : null}
                        {!task.sentOn ? <Chip color="warning" label="Not sent" size="small" /> : null}
                    </Stack>
                }
                secondary={
                    <Stack divider={<Divider flexItem orientation="vertical" />} direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 0.75 }} useFlexGap>
                        <Typography component="span" variant="body2">Date: {formatDate(task.date)}</Typography>
                        {showSentOn ? <Typography component="span" variant="body2">Sent on: {formatDate(task.sentOn)}</Typography> : null}
                        {task.description ? <Typography component="span" variant="body2">{task.description}</Typography> : null}
                    </Stack>
                }
            />
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 2, gap: 1 }}>
                <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} variant="body1">
                    {formatCurrency(task.cost)}
                </Typography>
                {onEdit ? (
                    <Button size="small" onClick={() => onEdit(task)}>
                        Edit
                    </Button>
                ) : null}
            </Box>
        </ListItem>
    );
}

function EmptyState({ title, body }: any) {
    return (
        <Paper
            variant="outlined"
            sx={{
                borderRadius: 3,
                p: 3,
                textAlign: 'center',
                background: 'linear-gradient(180deg, rgba(15,23,42,0.02) 0%, rgba(15,23,42,0.04) 100%)',
            }}
        >
            <Typography sx={{ fontWeight: 700, mb: 0.5 }} variant="h6">
                {title}
            </Typography>
            <Typography color="text.secondary" variant="body2">
                {body}
            </Typography>
        </Paper>
    );
}

export default function TasksBoard() {
    const [tasks, setTasks] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [view, setView] = useState(VIEW_NOT_SENT);
    const [isProjectDrawerOpen, setIsProjectDrawerOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null);
    const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);

    function openEditTask(task: any) {
        setEditingTask(task);
        setIsTaskDrawerOpen(true);
    }

    async function handleUpdateTask(payload: any) {
        setIsSaving(true);
        setErrorMessage('');
        try {
            const updated = await api.updateTask(payload);
            setTasks((current) => (Array.isArray(current) ? current.map((t) => (t.id === updated.id ? updated : t)) : [updated]));
            setIsTaskDrawerOpen(false);
        } catch (error: any) {
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
            } catch (error: any) {
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

    async function handleCreateTask(payload: any) {
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
        } catch (error: any) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to create the task.');
            throw error;
        } finally {
            setIsSaving(false);
        }
    }

    async function handleCreateProject(payload: any) {
        setIsSaving(true);
        setErrorMessage('');
        try {
            const createdProject = await api.createProject(payload);
            setProjects((currentProjects) => {
                const nextProjects = Array.isArray(currentProjects) ? [...currentProjects] : [];
                nextProjects.push(createdProject);
                return nextProjects;
            });
        } catch (error: any) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to create the project.');
            throw error;
        } finally {
            setIsSaving(false);
        }
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
                                    onCreate={async (payload: any) => {
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
                    <Stack spacing={2.5}>
                        {monthlyGroups.map((group) => (
                            <Paper key={group.key} sx={{ borderRadius: 3, p: 2.5 }} variant="outlined">
                                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                                    <Typography sx={{ fontWeight: 700 }} variant="h6">
                                        {group.key}
                                    </Typography>
                                    <Typography color="text.secondary" variant="body2">
                                        {group.tasks.length} tasks
                                    </Typography>
                                </Stack>
                                <List disablePadding>
                                    {group.tasks.map((task) => (
                                        <TaskLine key={task.id} showProject task={task} onEdit={openEditTask} />
                                    ))}
                                </List>
                            </Paper>
                        ))}
                    </Stack>
                )
            ) : null}

            {!isLoading && view === VIEW_PREPARE ? (
                projectGroups.length === 0 ? (
                    <EmptyState title="Nothing to prepare" body="There are no unsent tasks to group by project." />
                ) : (
                    <Stack spacing={2.5}>
                        {projectGroups.map((group) => (
                            <Paper key={group.projectName} sx={{ borderRadius: 3, p: 2.5 }} variant="outlined">
                                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                                    <Box>
                                        <Typography sx={{ fontWeight: 700 }} variant="h6">
                                            {group.projectName}
                                        </Typography>
                                        <Typography color="text.secondary" variant="body2">
                                            {group.tasks.length} unsent tasks
                                        </Typography>
                                    </Box>
                                    <Typography sx={{ fontWeight: 700 }} variant="h6">
                                        {formatCurrency(group.totalCost)}
                                    </Typography>
                                </Stack>
                                <List disablePadding>
                                    {group.tasks.map((task) => (
                                        <TaskLine key={task.id} task={task} onEdit={openEditTask} />
                                    ))}
                                </List>
                            </Paper>
                        ))}
                    </Stack>
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
