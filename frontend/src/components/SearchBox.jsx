import { useState } from 'react';
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'
import Avatar from '@mui/material/Avatar'
import { GEOAPIFY_API_KEY, PLACE_SEARCH_PROVIDER } from '../config'

const SEARCH_RESULT_LIMIT = 8

function buildSearchRequest(query) {
    if (PLACE_SEARCH_PROVIDER === 'geoapify') {
        if (!GEOAPIFY_API_KEY) {
            throw new Error('Geoapify search is enabled, but VITE_GEOAPIFY_API_KEY is not configured.')
        }

        const params = new URLSearchParams({
            text: query,
            format: 'json',
            limit: String(SEARCH_RESULT_LIMIT),
            apiKey: GEOAPIFY_API_KEY,
        })

        return {
            url: `https://api.geoapify.com/v1/geocode/search?${params.toString()}`,
            init: { headers: { Accept: 'application/json' } },
        }
    }

    const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: String(SEARCH_RESULT_LIMIT),
    })

    return {
        url: `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        init: { headers: { Accept: 'application/json' } },
    }
}

function normalizeSearchResults(payload) {
    if (PLACE_SEARCH_PROVIDER === 'geoapify') {
        return Array.isArray(payload?.results)
            ? payload.results.map((result) => ({
                id: result.place_id,
                title: result.formatted,
                type: result.result_type ? result.result_type.replace('_', ' ') : '',
                lat: Number.parseFloat(result.lat),
                lng: Number.parseFloat(result.lon),
            }))
            : []
    }

    return Array.isArray(payload)
        ? payload.map((result) => ({
            id: result.place_id,
            title: result.display_name,
            type: result.type ? result.type.replace('_', ' ') : '',
            lat: Number.parseFloat(result.lat),
            lng: Number.parseFloat(result.lon),
        }))
        : []
}

function SearchBox({ onSelect }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleSearch = async (e) => {
        e?.preventDefault();
        const trimmedQuery = query.trim();

        if (!trimmedQuery) return;

        setErrorMessage('');
        setLoading(true);
        try {
            const request = buildSearchRequest(trimmedQuery);
            const res = await fetch(request.url, request.init);

            if (!res.ok) {
                throw new Error(`Place search failed with status ${res.status}.`)
            }

            const data = await res.json();
            setResults(normalizeSearchResults(data));
        } catch (error) {
            setResults([]);
            setErrorMessage(error instanceof Error ? error.message : 'Place search failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ mb: 2 }} aria-label="Place search">
            <form onSubmit={handleSearch}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField fullWidth placeholder="Search places (e.g. 'Times Square')" value={query} onChange={(e) => setQuery(e.target.value)} size="small" />
                    <Button type="submit" variant="contained" disabled={loading}>{loading ? 'Searching…' : 'Search'}</Button>
                </Box>
            </form>

            {errorMessage && (
                <Alert severity="error" sx={{ mt: 1 }}>
                    {errorMessage}
                </Alert>
            )}

            {results.length > 0 && (
                <List>
                    {results.map((r) => (
                        <ListItem key={r.id} disablePadding>
                            <ListItemButton onClick={() => onSelect({ title: r.title, lat: r.lat, lng: r.lng })}>
                                <ListItemIcon>
                                    <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                            <path d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z" fill="white" />
                                        </svg>
                                    </Avatar>
                                </ListItemIcon>
                                <ListItemText primary={r.title} secondary={r.type} />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            )}
        </Box>
    );
}

export default SearchBox;
