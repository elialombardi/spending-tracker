import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import InputLabel from '@mui/material/InputLabel'
import { formatCycleOptionLabel, formatMoney, formatReportRange } from '../lib/formatters'

export default function AppHeader({
    cycleOptions,
    hasNextCycle,
    hasPreviousCycle,
    isBusy,
    monthlyReport,
    onCycleStartChange,
    onExport,
    onNextCycle,
    onPreviousCycle,
    onRefresh,
    selectedCycleStart,
}) {
    return (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Paper sx={{ flex: '1 1 34%', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }} elevation={1}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Button variant="outlined" onClick={onPreviousCycle} disabled={isBusy || !hasPreviousCycle}>
                        Previous
                    </Button>

                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel id="cycle-start-label">Cycle starts on</InputLabel>
                        <Select
                            labelId="cycle-start-label"
                            value={selectedCycleStart}
                            label="Cycle starts on"
                            onChange={(e) => onCycleStartChange(e.target.value)}
                            disabled={isBusy || cycleOptions.length === 0}
                        >
                            {cycleOptions.length === 0 ? (
                                <MenuItem value="">No cycles available</MenuItem>
                            ) : (
                                cycleOptions.map((cycleOption) => (
                                    <MenuItem key={cycleOption.from} value={cycleOption.from}>
                                        {formatCycleOptionLabel(cycleOption)}
                                    </MenuItem>
                                ))
                            )}
                        </Select>
                    </FormControl>

                    <Button variant="outlined" onClick={onNextCycle} disabled={isBusy || !hasNextCycle}>
                        Next
                    </Button>
                    <Button variant="outlined" onClick={onRefresh} disabled={isBusy}>
                        Refresh
                    </Button>
                </Box>
            </Paper>
        </Box>
    )
}