import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import LocationMap from './Locations/LocationMap'

// Special key to represent "no tags"
const UNTAGGED = '__untagged__'

// Helper function to check if a location has no tags
const hasNoTags = (loc) => {
    return !loc.tags ||
        !Array.isArray(loc.tags) ||
        loc.tags.length === 0 ||
        (loc.tags.length === 1 && loc.tags[0] === '')
}

export default function TagLocationsDrawer({
    open,
    onClose,
    selectedTag,
    locations = [],
    onCenter,
    center,
    draftLocation,
    onHighlight,
    highlightedId,
    centerZoom = 13,
    onEditLocation // New prop for edit callback
}) {
    // Filter locations based on selected tag
    const matches = selectedTag
        ? selectedTag === UNTAGGED
            ? locations.filter((loc) => hasNoTags(loc))
            : locations.filter((loc) => (loc.tags || []).includes(selectedTag))
        : [];

    // Get display name for the tag
    const getTagDisplayName = () => {
        if (selectedTag === UNTAGGED) return 'Untagged'
        return selectedTag || 'No tag selected'
    }

    return (
        <Drawer anchor="left" open={open} onClose={onClose}>
            <Box sx={{ width: 360, p: 1, height: '100%', display: 'flex', flexDirection: 'column' }} role="presentation">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1 }}>
                    <Typography variant="h6">
                        Locations: {getTagDisplayName()}
                        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                            ({matches.length} {matches.length === 1 ? 'location' : 'locations'})
                        </Typography>
                    </Typography>
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>
                <Divider sx={{ my: 1 }} />

                {/* Map area */}
                <Box sx={{ height: 300, mb: 1 }}>
                    <LocationMap
                        locations={matches}
                        center={center}
                        onMapClick={(latlng) => onCenter && onCenter([latlng.lat, latlng.lng])}
                        draftLocation={draftLocation}
                        highlightedId={highlightedId}
                        visible={open}
                        centerZoom={centerZoom}
                    />
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box sx={{ overflow: 'auto', flex: 1 }}>
                    <List>
                        {selectedTag ? (
                            matches.length === 0 ? (
                                <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                                    <Typography variant="body1">No saved locations for this tag.</Typography>
                                    <Typography variant="body2" sx={{ mt: 1 }}>
                                        Click on the map to add a new location.
                                    </Typography>
                                </Box>
                            ) : (
                                matches.map((loc) => (
                                    <Box
                                        key={loc.id || loc._id || `${loc.lat}-${loc.lng}`}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            '&:hover': {
                                                backgroundColor: 'action.hover',
                                            },
                                            ...(highlightedId === (loc.id || loc._id) && {
                                                backgroundColor: 'action.selected',
                                            })
                                        }}
                                    >
                                        <ListItemButton
                                            onClick={() => {
                                                onCenter && onCenter([loc.lat, loc.lng]);
                                                onHighlight && onHighlight(loc.id || loc._id);
                                            }}
                                            onMouseEnter={() => {
                                                onHighlight && onHighlight(loc.id || loc._id);
                                                onCenter && onCenter([loc.lat, loc.lng]);
                                            }}
                                            onMouseLeave={() => {
                                                onHighlight && onHighlight(null);
                                            }}
                                            selected={highlightedId === (loc.id || loc._id)}
                                            sx={{ flex: 1 }}
                                        >
                                            <ListItemText
                                                primary={loc.title || loc.name || 'Unnamed Location'}
                                                secondary={loc.description}
                                            />
                                        </ListItemButton>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation(); // Prevent triggering the ListItemButton click
                                                onEditLocation && onEditLocation(loc);
                                            }}
                                            sx={{ mr: 1 }}
                                            aria-label="edit location"
                                        >
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                ))
                            )
                        ) : (
                            <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                                <Typography variant="body1">No tag selected.</Typography>
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                    Select a tag from the list to view its locations.
                                </Typography>
                            </Box>
                        )}
                    </List>
                </Box>
            </Box>
        </Drawer>
    )
}