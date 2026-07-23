import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'

interface Props {
    value?: string
    onChange?: (v: string) => void
    options?: string[]
}

export default function FilterButtons({ value = 'all', onChange, options = [] }: Props) {
    return (
        <ToggleButtonGroup value={value} exclusive onChange={(_, v) => onChange && onChange(v || 'all')}>
            <ToggleButton value="all">All</ToggleButton>
            {options.map((opt) => (
                <ToggleButton key={opt} value={opt}>{opt}</ToggleButton>
            ))}
        </ToggleButtonGroup>
    )
}
