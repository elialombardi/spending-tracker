import { Paper, Stack, Typography, List } from '@mui/material';
import TaskLine from './TaskLine';

export default function NotSentSection({ monthlyGroups, openEditTask }) {
  return (
    <Stack spacing={2.5}>
      {monthlyGroups.map((group) => (
        <Paper key={group.key} sx={{ borderRadius: 3, p: 2.5 }} variant="outlined">
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            sx={{
              mb: 1,
              justifyContent: 'space-between'
            }}
          >
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
  );
}