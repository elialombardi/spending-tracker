import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { formatCurrency, formatDate } from '../../helpers/formatters';

export default function TaskLine({ task, showProject = false, showSentOn = false, showDate = true, onEdit }) {
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
                        {!task.sentOn && showSentOn ? <Chip color="warning" label="Not sent" size="small" /> : null}
                    </Stack>
                }
                secondary={
                    <Stack divider={<Divider flexItem orientation="vertical" />} direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 0.75 }} useFlexGap>
                        {showDate ? <Typography component="span" variant="body2">Date: {formatDate(task.date)}</Typography> : null}
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
