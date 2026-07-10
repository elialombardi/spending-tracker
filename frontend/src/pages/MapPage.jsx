import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Alert from '@mui/material/Alert'
import LocationMap from '../components/LocationMap'
import FilterButtons from '../components/FilterButtons'
import SearchBox from '../components/SearchBox'
import LocationForm from '../components/form'

export default function MapPage({
    canWrite,
    filteredLocations,
    tags,
    filter,
    setFilter,
    newLocation,
    setNewLocation,
    handleAddLocation,
    handleMapClick,
    handleSelectPlace,
    handleUseCurrentLocation,
    center,
}) {
    return (
        <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 2 }}>
                <Paper elevation={1} sx={{ height: '100%' }}>
                    <LocationMap locations={filteredLocations} center={center} onMapClick={handleMapClick} draftLocation={newLocation} />
                </Paper>
            </Box>

            <Box sx={{ width: { xs: '100%', md: 360 } }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Paper sx={{ p: 2 }}>
                        <FilterButtons filter={filter} onFilterChange={setFilter} onUseCurrentLocation={handleUseCurrentLocation} tags={tags} />
                        <SearchBox onSelect={handleSelectPlace} />
                    </Paper>

                    <Paper sx={{ p: 2 }}>
                        {canWrite ? (
                            <LocationForm value={newLocation} onChange={setNewLocation} onSubmit={handleAddLocation} tagOptions={tags} />
                        ) : (
                            <Alert severity="info">
                                Reader accounts can browse saved locations, but adding locations requires a Writer or Admin role.
                            </Alert>
                        )}
                    </Paper>
                </Box>
            </Box>
        </Box>
    )
}
