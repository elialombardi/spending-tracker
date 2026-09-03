// MapPage.js
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TagLocationsDrawer from '../components/TagLocationsDrawer'
import Typography from '@mui/material/Typography'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Button from '@mui/material/Button'
import { useListLocationsQuery, useCreateLocationMutation, useUpdateLocationMutation } from '../api/locationsApi'
import { useListTagsQuery } from '../api/locationTagsApi'
import { LocationPayload } from '../types/domain'
import { useAuthSession, canWrite } from '../auth'
import LocationFormDialog from '../components/Locations/LocationFormDialog'

const defaultCenter = [41.9028, 12.4964]
const UNTAGGED = '__untagged__'

export default function MapPage() {
    const { session } = useAuthSession()
    const [locations, setLocations] = useState([])
    const [tags, setTags] = useState([])
    const [filter, setFilter] = useState('all')
    const [selectedTag, setSelectedTag] = useState(null)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [formDialogOpen, setFormDialogOpen] = useState(false)
    const [editingLocation, setEditingLocation] = useState(null)
    const [center, setCenter] = useState(defaultCenter)
    const [highlightedId, setHighlightedId] = useState(null)
    const [appError, setAppError] = useState('')

    const { data: remoteLocations, error: locationsError } = useListLocationsQuery(undefined, { skip: !session })
    const { data: remoteTags, error: tagsError } = useListTagsQuery(undefined, { skip: !session })

    useEffect(() => {
        if (!session) return undefined
        if (Array.isArray(remoteLocations)) setLocations(remoteLocations)
        if (Array.isArray(remoteTags)) setTags(remoteTags)
        if (locationsError || tagsError) {
            handleApiError(locationsError || tagsError, 'Failed to load data from the API.')
        }
        return undefined
    }, [session, remoteLocations, remoteTags, locationsError, tagsError])

    function handleApiError(err, fallbackMessage) {
        if (err?.code === 'AUTH_REQUIRED') return
        if (err?.code === 'FORBIDDEN') {
            setAppError('Your role does not allow that action.')
            return
        }
        setAppError(err instanceof Error ? err.message : fallbackMessage)
    }

    const [createLocation] = useCreateLocationMutation()
    const [updateLocation] = useUpdateLocationMutation()

    // Handler for creating a location
    const handleCreateLocation = async (payload) => {
        try {
            const created = await createLocation(payload).unwrap()
            setLocations((current) => [...current, created || payload])
        } catch (err) {
            handleApiError(err, 'Failed to create the location.')
            throw err
        }
    }

    // Handler for editing a location
    const handleEditLocation = (location) => {
        setEditingLocation(location)
        setFormDialogOpen(true)
    }

    // Handler for updating a location
    const handleUpdateLocation = async (payload) => {
        try {
            const updated = await updateLocation({ id: editingLocation.id, ...payload }).unwrap()
            setLocations((current) =>
                current.map((loc) =>
                    (loc.id || loc._id) === (editingLocation.id || editingLocation._id)
                        ? updated || { ...loc, ...payload }
                        : loc
                )
            )
            setEditingLocation(null)
        } catch (err) {
            handleApiError(err, 'Failed to update the location.')
            throw err
        }
    }

    // Handle form submission (both add and edit)
    const handleFormSubmit = async (payload) => {
        if (editingLocation) {
            await handleUpdateLocation(payload)
        } else {
            await handleCreateLocation(payload)
        }
    }

    const handleOpenAddDialog = () => {
        setEditingLocation(null)
        setFormDialogOpen(true)
    }

    const handleCloseFormDialog = () => {
        setFormDialogOpen(false)
        setEditingLocation(null)
    }

    // Helper function to check if a location has no tags
    const hasNoTags = (loc) => {
        return !loc.tags ||
            !Array.isArray(loc.tags) ||
            loc.tags.length === 0 ||
            (loc.tags.length === 1 && loc.tags[0] === '')
    }

    const filteredLocations = locations.filter((loc) => {
        if (filter === 'all') return true
        return (loc.tags || []).includes(filter)
    })

    const mapLocations = selectedTag
        ? locations.filter((loc) => {
            if (selectedTag === UNTAGGED) {
                return hasNoTags(loc)
            }
            return (loc.tags || []).includes(selectedTag)
        })
        : filteredLocations

    const tagCounts = tags.reduce((acc, t) => {
        acc[t] = (locations.filter((loc) => (loc.tags || []).includes(t))).length;
        return acc;
    }, {})

    const untaggedCount = locations.filter(loc => hasNoTags(loc)).length;
    tagCounts[UNTAGGED] = untaggedCount;

    const drawerLocations = selectedTag === UNTAGGED
        ? locations.filter(loc => hasNoTags(loc))
        : selectedTag
            ? locations.filter(loc => (loc.tags || []).includes(selectedTag))
            : [];

    // Debug logging
    useEffect(() => {
        console.log('Locations:', locations)
        console.log('Untagged count:', untaggedCount)
        console.log('Drawer locations:', drawerLocations)
        console.log('Selected tag:', selectedTag)
    }, [locations, untaggedCount, drawerLocations, selectedTag])

    return (
        <Box sx={{ display: 'flex', gap: 2, height: { xs: 'auto', md: 'calc(100vh - 120px)' }, flexDirection: { xs: 'column', md: 'row' } }}>
            {/* Tags column */}
            <Box sx={{ width: { xs: '100%', md: 220 } }}>
                <Paper sx={{ p: 2, height: { xs: 'auto', md: '100%' }, mb: { xs: 2, md: 0 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="h6">Tags</Typography>
                        {canWrite(session) ? (
                            <Button size="small" variant="contained" onClick={handleOpenAddDialog}>
                                Add location
                            </Button>
                        ) : null}
                    </Box>
                    <List sx={{ maxHeight: '60vh', overflow: 'auto' }}>
                        {tags.map((t) => (
                            <ListItemButton key={t} selected={selectedTag === t} onClick={() => { setSelectedTag(t); setDrawerOpen(true); }}>
                                <ListItemText primary={t} secondary={`${tagCounts[t] || 0} locations`} />
                            </ListItemButton>
                        ))}
                        {untaggedCount > 0 && (
                            <ListItemButton
                                key={UNTAGGED}
                                selected={selectedTag === UNTAGGED}
                                onClick={() => { setSelectedTag(UNTAGGED); setDrawerOpen(true); }}
                            >
                                <ListItemText primary="Untagged" secondary={`${untaggedCount} locations`} />
                            </ListItemButton>
                        )}
                    </List>
                </Paper>
            </Box>

            {/* Map column */}
            <Box sx={{ flex: 2, minHeight: { xs: 300, md: 'auto' } }}>
                <Paper elevation={1} sx={{ height: { xs: 'auto', md: '100%' }, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                    <Typography>Select a tag to view its locations and the map.</Typography>
                </Paper>
            </Box>

            {/* Drawer */}
            <TagLocationsDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                selectedTag={selectedTag}
                locations={drawerLocations}
                onCenter={(coord) => setCenter(coord)}
                center={center}
                draftLocation={null}
                onHighlight={(id) => setHighlightedId(id)}
                highlightedId={highlightedId}
                onEditLocation={handleEditLocation}
            />

            {/* Single dialog for both add and edit */}
            <LocationFormDialog
                open={formDialogOpen}
                onClose={handleCloseFormDialog}
                location={editingLocation}
                onSubmit={handleFormSubmit}
                tagOptions={tags}
                mode={editingLocation ? 'edit' : 'add'}
            />
        </Box>
    )
}