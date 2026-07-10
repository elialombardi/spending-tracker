import { useState } from 'react';
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'
import Avatar from '@mui/material/Avatar'

function SearchBox({ onSelect }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e) => {
        e?.preventDefault();
        if (!query) return;
        setLoading(true);
        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8`;
            const res = await fetch(url, { headers: { Accept: 'application/json' } });
            const data = await res.json();
            setResults(data);
        } catch {
            setResults([]);
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

            {results.length > 0 && (
                <List>
                    {results.map((r) => (
                        <ListItem key={r.place_id} disablePadding>
                            <ListItemButton onClick={() => onSelect({ title: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) })}>
                                <ListItemIcon>
                                    <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                            <path d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z" fill="white" />
                                        </svg>
                                    </Avatar>
                                </ListItemIcon>
                                <ListItemText primary={r.display_name} secondary={r.type ? r.type.replace('_', ' ') : ''} />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            )}
        </Box>
    );
}

export default SearchBox;
