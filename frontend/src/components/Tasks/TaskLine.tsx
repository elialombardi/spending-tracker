import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { formatCurrency, formatDate } from '../../helpers/formatters';

// Define the Task type
interface Task {
    id: string;
    name: string;
    cost: number;
    date: string;
    sentOn?: string | null;
    description?: string | null;
    projectName?: string;
}

// Define component props
interface TaskLineProps {
    task: Task;
    showProject?: boolean;
    showSentOn?: boolean;
    showDate?: boolean;
    onEdit?: (task: Task) => void;
}

export default function TaskLine({
    task,
    showProject = false,
    showSentOn = false,
    showDate = true,
    onEdit
}: TaskLineProps) {
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
                    <Typography sx={{ fontWeight: 600 }} variant="body1" component="span">
                        {task.name}
                    </Typography>
                }
                secondary={
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        sx={{
                            alignItems: { xs: 'flex-start', sm: 'center' },
                            mt: 0.5
                        }}
                    >
                        {showProject && task.projectName ? (
                            <Chip label={task.projectName} size="small" variant="outlined" />
                        ) : null}
                        {!task.sentOn && showSentOn ? (
                            <Chip color="warning" label="Not sent" size="small" />
                        ) : null}
                        {showDate ? (
                            <Typography component="span" variant="body2" color="text.secondary">
                                {formatDate(task.date)}
                            </Typography>
                        ) : null}
                        {showSentOn && task.sentOn ? (
                            <Typography component="span" variant="body2" color="text.secondary">
                                Sent on: {formatDate(task.sentOn)}
                            </Typography>
                        ) : null}
                        {task.description ? (
                            <Typography component="span" variant="body2" color="text.secondary">
                                {task.description}
                            </Typography>
                        ) : null}
                    </Stack>
                }
                slotProps={{
                    primary: {
                        component: 'div',
                    },
                    secondary: {
                        component: 'div',
                    }
                }}
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