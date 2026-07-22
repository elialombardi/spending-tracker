import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Alert from '@mui/material/Alert'
import TagLocationsDrawer from '../components/TagLocationsDrawer'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import FilterButtons from '../components/FilterButtons'
import SearchBox from '../components/SearchBox'
import LocationForm from '../components/form'
import AddLocationDialog from '../components/AddLocationDialog'
import Button from '@mui/material/Button'
import api from '../api'
import { useAuthSession, canWrite } from '../auth'

const emptyLocation = {
    title: '',
    tags: [],
    lat: '',
    lng: '',
    description: '',
    url: '',
}

const defaultCenter = [41.9028, 12.4964]

export default function MapPage() {
    const { session } = useAuthSession()
    const [locations, setLocations] = useState([])
    const [tags, setTags] = useState([])
    const [filter, setFilter] = useState('all')
    const [selectedTag, setSelectedTag] = useState(null)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [newLocation, setNewLocation] = useState(emptyLocation)
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [center, setCenter] = useState(defaultCenter)
    const [highlightedId, setHighlightedId] = useState(null)
    const [appError, setAppError] = useState('')

    useEffect(() => {
        if (!session) return undefined

        let mounted = true
            ; (async () => {
                try {
                    const [remoteLocations, remoteTags] = await Promise.all([api.listLocations(), api.listTags()])
                    if (!mounted) return
                    if (Array.isArray(remoteLocations)) setLocations(remoteLocations)
                    if (Array.isArray(remoteTags)) setTags(remoteTags)
                } catch (err) {
                    if (!mounted || err?.code === 'AUTH_REQUIRED') return
                    if (err?.code === 'FORBIDDEN') {
                        setAppError('Your account can sign in, but it cannot load the requested data.')
                        return
                    }
                    setAppError(err instanceof Error ? err.message : 'Failed to load data from the API.')
                }
            })()

        return () => {
            mounted = false
        }
    }, [session])

    function handleApiError(err, fallbackMessage) {
        if (err?.code === 'AUTH_REQUIRED') return
        if (err?.code === 'FORBIDDEN') {
            setAppError('Your role does not allow that action.')
            return
        }
        setAppError(err instanceof Error ? err.message : fallbackMessage)
    }

    const handleAddLocation = (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault()
        // kept for backwards-compat, but UI now uses AddLocationDialog
    }

    const handleCreateFromDialog = async (payload) => {
        try {
            const created = await api.createLocation(payload)
            setLocations((current) => [...current, created || payload])
        } catch (err) {
            handleApiError(err, 'Failed to create the location.')
            throw err
        }
    }

    const handleMapClick = (latlng) => {
        const { lat, lng } = latlng
        setNewLocation((cur) => ({ ...cur, lat: lat.toFixed(6), lng: lng.toFixed(6) }))
        setCenter([lat, lng])
    }

    const handleSelectPlace = ({ title, lat, lng }) => {
        setNewLocation((cur) => ({ ...cur, title: title || cur.title, lat, lng }))
        setCenter([lat, lng])
    }

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) return alert('Geolocation not supported in this browser or context')

        try {
            if (navigator.permissions && navigator.permissions.query) {
                navigator.permissions.query({ name: 'geolocation' }).then((res) => {
                    if (res.state === 'denied') return alert('Location access is denied. Please enable location permissions for this site.')
                }).catch((error) => {
                    console.debug('Unable to query geolocation permissions', error)
                })
            }
        } catch (error) {
            console.debug('Geolocation permissions API unavailable', error)
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude
                const lng = pos.coords.longitude
                const latStr = typeof lat === 'number' ? lat.toFixed(6) : String(lat)
                const lngStr = typeof lng === 'number' ? lng.toFixed(6) : String(lng)
                setNewLocation((cur) => ({ ...cur, lat: latStr, lng: lngStr }))
                setCenter([parseFloat(latStr), parseFloat(lngStr)])
            },
            (err) => {
                console.warn('geolocation error', err)
                if (err && err.code === 1) return alert('Permission denied. Please allow location access.')
                if (err && err.code === 3) return alert('Location request timed out. Try again.')
                return alert('Unable to retrieve your location')
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
    }

    const filteredLocations = locations.filter((loc) => {
        if (filter === 'all') return true
        return (loc.tags || []).includes(filter)
    })

    // locations to show on the map: if a tag is selected show only that tag's locations
    const mapLocations = selectedTag ? locations.filter((loc) => (loc.tags || []).includes(selectedTag)) : filteredLocations

    // counts for tags so UI can show how many locations each tag has
    const tagCounts = tags.reduce((acc, t) => {
        acc[t] = (locations.filter((loc) => (loc.tags || []).includes(t))).length;
        return acc;
    }, {})

    return (
        <Box sx={{ display: 'flex', gap: 2, height: { xs: 'auto', md: 'calc(100vh - 120px)' }, flexDirection: { xs: 'column', md: 'row' } }}>
            {/* Tags column */}
            <Box sx={{ width: { xs: '100%', md: 220 } }}>
                <Paper sx={{ p: 2, height: { xs: 'auto', md: '100%' }, mb: { xs: 2, md: 0 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="h6">Tags</Typography>
                        {canWrite(session) ? (
                            <Button size="small" variant="contained" onClick={() => setAddDialogOpen(true)}>Add location</Button>
                        ) : null}
                    </Box>
                    <List sx={{ maxHeight: '60vh', overflow: 'auto' }}>
                        {tags.map((t) => (
                            <ListItemButton key={t} selected={selectedTag === t} onClick={() => { setSelectedTag(t); setDrawerOpen(true); }}>
                                <ListItemText primary={t} secondary={`${tagCounts[t] || 0} locations`} />
                            </ListItemButton>
                        ))}
                    </List>
                </Paper>
            </Box>

            {/* Map column (open tag drawer to view map) */}
            <Box sx={{ flex: 2, minHeight: { xs: 300, md: 'auto' } }}>
                <Paper elevation={1} sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                    <Typography>Select a tag to view its locations and the map.</Typography>
                </Paper>
            </Box>

            {/* Right-side controls removed - Add location moved into Tags column */}

            {/* Drawer: list of locations for selected tag */}
            <TagLocationsDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                selectedTag={selectedTag}
                locations={locations}
                onCenter={(coord) => setCenter(coord)}
                center={center}
                draftLocation={newLocation}
                onHighlight={(id) => setHighlightedId(id)}
                highlightedId={highlightedId}
            />

            <AddLocationDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} onCreate={handleCreateFromDialog} tagOptions={tags} />
        </Box>
    )
}