import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

export default function EmptyState({ message }) {
    return (
        <Paper elevation={0} sx={{ p: 2, textAlign: 'center' }} className="empty-state">
            <Typography variant="body2" color="text.secondary">{message}</Typography>
        </Paper>
    )
}