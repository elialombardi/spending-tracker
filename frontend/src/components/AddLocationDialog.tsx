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
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

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
                    p: { xs: 3, md: 2 },
                    height: 'calc(100vh - 64px)',
                    overflow: 'auto',
                    WebkitOverflowScrolling: 'touch',
                }}
            >
                <Box sx={{ height: '100%' }}>
                    {
                        (() => {
                            const theme = useTheme()
                            const isSmall = useMediaQuery(theme.breakpoints.down('sm'))
                            if (isSmall) {
                                return (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <Accordion defaultExpanded>
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
                                                <Typography>Search</Typography>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ p: 2 }}>
                                                <SearchBox onSelect={handleSelectPlace} onResults={handleSearchResults} onHover={handleSearchHover} />
                                            </AccordionDetails>
                                        </Accordion>

                                        <Accordion>
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
                                                <Typography>Map</Typography>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ p: 2 }}>
                                                <Box sx={{ height: 360 }}>
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
                                            </AccordionDetails>
                                        </Accordion>


                                        <Accordion>
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
                                                <Typography>Form</Typography>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ p: 2 }}>
                                                <LocationForm value={value} onChange={setValue} onSubmit={handleSubmit} tagOptions={tagOptions} />
                                            </AccordionDetails>
                                        </Accordion>

                                    </Box>
                                )
                            }

                            return (
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gap: { xs: 2.5, md: 2 },
                                        height: '100%',
                                        gridTemplateColumns: { xs: '1fr', md: '420px 1fr' },
                                        gridTemplateRows: { xs: 'auto auto auto', md: '1fr 1fr' },
                                        gridTemplateAreas: {
                                            xs: `'search' 'form' 'map'`,
                                            md: `'search map' 'form map'`,
                                        },
                                    }}
                                >
                                    <Box sx={{ gridArea: 'search', overflowY: 'auto', maxHeight: { xs: '50vh', md: 'none' }, pr: { xs: 1, md: 0 } }}>
                                        <SearchBox onSelect={handleSelectPlace} onResults={handleSearchResults} onHover={handleSearchHover} />
                                    </Box>
                                    <Box sx={{ gridArea: 'form', overflowY: 'auto', pr: { xs: 1, md: 0 }, pb: { xs: 2, md: 0 } }}>
                                        <LocationForm value={value} onChange={setValue} onSubmit={handleSubmit} tagOptions={tagOptions} />
                                    </Box>

                                    <Box sx={{ gridArea: 'map', minHeight: { xs: 320, md: 0 }, height: { xs: 'auto', md: '100%' }, mt: { xs: 1, md: 0 } }}>
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
                            )
                        })()
                    }
                </Box>
            </Box>
        </Dialog>
    )
}
