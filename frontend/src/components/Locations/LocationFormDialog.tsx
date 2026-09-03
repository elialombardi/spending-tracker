// components/LocationFormDialog.js
import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import CloseIcon from '@mui/icons-material/Close'
import Alert from '@mui/material/Alert'
import MyLocationIcon from '@mui/icons-material/MyLocation'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import LocationMap from './LocationMap'
import SearchBox from './SearchBox'

const EMPTY_LOCATION = {
    title: '',
    description: '',
    tags: [],
    lat: '',
    lng: '',
    url: ''
}

// Helper to ensure center is a valid tuple
const DEFAULT_CENTER = [41.9028, 12.4964]

export default function LocationFormDialog({
    open,
    onClose,
    location = null,
    onSubmit,
    tagOptions = [],
    mode = 'add'
}) {
    const [formData, setFormData] = useState(EMPTY_LOCATION)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [center, setCenter] = useState(DEFAULT_CENTER)
    const [searchResults, setSearchResults] = useState([])
    const [highlightedSearchId, setHighlightedSearchId] = useState(null)
    const [centerZoom, setCenterZoom] = useState(undefined)

    const theme = useTheme()
    const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

    const dialogTitle = mode === 'edit' ? 'Edit Location' : 'Add New Location'
    const submitButtonText = mode === 'edit' ? 'Save Changes' : 'Add Location'
    const submittingText = mode === 'edit' ? 'Saving...' : 'Adding...'

    // Reset form when dialog opens or location changes
    useEffect(() => {
        if (open) {
            if (mode === 'edit' && location) {
                setFormData({
                    title: location.title || '',
                    description: location.description || '',
                    tags: Array.isArray(location.tags) ? location.tags : [],
                    lat: location.lat || '',
                    lng: location.lng || '',
                    url: location.url || ''
                })
                // Center map on the location being edited
                if (location.lat && location.lng) {
                    const lat = parseFloat(location.lat)
                    const lng = parseFloat(location.lng)
                    if (!isNaN(lat) && !isNaN(lng)) {
                        setCenter([lat, lng])
                    }
                }
            } else {
                setFormData(EMPTY_LOCATION)
                setCenter(DEFAULT_CENTER)
            }
            setError('')
            setSearchResults([])
            setHighlightedSearchId(null)
        }
    }, [open, location, mode])

    // Reset form when dialog closes
    useEffect(() => {
        if (!open) {
            setError('')
            setLoading(false)
            setSearchResults([])
            setHighlightedSearchId(null)
        }
    }, [open])

    // Handle zoom reset
    useEffect(() => {
        if (centerZoom !== undefined) {
            const t = setTimeout(() => setCenterZoom(undefined), 800)
            return () => clearTimeout(t)
        }
        return undefined
    }, [centerZoom])

    const handleSelectPlace = ({ title, lat, lng }) => {
        const latNum = parseFloat(lat)
        const lngNum = parseFloat(lng)
        setFormData((v) => ({ ...v, title: title || v.title, lat: String(latNum), lng: String(lngNum) }))
        if (!isNaN(latNum) && !isNaN(lngNum)) {
            setCenter([latNum, lngNum])
        }
        setCenterZoom(15)
    }

    const handleMapClick = (latlng) => {
        const { lat, lng } = latlng
        const latNum = parseFloat(lat)
        const lngNum = parseFloat(lng)
        setFormData((v) => ({ ...v, lat: lat.toFixed(6), lng: lng.toFixed(6) }))
        if (!isNaN(latNum) && !isNaN(lngNum)) {
            setCenter([latNum, lngNum])
        }
    }

    const handleSearchResults = (results) => {
        setSearchResults(results || [])
        if (Array.isArray(results) && results.length > 0) {
            const latLngs = results
                .map((r) => [parseFloat(r.lat), parseFloat(r.lng)])
                .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng))

            if (latLngs.length > 0) {
                const avgLat = latLngs.reduce((s, v) => s + v[0], 0) / latLngs.length
                const avgLng = latLngs.reduce((s, v) => s + v[1], 0) / latLngs.length
                setCenter([avgLat, avgLng])
            }
        }
    }

    const handleSearchHover = (id) => {
        setHighlightedSearchId(id)
        if (!id) return
        const r = searchResults.find((s) => s.id === id)
        if (r) {
            const lat = parseFloat(r.lat)
            const lng = parseFloat(r.lng)
            if (!isNaN(lat) && !isNaN(lng)) {
                setCenter([lat, lng])
                setCenterZoom(14)
            }
        }
    }

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation not supported in this browser')
            return
        }

        setLoading(true)
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude
                const lng = pos.coords.longitude
                setFormData(prev => ({
                    ...prev,
                    lat: typeof lat === 'number' ? lat.toFixed(6) : String(lat),
                    lng: typeof lng === 'number' ? lng.toFixed(6) : String(lng)
                }))
                if (!isNaN(lat) && !isNaN(lng)) {
                    setCenter([lat, lng])
                }
                setLoading(false)
                setError('')
                setCenterZoom(15)
            },
            (err) => {
                setLoading(false)
                if (err.code === 1) {
                    setError('Permission denied. Please allow location access.')
                } else if (err.code === 3) {
                    setError('Location request timed out. Try again.')
                } else {
                    setError('Unable to retrieve your location')
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!formData.title.trim()) {
            setError('Title is required')
            return
        }
        if (!formData.lat || !formData.lng) {
            setError('Latitude and longitude are required')
            return
        }
        if (isNaN(parseFloat(formData.lat)) || isNaN(parseFloat(formData.lng))) {
            setError('Latitude and longitude must be valid numbers')
            return
        }

        setLoading(true)
        setError('')

        try {
            const payload = {
                ...formData,
                lat: parseFloat(formData.lat),
                lng: parseFloat(formData.lng)
            }
            await onSubmit(payload)
            onClose()
        } catch (err) {
            setError(err.message || `Failed to ${mode === 'edit' ? 'update' : 'create'} location`)
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (field) => (event) => {
        setFormData(prev => ({
            ...prev,
            [field]: event.target.value
        }))
        if (error) setError('')
    }

    const handleTagChange = (event) => {
        setFormData(prev => ({
            ...prev,
            tags: event.target.value
        }))
        if (error) setError('')
    }

    // Get locations for map display
    const getMapLocations = () => {
        if (searchResults.length > 0) {
            return searchResults.map((r) => ({
                id: r.id,
                title: r.title,
                lat: parseFloat(r.lat),
                lng: parseFloat(r.lng),
                tags: []
            }))
        }
        if (formData.lat && formData.lng) {
            const lat = parseFloat(formData.lat)
            const lng = parseFloat(formData.lng)
            if (!isNaN(lat) && !isNaN(lng)) {
                return [{
                    id: 'draft',
                    title: formData.title || (mode === 'edit' ? 'Editing Location' : 'New Location'),
                    lat: lat,
                    lng: lng,
                    tags: formData.tags,
                    description: formData.description,
                    url: formData.url
                }]
            }
        }
        return []
    }

    // Render form fields
    const renderFormFields = () => (
        <>
            <TextField
                fullWidth
                margin="dense"
                label="Title"
                value={formData.title}
                onChange={handleChange('title')}
                required
                placeholder="Enter location title"
            />

            <TextField
                fullWidth
                margin="dense"
                label="Description"
                value={formData.description}
                onChange={handleChange('description')}
                multiline
                rows={2}
                placeholder="Enter description (optional)"
            />

            <FormControl fullWidth margin="dense">
                <InputLabel>Tags</InputLabel>
                <Select
                    multiple
                    value={formData.tags}
                    onChange={handleTagChange}
                    renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => (
                                <Chip key={value} label={value} size="small" />
                            ))}
                        </Box>
                    )}
                >
                    {tagOptions.map((tag) => (
                        <MenuItem key={tag} value={tag}>
                            {tag}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mt: 1 }}>
                <Box sx={{ flex: 1 }}>
                    <TextField
                        fullWidth
                        margin="dense"
                        label="Latitude"
                        value={formData.lat}
                        onChange={handleChange('lat')}
                        required
                        placeholder="41.9028"
                        type="number"
                        inputProps={{ step: "any" }}
                    />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <TextField
                        fullWidth
                        margin="dense"
                        label="Longitude"
                        value={formData.lng}
                        onChange={handleChange('lng')}
                        required
                        placeholder="12.4964"
                        type="number"
                        inputProps={{ step: "any" }}
                    />
                </Box>
            </Box>

            <Button
                size="small"
                startIcon={<MyLocationIcon />}
                onClick={handleUseCurrentLocation}
                disabled={loading}
                sx={{ mt: 1 }}
            >
                Use Current Location
            </Button>

            <TextField
                fullWidth
                margin="dense"
                label="URL"
                value={formData.url}
                onChange={handleChange('url')}
                placeholder="https://example.com (optional)"
                type="url"
            />
        </>
    )

    // Render map
    const renderMap = () => (
        <Box sx={{ height: { xs: 300, md: '100%' }, minHeight: 300 }}>
            <LocationMap
                locations={getMapLocations()}
                center={center}
                centerZoom={centerZoom}
                onMapClick={handleMapClick}
                draftLocation={null}
                highlightedId={highlightedSearchId}
                visible={open}
            />
        </Box>
    )

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            fullScreen={isSmall}
        >
            {isSmall ? (
                // Mobile version with full screen
                <>
                    <AppBar position="static">
                        <Toolbar>
                            <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close">
                                <CloseIcon />
                            </IconButton>
                            <Typography sx={{ ml: 2, flex: 1 }} variant="h6">{dialogTitle}</Typography>
                            <Button autoFocus color="inherit" onClick={handleSubmit} disabled={loading}>
                                {loading ? submittingText : submitButtonText}
                            </Button>
                        </Toolbar>
                    </AppBar>

                    <Box sx={{ p: 2, height: 'calc(100vh - 64px)', overflow: 'auto' }}>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                        <Accordion defaultExpanded>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>Search</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <SearchBox
                                    onSelect={handleSelectPlace}
                                    onResults={handleSearchResults}
                                    onHover={handleSearchHover}
                                />
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>Map</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                {renderMap()}
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>Form</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                {renderFormFields()}
                            </AccordionDetails>
                        </Accordion>
                    </Box>
                </>
            ) : (
                // Desktop version
                <>
                    <DialogTitle sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        pb: 1
                    }}>
                        {dialogTitle}
                        <IconButton onClick={onClose} size="small">
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>

                    <DialogContent sx={{ pt: 1 }}>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                        <Box
                            sx={{
                                display: 'grid',
                                gap: 2,
                                height: '100%',
                                minHeight: 500,
                                gridTemplateColumns: '1fr 1fr',
                                gridTemplateRows: 'auto 1fr',
                                gridTemplateAreas: `
                                    'search map'
                                    'form map'
                                `
                            }}
                        >
                            <Box sx={{ gridArea: 'search' }}>
                                <SearchBox
                                    onSelect={handleSelectPlace}
                                    onResults={handleSearchResults}
                                    onHover={handleSearchHover}
                                />
                            </Box>

                            <Box sx={{ gridArea: 'form', overflowY: 'auto', maxHeight: '100%' }}>
                                {renderFormFields()}
                            </Box>

                            <Box sx={{ gridArea: 'map', minHeight: 400 }}>
                                {renderMap()}
                            </Box>
                        </Box>
                    </DialogContent>

                    <DialogActions sx={{ p: 2, pt: 0 }}>
                        <Button onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            variant="contained"
                            color="primary"
                            disabled={loading}
                        >
                            {loading ? submittingText : submitButtonText}
                        </Button>
                    </DialogActions>
                </>
            )}
        </Dialog>
    )
}