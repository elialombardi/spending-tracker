import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import CloseIcon from '@mui/icons-material/Close'
import LocationMap from './LocationMap'

export default function TagLocationsDrawer({ open, onClose, selectedTag, locations = [], onCenter, center, draftLocation, onHighlight, highlightedId }) {
    const matches = selectedTag ? locations.filter((loc) => (loc.tags || []).includes(selectedTag)) : [];

    return (
        <Drawer anchor="left" open={open} onClose={onClose}>
            <Box sx={{ width: 360, p: 1, height: '100%', display: 'flex', flexDirection: 'column' }} role="presentation">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1 }}>
                    <Typography variant="h6">Locations: {selectedTag}</Typography>
                    <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
                </Box>
                <Divider sx={{ my: 1 }} />

                {/* Map area */}
                <Box sx={{ height: 300, mb: 1 }}>
                    <LocationMap locations={matches} center={center} onMapClick={(latlng) => onCenter && onCenter([latlng.lat, latlng.lng])} draftLocation={draftLocation} highlightedId={highlightedId} visible={open} />
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box sx={{ overflow: 'auto', flex: 1 }}>
                    <List>
                        {selectedTag ? (
                            matches.length === 0 ? (
                                <Box sx={{ p: 2 }}>No saved locations for this tag.</Box>
                            ) : (
                                matches.map((loc) => (
                                    <ListItemButton
                                        key={loc.id || `${loc.lat}-${loc.lng}`}
                                        onClick={() => { onCenter && onCenter([loc.lat, loc.lng]); }}
                                        onMouseEnter={() => { onHighlight && onHighlight(loc.id); onCenter && onCenter([loc.lat, loc.lng]); }}
                                        onMouseLeave={() => { onHighlight && onHighlight(null); }}
                                        selected={highlightedId === loc.id}
                                    >
                                        <ListItemText primary={loc.title} secondary={loc.description} />
                                    </ListItemButton>
                                ))
                            )
                        ) : (
                            <Box sx={{ p: 2 }}>No tag selected.</Box>
                        )}
                    </List>
                </Box>
            </Box>
        </Drawer>
    )
}
