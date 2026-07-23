import Box from '@mui/material/Box'
import DashboardRoot from '../dashboard/DashboardRoot'

export default function DashboardPage() {
    return (
        <Box sx={{ p: 3, minHeight: '60vh' }}>
          <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                width: '100%',
                minHeight: 'calc(100vh - 96px)',
                px: { xs: 1, sm: 1.5 },
                py: { xs: 1, sm: 1.5 },
                boxSizing: 'border-box',
            }}
        >
            <DashboardRoot />
        </Box>
        </Box>
    )
}
