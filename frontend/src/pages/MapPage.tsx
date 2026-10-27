import { useMemo, useState } from 'react'
import {
    Alert, Box, Button, Chip, IconButton, InputAdornment, LinearProgress,
    List, ListItem, ListItemButton, Paper, Stack, TextField, Tooltip, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import SearchIcon from '@mui/icons-material/Search'
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap'
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined'
import { Link as RouterLink } from 'react-router-dom'
import { useListLocationsQuery, useCreateLocationMutation, useUpdateLocationMutation } from '../api/locationsApi'
import { useListTagsQuery } from '../api/locationTagsApi'
import type { Location, LocationPayload } from '../types/domain'
import { useAuthSession, canWrite, isAdmin } from '../auth'
import LocationFormDialog from '../components/Locations/LocationFormDialog'
import LocationMap from '../components/Locations/LocationMap'
import { filterLocations, isMappableLocation, UNTAGGED } from './mapLocations'

export default function MapPage() {
    const { session } = useAuthSession()
    const writable = canWrite(session)
    const [search, setSearch] = useState('')
    const [selectedTag, setSelectedTag] = useState<string | null>(null)
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [fitBoundsKey, setFitBoundsKey] = useState(0)
    const [formDialogOpen, setFormDialogOpen] = useState(false)
    const [editingLocation, setEditingLocation] = useState<Location | null>(null)
    const [appError, setAppError] = useState('')

    const {
        data: locations = [], error: locationsError, isLoading, isFetching, refetch: refetchLocations,
    } = useListLocationsQuery(undefined, { skip: !session })
    const { data: tags = [], error: tagsError, refetch: refetchTags } = useListTagsQuery(undefined, { skip: !session })
    const [createLocation] = useCreateLocationMutation()
    const [updateLocation] = useUpdateLocationMutation()

    const tagCounts = useMemo(() => {
        const counts = new Map<string, number>()
        for (const location of locations) {
            const locationTags = new Set((location.tags || []).filter(tag => tag.trim()))
            if (!locationTags.size) counts.set(UNTAGGED, (counts.get(UNTAGGED) || 0) + 1)
            for (const tag of locationTags) counts.set(tag, (counts.get(tag) || 0) + 1)
        }
        return counts
    }, [locations])
    const tagOptions = useMemo(
        () => [...new Set([...tags, ...locations.flatMap(location => location.tags || [])])]
            .filter(tag => tag.trim()).sort((a, b) => a.localeCompare(b)),
        [tags, locations],
    )
    const visibleLocations = useMemo(
        () => filterLocations(locations, search, selectedTag),
        [locations, search, selectedTag],
    )
    const mapLocations = useMemo(() => visibleLocations.filter(isMappableLocation), [visibleLocations])
    const selectedLocation = mapLocations.find(location => location.id === selectedId)
    const center = useMemo<[number, number] | undefined>(
        () => selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : undefined,
        [selectedLocation],
    )
    const hasFilters = Boolean(search.trim() || selectedTag)
    const missingCoordinates = visibleLocations.length - mapLocations.length

    function clearFilters() {
        setSearch('')
        setSelectedTag(null)
        setSelectedId(null)
    }

    function openForm(location: Location | null = null) {
        setEditingLocation(location)
        setAppError('')
        setFormDialogOpen(true)
    }

    async function handleFormSubmit(payload: LocationPayload) {
        setAppError('')
        try {
            if (editingLocation) {
                await updateLocation({ id: editingLocation.id, location: payload }).unwrap()
            } else {
                await createLocation(payload).unwrap()
                clearFilters()
            }
        } catch (error) {
            setAppError(error instanceof Error ? error.message : 'Unable to save this location. Please try again.')
            throw error
        }
    }

    return (
        <Stack spacing={2.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}>
                <Box>
                    <Typography variant="overline" color="primary" sx={{ letterSpacing: 2 }}>YOUR PLACES, AT A GLANCE</Typography>
                    <Typography component="h1" variant="h4" sx={{ fontWeight: 700 }}>Explore your places</Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                        Find a favorite, discover a connection, or save somewhere new.
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                    {isAdmin(session) && (
                        <Button component={RouterLink} to="/admin/tags" variant="outlined" startIcon={<LocalOfferOutlinedIcon />}>
                            Manage tags
                        </Button>
                    )}
                    {writable && (
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openForm()}>
                            Add location
                        </Button>
                    )}
                </Stack>
            </Stack>

            {appError && <Alert severity="error" onClose={() => setAppError('')}>{appError}</Alert>}
            {(locationsError || tagsError) && (
                <Alert severity="error" action={
                    <Button color="inherit" size="small" onClick={() => {
                        if (locationsError) void refetchLocations()
                        if (tagsError) void refetchTags()
                    }}>Retry</Button>
                }>
                    {locationsError ? 'Could not load your locations.' : 'Could not load all tags. You can still browse your saved places.'}
                </Alert>
            )}

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <TextField
                    fullWidth
                    size="small"
                    label="Search your places"
                    placeholder="Search by name, description, or tag"
                    value={search}
                    onChange={event => { setSearch(event.target.value); setSelectedId(null) }}
                    slotProps={{ input: {
                        startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
                        endAdornment: search ? (
                            <InputAdornment position="end">
                                <IconButton size="small" aria-label="Clear search" onClick={() => { setSearch(''); setSelectedId(null) }}>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ) : null,
                    } }}
                />
                <Stack direction="row" spacing={1} sx={{ mt: 2, overflowX: 'auto', pb: 0.5 }} aria-label="Filter by tag">
                    <Chip
                        label={`All places · ${locations.length}`}
                        color={selectedTag === null ? 'primary' : 'default'}
                        variant={selectedTag === null ? 'filled' : 'outlined'}
                        aria-pressed={selectedTag === null}
                        onClick={() => { setSelectedTag(null); setSelectedId(null) }}
                    />
                    {tagOptions.map(tag => (
                        <Chip
                            key={tag}
                            label={`${tag} · ${tagCounts.get(tag) || 0}`}
                            color={selectedTag === tag ? 'primary' : 'default'}
                            variant={selectedTag === tag ? 'filled' : 'outlined'}
                            aria-pressed={selectedTag === tag}
                            onClick={() => { setSelectedTag(selectedTag === tag ? null : tag); setSelectedId(null) }}
                        />
                    ))}
                    {!!tagCounts.get(UNTAGGED) && (
                        <Chip
                            label={`Untagged · ${tagCounts.get(UNTAGGED)}`}
                            color={selectedTag === UNTAGGED ? 'primary' : 'default'}
                            variant={selectedTag === UNTAGGED ? 'filled' : 'outlined'}
                            aria-pressed={selectedTag === UNTAGGED}
                            onClick={() => { setSelectedTag(selectedTag === UNTAGGED ? null : UNTAGGED); setSelectedId(null) }}
                        />
                    )}
                </Stack>
            </Paper>

            <Box sx={{
                display: 'grid', gridTemplateColumns: { xs: '1fr', md: '340px minmax(0, 1fr)' },
                gap: 2, height: { md: 'clamp(460px, calc(100dvh - 340px), 760px)' },
            }}>
                <Paper variant="outlined" sx={{
                    order: { xs: 2, md: 1 }, display: 'flex', flexDirection: 'column',
                    minHeight: 0, borderRadius: 3, overflow: 'hidden', maxHeight: { xs: 480, md: 'none' },
                }}>
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: 1, borderColor: 'divider' }}>
                        <Box aria-live="polite" role="status">
                            <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700 }}>
                                {isLoading ? 'Loading places...' : `${visibleLocations.length} ${visibleLocations.length === 1 ? 'place' : 'places'}`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {hasFilters ? `Matching your filters · ${locations.length} total` : 'Select a place to focus the map'}
                            </Typography>
                        </Box>
                        {hasFilters && (
                            <Tooltip title="Reset all filters">
                                <IconButton aria-label="Reset all filters" onClick={clearFilters}><FilterAltOffIcon fontSize="small" /></IconButton>
                            </Tooltip>
                        )}
                    </Stack>
                    {isFetching && <LinearProgress aria-label="Loading locations" />}
                    {!isLoading && !visibleLocations.length ? (
                        <Stack spacing={2} sx={{ alignItems: 'center', p: 4, textAlign: 'center', my: 'auto' }}>
                            <ExploreOutlinedIcon sx={{ fontSize: 44, color: 'text.secondary' }} />
                            <Typography variant="h6">
                                {locationsError ? 'Places are unavailable' : hasFilters ? 'No matching places' : 'Your next favorite starts here'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {locationsError ? 'Retry loading your locations using the message above.'
                                    : hasFilters ? 'Try another name or tag, or reset your filters.'
                                        : 'Save places you want to visit and keep them organized with tags.'}
                            </Typography>
                            {hasFilters ? <Button onClick={clearFilters}>Reset filters</Button>
                                : writable && !locationsError && <Button startIcon={<AddIcon />} onClick={() => openForm()}>Add your first location</Button>}
                        </Stack>
                    ) : (
                        <List aria-label="Saved places" sx={{ overflowY: 'auto', p: 1, minHeight: 0 }}>
                            {visibleLocations.map(location => (
                                <ListItem key={location.id} disablePadding sx={{ mb: 0.75, alignItems: 'flex-start' }}>
                                    <ListItemButton
                                        selected={selectedId === location.id}
                                        aria-pressed={selectedId === location.id}
                                        onClick={() => setSelectedId(location.id)}
                                        sx={{ borderRadius: 2, alignItems: 'flex-start', p: 1.5, minWidth: 0 }}
                                    >
                                        <LocationOnOutlinedIcon color={selectedId === location.id ? 'primary' : 'action'} sx={{ mr: 1, mt: 0.25 }} />
                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                            <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{location.title || 'Unnamed location'}</Typography>
                                            {location.description && <Typography variant="body2" color="text.secondary" sx={{
                                                mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere',
                                            }}>{location.description}</Typography>}
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, overflowWrap: 'anywhere' }}>
                                                {(location.tags || []).filter(tag => tag.trim()).join(' · ') || 'Untagged'}
                                            </Typography>
                                            {!isMappableLocation(location) && <Typography variant="caption" color="warning.main">Coordinates need updating</Typography>}
                                        </Box>
                                    </ListItemButton>
                                    {writable && <Tooltip title="Edit location">
                                        <IconButton size="small" aria-label={`Edit ${location.title || 'unnamed location'}`} onClick={() => openForm(location)} sx={{ mt: 1 }}>
                                            <EditOutlinedIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>}
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Paper>

                <Paper variant="outlined" sx={{
                    order: { xs: 1, md: 2 }, borderRadius: 3, overflow: 'hidden', minWidth: 0,
                    display: 'flex', flexDirection: 'column', height: { xs: 360, md: '100%' },
                }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}>
                        <Box>
                            <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 700 }}>On the map</Typography>
                            <Typography variant="caption" color="text.secondary">
                                {selectedLocation ? selectedLocation.title : `${mapLocations.length} ${mapLocations.length === 1 ? 'pin' : 'pins'} · Scroll to zoom, drag to explore`}
                            </Typography>
                        </Box>
                        <Button size="small" startIcon={<ZoomOutMapIcon />} disabled={!mapLocations.length} onClick={() => {
                            setSelectedId(null)
                            setFitBoundsKey(value => value + 1)
                        }} sx={{ flexShrink: 0 }}>Show all</Button>
                    </Stack>
                    {!!missingCoordinates && <Alert severity="warning" sx={{ borderRadius: 0 }}>
                        {missingCoordinates} {missingCoordinates === 1 ? 'place has' : 'places have'} invalid coordinates and cannot appear on the map.
                    </Alert>}
                    <Box sx={{ flex: 1, minHeight: 0, position: 'relative', isolation: 'isolate' }}>
                        <LocationMap
                            locations={mapLocations}
                            center={center}
                            centerZoom={selectedLocation ? 15 : undefined}
                            highlightedId={selectedId}
                            onSelectLocation={location => setSelectedId(Number(location.id))}
                            fitBoundsKey={fitBoundsKey}
                        />
                    </Box>
                </Paper>
            </Box>

            <LocationFormDialog
                open={formDialogOpen}
                onClose={() => { setFormDialogOpen(false); setEditingLocation(null) }}
                location={editingLocation}
                onSubmit={handleFormSubmit}
                tagOptions={tagOptions}
                mode={editingLocation ? 'edit' : 'add'}
            />
        </Stack>
    )
}
