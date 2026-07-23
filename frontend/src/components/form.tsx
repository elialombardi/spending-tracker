import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import TagMultiSelect from './TagMultiSelect'

interface LocationValue {
    title: string
    tags: string[]
    lat: string | number
    lng: string | number
    description: string
    url: string
}

interface Props {
    value: LocationValue
    onChange: (v: LocationValue) => void
    onSubmit?: () => void | Promise<void>
    tagOptions?: string[]
}

export default function LocationForm({ value, onChange, onSubmit, tagOptions = [] }: Props) {
    return (
        <Box component="form" onSubmit={(e) => { e.preventDefault(); onSubmit && onSubmit(); }} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Title" size="small" value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} fullWidth />
            <TagMultiSelect options={tagOptions} value={value.tags} onChange={(tags) => onChange({ ...value, tags })} />
            <TextField label="Latitude" size="small" value={String(value.lat)} onChange={(e) => onChange({ ...value, lat: e.target.value })} />
            <TextField label="Longitude" size="small" value={String(value.lng)} onChange={(e) => onChange({ ...value, lng: e.target.value })} />
            <TextField label="URL" size="small" value={value.url} onChange={(e) => onChange({ ...value, url: e.target.value })} fullWidth />
            <TextField label="Description" size="small" value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} fullWidth multiline minRows={2} />
            <Button type="submit" variant="contained">Save</Button>
        </Box>
    )
}
