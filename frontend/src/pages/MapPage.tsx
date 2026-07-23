import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import TagMultiSelect from '../components/TagMultiSelect'
import TagLocationsDrawer from '../components/TagLocationsDrawer'
import LocationMap from '../components/LocationMap'
import FilterButtons from '../components/FilterButtons'
import AddLocationDialog from '../components/AddLocationDialog'
import SearchBox from '../components/SearchBox'
import { useEffect, useMemo, useState, SyntheticEvent } from 'react'
import type { Location } from '../types/x'
import { Paper, Typography, List, ListItemButton, ListItemText } from '@mui/material'
import api from '../api'
import { useAuthSession } from '../auth'

interface Props {
    locations?: any[]
    tags?: string[]
    canWrite?: boolean
    onCreateLocation?: (loc: any) => Promise<any>
    onUpdateLocation?: (id: number, loc: any) => Promise<any>
    onDeleteLocation?: (id: number) => Promise<any>
}

const emptyLocation = {
    title: '',
    tags: [],
    lat: '',
    lng: '',
    description: '',
    url: '',
}

const defaultCenter: [number, number] = [41.9028, 12.4964]

export default function MapPage({ canWrite = false }: Props) {
    const { session } = useAuthSession()
    const [locations, setLocations] = useState<Location[]>([])
    const [tags, setTags] = useState<string[]>([])
    const [filter, setFilter] = useState('all')
    const [selectedTag, setSelectedTag] = useState<string | null>(null)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [newLocation, setNewLocation] = useState(emptyLocation)
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [center, setCenter] = useState<[number, number]>(defaultCenter)
    const [highlightedId, setHighlightedId] = useState<string | null>(null)
    const [appError, setAppError] = useState('')

    useEffect(() => {
        if (!session) return undefined

        let mounted = true
            ; (async () => {
                try {
                    // const [remoteLocations, remoteTags] = await Promise.all([api.listLocations(), api.listTags()])
                    const remoteLocations = await api.listLocations()
                    const remoteTags = await api.listTags()
                    if (!mounted) return
                    if (Array.isArray(remoteLocations)) setLocations(remoteLocations)
                    if (Array.isArray(remoteTags)) setTags(remoteTags)
                } catch (err: any) {
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

    function handleApiError(err: any, fallbackMessage?: string) {
        if (err?.code === 'AUTH_REQUIRED') return
        if (err?.code === 'FORBIDDEN') {
            setAppError('Your role does not allow that action.')
            return
        }
        setAppError(err instanceof Error ? err.message : (fallbackMessage ?? 'An error occurred.'))
    }



    const handleCreateFromDialog = async (payload: any) => {
        try {
            const created = await api.createLocation(payload as any)
            setLocations((current) => [...current, created || payload])
        } catch (err) {
            handleApiError(err, 'Failed to create the location.')
            throw err
        }
    }

    const filteredLocations = locations.filter((loc) => {
        if (filter === 'all') return true
        return (loc.tags || []).includes(filter)
    })

    // locations to show on the map: if a tag is selected show only that tag's locations

    // counts for tags so UI can show how many locations each tag has
    const tagCounts = tags.reduce<Record<string, number>>((acc, t) => {
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
                        {canWrite ? (
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

            <AddLocationDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} onSave={handleCreateFromDialog} tagOptions={tags} />
        </Box>
    )
}
