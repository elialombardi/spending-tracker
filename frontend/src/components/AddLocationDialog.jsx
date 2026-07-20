import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import CloseIcon from '@mui/icons-material/Close'
import SearchBox from './SearchBox'
import LocationForm from './form'
import LocationMap from './LocationMap'

export default function AddLocationDialog({ open, onClose, onCreate, tagOptions = [] }) {
    const empty = { title: '', tags: [], lat: '', lng: '', description: '', url: '' }
    const [value, setValue] = useState(empty)
    const [center, setCenter] = useState([41.9028, 12.4964])
    const [searchResults, setSearchResults] = useState([])
    const [highlightedSearchId, setHighlightedSearchId] = useState(null)
    const [centerZoom, setCenterZoom] = useState(undefined)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (open) {
            setValue(empty)
            setCenter([41.9028, 12.4964])
        }
    }, [open])

    const handleSelectPlace = ({ title, lat, lng }) => {
        setValue((v) => ({ ...v, title: title || v.title, lat, lng }))
        setCenter([lat, lng])
        // zoom in when a single result is selected
        setCenterZoom(15)
    }

    useEffect(() => {
        if (centerZoom !== undefined) {
            const t = setTimeout(() => setCenterZoom(undefined), 800)
            return () => clearTimeout(t)
        }
        return undefined
    }, [centerZoom])

    const handleMapClick = (latlng) => {
        const { lat, lng } = latlng
        setValue((v) => ({ ...v, lat: lat.toFixed(6), lng: lng.toFixed(6) }))
        setCenter([lat, lng])
    }

    const handleSearchResults = (results) => {
        setSearchResults(results || [])
        if (Array.isArray(results) && results.length > 0) {
            // fit map to all results
            const latLngs = results.map((r) => [r.lat, r.lng])
            if (latLngs.length > 0) {
                // compute approximate center
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
            setCenter([r.lat, r.lng])
            // slightly zoom when hovering
            setCenterZoom(14)
        }
    }

    const handleSubmit = async () => {
        setIsSaving(true)
        try {
            const payload = { ...value, lat: parseFloat(value.lat), lng: parseFloat(value.lng) }
            if (!onCreate) throw new Error('No onCreate handler')
            await onCreate(payload)
            onClose && onClose()
        } catch (err) {
            console.error('Failed to create location', err)
            alert(err instanceof Error ? err.message : 'Failed to create location')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog fullScreen open={open} onClose={onClose}>
            <AppBar position="static">
                <Toolbar>
                    <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close">
                        <CloseIcon />
                    </IconButton>
                    <Typography sx={{ ml: 2, flex: 1 }} variant="h6">Add Location</Typography>
                    <Button autoFocus color="inherit" onClick={handleSubmit} disabled={isSaving}>Save</Button>
                </Toolbar>
            </AppBar>

            <Box
                sx={{
                    p: 2,
                    height: 'calc(100vh - 64px)',
                    overflow: 'hidden',
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        gap: 2,
                        height: '100%',
                        flexDirection: { xs: 'column', md: 'row' },
                    }}
                >
                    <Box
                        sx={{
                            width: { xs: '100%', md: 420 },
                            minWidth: 0,
                            overflowY: 'auto',
                            flexShrink: 0,
                        }}
                    >
                        <SearchBox onSelect={handleSelectPlace} onResults={handleSearchResults} onHover={handleSearchHover} />

                        <Box sx={{ mt: 2 }}>
                            <LocationForm value={value} onChange={setValue} onSubmit={handleSubmit} tagOptions={tagOptions} />
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            minHeight: { xs: 360, md: 0 },
                            height: '100%',
                        }}
                    >
                        <Box sx={{ height: '100%', minHeight: { xs: 360, md: 0 } }}>
                            <LocationMap
                                locations={searchResults.length > 0 ? searchResults.map((r) => ({ id: r.id, title: r.title, lat: r.lat, lng: r.lng, tags: [] })) : (value.lat && value.lng ? [{ id: 'draft', title: value.title, lat: parseFloat(value.lat), lng: parseFloat(value.lng), tags: value.tags, description: value.description, url: value.url }] : [])}
                                center={center}
                                centerZoom={centerZoom}
                                onMapClick={handleMapClick}
                                draftLocation={null}
                                highlightedId={highlightedSearchId}
                                visible={open}
                            />
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Dialog>
    )
}
