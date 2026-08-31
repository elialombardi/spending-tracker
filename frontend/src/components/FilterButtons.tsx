import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'

function FilterButtons({ filter, onFilterChange, onUseCurrentLocation, tags = [] }) {
    const options = [{ value: 'all', label: 'All' }, ...tags.map((t) => ({ value: t, label: t }))];
    return (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }} role="toolbar">
            <ToggleButtonGroup
                value={filter}
                exclusive
                onChange={(e, v) => { if (v !== null) onFilterChange(v); }}
                size="small"
            >
                {options.map((option) => (
                    <ToggleButton key={option.value} value={option.value}>{option.label}</ToggleButton>
                ))}
            </ToggleButtonGroup>

            <Button variant="outlined" size="small" onClick={onUseCurrentLocation}>Use my location</Button>
        </Box>
    );
}

export default FilterButtons;