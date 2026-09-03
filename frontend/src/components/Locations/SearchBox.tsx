import { useState, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { PLACE_SEARCH_PROVIDER } from '../../config';
import { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { useGetGeocodeSearchQuery } from '../../api/geoapifyApi';

const SEARCH_RESULT_LIMIT = 8;

// Type definitions
interface SearchResult {
    id: string | number;
    title: string;
    type: string;
    lat: number;
    lng: number;
}

interface GeoapifyResult {
    place_id: string;
    formatted: string;
    result_type?: string;
    lat: string;
    lon: string;
}

interface GeoapifyResponse {
    results: GeoapifyResult[];
}

interface NominatimResult {
    place_id: string;
    display_name: string;
    type?: string;
    lat: string;
    lon: string;
}

// Helper to normalize results
function normalizeSearchResults(payload: GeoapifyResponse | NominatimResult[] | any): SearchResult[] {
    if (PLACE_SEARCH_PROVIDER === 'geoapify') {
        const geoPayload = payload as GeoapifyResponse;
        return Array.isArray(geoPayload?.results)
            ? geoPayload.results.map((result) => ({
                id: result.place_id,
                title: result.formatted,
                type: result.result_type ? result.result_type.replace('_', ' ') : '',
                lat: Number.parseFloat(result.lat),
                lng: Number.parseFloat(result.lon),
            }))
            : [];
    }

    // Nominatim fallback
    const nomPayload = payload as NominatimResult[];
    return Array.isArray(nomPayload)
        ? nomPayload.map((result) => ({
            id: result.place_id,
            title: result.display_name,
            type: result.type ? result.type.replace('_', ' ') : '',
            lat: Number.parseFloat(result.lat),
            lng: Number.parseFloat(result.lon),
        }))
        : [];
}

interface SearchBoxProps {
    onSelect: (location: { title: string; lat: number; lng: number }) => void;
    onResults?: (results: SearchResult[]) => void;
    onHover?: (id: string | number | null) => void;
}

function SearchBox({ onSelect, onResults, onHover }: SearchBoxProps) {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [errorMessage, setErrorMessage] = useState('');

    // Debounce the search query to avoid excessive API calls
    useEffect(() => {
        const timer = setTimeout(() => {
            const trimmed = query.trim();
            if (trimmed && trimmed.length >= 2) {
                setDebouncedQuery(trimmed);
            } else {
                setDebouncedQuery('');
                setResults([]);
                if (onResults) onResults([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, onResults]);

    // Use RTK Query hook for geocoding search
    const { data, isLoading, error, isFetching } = useGetGeocodeSearchQuery(
        {
            text: debouncedQuery,
            format: 'json',
            limit: SEARCH_RESULT_LIMIT,
        },
        {
            skip: !debouncedQuery || PLACE_SEARCH_PROVIDER !== 'geoapify',
        }
    );

    // Update results when data changes
    useEffect(() => {
        if (data) {
            const normalized = normalizeSearchResults(data);
            setResults(normalized);
            if (onResults) onResults(normalized);
            setErrorMessage('');
        }
    }, [data, onResults]);

    // Handle errors - FIXED with proper type checking
    useEffect(() => {
        if (error) {
            setResults([]);
            if (onResults) onResults([]);

            let message = 'Place search failed.';

            // Type guard to check if error is FetchBaseQueryError
            const isFetchBaseQueryError = (err: any): err is FetchBaseQueryError => {
                return err && typeof err === 'object' && 'status' in err;
            };

            // Type guard to check if error is SerializedError
            const isSerializedError = (err: any): err is { message?: string } => {
                return err && typeof err === 'object' && 'message' in err;
            };

            if (isFetchBaseQueryError(error)) {
                // Handle FetchBaseQueryError
                if (error.data && typeof error.data === 'object' && 'error' in error.data) {
                    message = (error.data as any).error;
                } else if (typeof error.data === 'string') {
                    message = error.data;
                } else if (error.status) {
                    message = `Request failed with status ${error.status}`;
                }
            } else if (isSerializedError(error)) {
                // Handle SerializedError
                if (error.message) {
                    message = error.message;
                }
            } else if (typeof error === 'string') {
                message = error;
            }

            setErrorMessage(message);
        }
    }, [error, onResults]);

    const handleSearch = (e: React.FormEvent) => {
        e?.preventDefault();
        const trimmed = query.trim();
        if (trimmed) {
            setDebouncedQuery(trimmed);
        }
    };

    const handleSelect = (result: SearchResult) => {
        if (onSelect) {
            onSelect({
                title: result.title,
                lat: result.lat,
                lng: result.lng,
            });
        }
        // Optional: Clear results after selection
        // setResults([]);
        // setQuery('');
    };

    const loading = isLoading || isFetching;

    return (
        <Box sx={{ mb: 2 }} aria-label="Place search">
            <form onSubmit={handleSearch}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        fullWidth
                        placeholder="Search places (e.g. 'Times Square')"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        size="small"
                    />
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={loading || !query.trim()}
                    >
                        {loading ? 'Searching…' : 'Search'}
                    </Button>
                </Box>
            </form>

            {errorMessage && (
                <Alert severity="error" sx={{ mt: 1 }}>
                    {errorMessage}
                </Alert>
            )}

            {results.length > 0 && !loading && (
                <>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, mt: 1 }}>
                        <Chip label={`${results.length} result${results.length !== 1 ? 's' : ''}`} size="small" />
                    </Box>
                    <List>
                        {results.map((r) => (
                            <ListItem key={r.id} disablePadding>
                                <ListItemButton
                                    onClick={() => handleSelect(r)}
                                    onMouseEnter={() => onHover && onHover(r.id)}
                                    onMouseLeave={() => onHover && onHover(null)}
                                    sx={{ py: { xs: 1.5, md: 0.5 }, px: { xs: 1.25, md: 0.5 } }}
                                >
                                    <ListItemText primary={r.title} secondary={r.type} />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                </>
            )}

            {/* Show loading state while fetching */}
            {loading && debouncedQuery && (
                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
                    <Alert severity="info" icon={false}>
                        Searching for "{debouncedQuery}"...
                    </Alert>
                </Box>
            )}
        </Box>
    );
}

export default SearchBox;