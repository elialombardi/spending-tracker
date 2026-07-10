import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import DashboardRoot from '../dashboard/DashboardRoot';

function DashboardPage() {
    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                width: '100%',
                minHeight: 'calc(100vh - 96px)',
                px: { xs: 1, sm: 1.5 },
                py: { xs: 1, sm: 1.5 },
                borderRadius: 3,
                background:
                    'radial-gradient(circle at top, rgba(114, 88, 255, 0.16), transparent 32%), #16171d',
                boxSizing: 'border-box',
            }}
        >
            <DashboardRoot />
        </Box>
    );
}

export default DashboardPage;