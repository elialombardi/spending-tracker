import { Paper, Typography } from '@mui/material';

export default function EmptyState({ title, body }) {
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
