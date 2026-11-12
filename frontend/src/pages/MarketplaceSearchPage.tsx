import { useState } from 'react';
import {
    Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogTitle, FormControl, FormControlLabel, FormGroup,
    FormLabel, Link, Paper, Stack, Switch, TextField, Typography,
} from '@mui/material';
import {
    useDeleteMarketplaceSearchMutation, useGetMarketplaceConfigurationQuery,
    useGetMarketplaceMatchesQuery, useGetMarketplaceSearchesQuery, useSaveMarketplaceSearchMutation,
    type MarketplaceSearch,
} from '../api/marketplaceApi';
import { marketplaceError, parseMaximumPrice } from '../helpers/marketplace';

const euros = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

function SearchMatches({ id }: { id: number }) {
    const { data = [], isLoading, error } = useGetMarketplaceMatchesQuery(id);
    if (isLoading) return <CircularProgress size={24} aria-label="Loading matches" />;
    if (error) return <Alert severity="error">{marketplaceError(error)}</Alert>;
    if (!data.length) return <Typography color="text.secondary">No matching listings found yet.</Typography>;
    return (
        <Stack spacing={1}>
            <Typography variant="caption">Latest 50 matches. Prices exclude shipping and may have changed.</Typography>
            {data.map(match => (
                <Box key={match.id}>
                    <Link href={match.url} target="_blank" rel="noopener noreferrer">{match.title}</Link>
                    <Typography variant="body2">
                        {euros.format(match.priceCents / 100)} &middot; eBay &middot; {match.notifiedAt ? 'Telegram sent' : 'Telegram pending'}
                    </Typography>
                </Box>
            ))}
        </Stack>
    );
}

export default function MarketplaceSearchPage() {
    const { data: config, error: configError } = useGetMarketplaceConfigurationQuery();
    const { data: searches = [], isLoading, isFetching, error: loadError, refetch } = useGetMarketplaceSearchesQuery(undefined, {
        pollingInterval: 60000,
        skipPollingIfUnfocused: true,
    });
    const [saveSearch, { isLoading: isSaving }] = useSaveMarketplaceSearchMutation();
    const [deleteSearch, { isLoading: isDeleting }] = useDeleteMarketplaceSearchMutation();
    const [editingID, setEditingID] = useState<number>();
    const [keywords, setKeywords] = useState('');
    const [maximum, setMaximum] = useState('');
    const [marketplaces, setMarketplaces] = useState<string[]>(['ebay']);
    const [enabled, setEnabled] = useState(true);
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState<MarketplaceSearch | null>(null);
    const [expandedID, setExpandedID] = useState<number | null>(null);
    const busy = isSaving || isDeleting;

    function resetForm() {
        setEditingID(undefined);
        setKeywords('');
        setMaximum('');
        setMarketplaces(['ebay']);
        setEnabled(true);
    }

    function edit(search: MarketplaceSearch) {
        setEditingID(search.id);
        setKeywords(search.keywords);
        setMaximum(`${Math.floor(search.maxPriceCents / 100)}.${String(search.maxPriceCents % 100).padStart(2, '0')}`);
        setMarketplaces(search.marketplaces);
        setEnabled(search.enabled);
        setError('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setError('');
        const maxPriceCents = parseMaximumPrice(maximum);
        if (maxPriceCents === null || !keywords.trim() || marketplaces.length === 0) {
            setError('Enter keywords, select a marketplace, and enter a positive maximum price with at most two decimals.');
            return;
        }
        try {
            await saveSearch({ id: editingID, input: { keywords: keywords.trim(), marketplaces, maxPriceCents, enabled } }).unwrap();
            resetForm();
        } catch (err) {
            setError(marketplaceError(err));
        }
    }

    async function remove() {
        if (!deleting) return;
        setError('');
        try {
            await deleteSearch(deleting.id).unwrap();
            if (editingID === deleting.id) resetForm();
            if (expandedID === deleting.id) setExpandedID(null);
            setDeleting(null);
        } catch (err) {
            setError(marketplaceError(err));
            setDeleting(null);
        }
    }

    return (
        <Stack spacing={3}>
            <Box>
                <Typography variant="h4" component="h1">Marketplace search</Typography>
                <Typography color="text.secondary">
                    Save product searches and receive Telegram alerts for new listings strictly below your maximum item price.
                    Searches cover Italy in EUR; shipping is excluded.
                </Typography>
            </Box>
            {(error || loadError || configError) && (
                <Alert severity="error">{error || marketplaceError(loadError || configError)}</Alert>
            )}
            {config && (!config.dailyEnabled || !config.telegramConfigured || !config.marketplaces.find(m => m.id === 'ebay')?.configured) && (
                <Alert severity="warning">
                    Searches can be saved, but alerts need server configuration.
                    {!config.dailyEnabled && ' The daily worker is disabled.'}
                    {!config.telegramConfigured && ' Telegram is not configured.'}
                    {!config.marketplaces.find(m => m.id === 'ebay')?.configured && ' eBay credentials are not configured.'}
                </Alert>
            )}
            <Paper component="form" onSubmit={submit} sx={{ p: { xs: 2, sm: 3 } }}>
                <Stack spacing={2}>
                    <Typography variant="h6" component="h2">{editingID ? 'Edit search' : 'New search'}</Typography>
                    <FormControl component="fieldset" disabled={busy || !config}>
                        <FormLabel component="legend">Marketplaces</FormLabel>
                        <FormGroup>
                            {config?.marketplaces.map(marketplace => (
                                <FormControlLabel
                                    key={marketplace.id}
                                    control={<Checkbox checked={marketplaces.includes(marketplace.id)} disabled={busy || !marketplace.available}
                                        onChange={(_, checked) => setMarketplaces(current => checked
                                            ? [...current, marketplace.id] : current.filter(id => id !== marketplace.id))} />}
                                    label={`${marketplace.name}${marketplace.available ? '' : ' (not available yet)'}`}
                                />
                            ))}
                        </FormGroup>
                    </FormControl>
                    <TextField label="Search keywords" required value={keywords} disabled={busy}
                        onChange={event => setKeywords(event.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />
                    <TextField label="Maximum item price (EUR)" required value={maximum} disabled={busy}
                        onChange={event => setMaximum(event.target.value)}
                        slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                        helperText="Strictly below this amount. Fixed-price eBay listings deliverable to Italy; excludes shipping." />
                    <FormControlLabel control={<Switch checked={enabled} disabled={busy}
                        onChange={(_, checked) => setEnabled(checked)} />} label="Daily Telegram alerts enabled" />
                    <Typography variant="body2" color="text.secondary">
                        Notifications go to the application&apos;s shared Telegram chat. Changing keywords or the maximum price resets match history.
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Button type="submit" variant="contained" disabled={busy || !config}>
                            {isSaving ? 'Saving...' : editingID ? 'Save changes' : 'Save search'}
                        </Button>
                        {editingID && <Button onClick={resetForm} disabled={busy}>Cancel edit</Button>}
                    </Stack>
                </Stack>
            </Paper>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h5" component="h2">Your searches</Typography>
                <Button onClick={() => refetch()} disabled={isFetching}>Refresh</Button>
            </Stack>
            {isLoading && <CircularProgress aria-label="Loading searches" />}
            {!isLoading && !loadError && searches.length === 0 && <Typography>No saved searches yet.</Typography>}
            {searches.map(search => (
                <Paper key={search.id} sx={{ p: 2 }}>
                    <Stack spacing={2}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', overflowWrap: 'anywhere' }}>
                            <Typography variant="h6" component="h3" sx={{ flex: 1 }}>{search.keywords}</Typography>
                            <Chip label={search.enabled ? 'Active' : 'Paused'} color={search.enabled ? 'success' : 'default'} size="small" />
                        </Stack>
                        <Typography>eBay &middot; Below {euros.format(search.maxPriceCents / 100)} &middot; Italy</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Last checked: {search.lastCheckedAt ? new Date(search.lastCheckedAt).toLocaleString() : 'Not checked yet'}
                        </Typography>
                        {search.lastError && <Alert severity="error">{search.lastError}</Alert>}
                        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                            <Button onClick={() => edit(search)} disabled={busy}>Edit</Button>
                            <Button onClick={() => setExpandedID(expandedID === search.id ? null : search.id)}>
                                {expandedID === search.id ? 'Hide matches' : 'View matches'}
                            </Button>
                            <Button color="error" onClick={() => setDeleting(search)} disabled={busy}>Delete</Button>
                        </Stack>
                        {expandedID === search.id && <SearchMatches id={search.id} />}
                    </Stack>
                </Paper>
            ))}
            <Dialog open={deleting !== null} onClose={() => !isDeleting && setDeleting(null)}>
                <DialogTitle>Delete search?</DialogTitle>
                <DialogContent>This removes &quot;{deleting?.keywords}&quot;, its match history, and future alerts.</DialogContent>
                <DialogActions>
                    <Button disabled={isDeleting} onClick={() => setDeleting(null)}>Cancel</Button>
                    <Button color="error" disabled={isDeleting} onClick={remove}>Delete</Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}
