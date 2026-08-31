import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

export default function Toast({ message }) {
    if (!message) {
        return null
    }

    return (
        <Paper elevation={1} sx={{ position: 'fixed', bottom: 16, right: 16, p: 1 }} className="toast">
            <Typography variant="body2">{message}</Typography>
        </Paper>
    )
}