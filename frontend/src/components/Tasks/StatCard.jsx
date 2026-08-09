import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export default function StatCard({ eyebrow, title, value }) {
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