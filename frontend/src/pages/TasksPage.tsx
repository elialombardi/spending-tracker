import Paper from '@mui/material/Paper'
import TasksBoard from '../components/pages/TasksBoard'
export default function TasksPage() {
    return (
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <TasksBoard />
        </Paper>
    )
}
