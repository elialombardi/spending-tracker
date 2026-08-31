import React, { useEffect, useState } from 'react'
import TagMultiSelect from './TagMultiSelect';
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'

function LocationForm({ value, onChange, onSubmit, tagOptions = [] }) {
    const [error, setError] = useState('')

    const handleFieldChange = (field) => (event) => {
        onChange({ ...value, [field]: event.target.value });
    };

    useEffect(() => {
        if (value && value.lat && value.lng) setError('')
    }, [value?.lat, value?.lng])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!value || value.lat == null || value.lng == null || value.lat === '' || value.lng === '') {
            setError('select a location on the map')
            return
        }
        setError('')
        onSubmit && onSubmit()
    }

    return (
        <Box sx={{ mt: 2 }}>
            <form onSubmit={handleSubmit}>
                <Stack spacing={2} sx={{ width: '100%' }}>
                    {error && <Alert severity="error">{error}</Alert>}

                    <TextField
                        fullWidth
                        label="Title"
                        value={value.title || ''}
                        onChange={handleFieldChange('title')}
                        required
                    />

                    <Box sx={{ width: '100%' }}>
                        <TagMultiSelect
                            options={tagOptions}
                            value={value.tags || []}
                            onChange={(tags) => onChange({ ...value, tags })}
                            placeholder="Tags"
                        />
                    </Box>

                    <TextField
                        fullWidth
                        label="Description"
                        value={value.description || ''}
                        onChange={handleFieldChange('description')}
                    />

                    <TextField
                        fullWidth
                        label="URL"
                        value={value.url || ''}
                        onChange={handleFieldChange('url')}
                        placeholder="https://example.com"
                    />

                    <Button type="submit" variant="contained" fullWidth>
                        Add Location
                    </Button>
                </Stack>
            </form>
        </Box>
    );
}

export default LocationForm;