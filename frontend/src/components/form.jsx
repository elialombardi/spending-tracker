import TagMultiSelect from './TagMultiSelect';
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'

function LocationForm({ value, onChange, onSubmit, tagOptions = [] }) {
    const handleFieldChange = (field) => (event) => {
        onChange({ ...value, [field]: event.target.value });
    };

    return (
        <Box sx={{ mt: 2 }}>
            <form onSubmit={(e) => { e.preventDefault(); onSubmit && onSubmit(); }}>
                <Grid container spacing={1}>
                    <Grid xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Title" value={value.title || ''}
                            onChange={handleFieldChange('title')}
                            required
                            size="small" />
                    </Grid>
                    <Grid xs={12} md={6}>
                        <TagMultiSelect
                            options={tagOptions}
                            value={value.tags || []}
                            onChange={(tags) => onChange({ ...value, tags })}
                            placeholder="Tags" />
                    </Grid>

                    <Grid xs={12} md={6}>
                        <TextField fullWidth label="Latitude" type="number" value={value.lat || ''} onChange={handleFieldChange('lat')} required size="small" />
                    </Grid>
                    <Grid xs={12} md={6}>
                        <TextField fullWidth label="Longitude" type="number" value={value.lng || ''} onChange={handleFieldChange('lng')} required size="small" />
                    </Grid>

                    <Grid xs={12}>
                        <TextField fullWidth label="Description" value={value.description || ''} onChange={handleFieldChange('description')} size="small" />
                    </Grid>

                    <Grid xs={12}>
                        <TextField fullWidth label="URL" value={value.url || ''} onChange={handleFieldChange('url')} size="small" placeholder="https://example.com" />
                    </Grid>

                    <Grid xs={12}>
                        <Button type="submit" variant="contained">Add Location</Button>
                    </Grid>
                </Grid>
            </form>
        </Box>
    );
}

export default LocationForm;