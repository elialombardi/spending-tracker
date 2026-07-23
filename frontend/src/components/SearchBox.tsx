import TextField from '@mui/material/TextField';
import Autocomplete, { type AutocompleteRenderInputParams } from '@mui/material/Autocomplete';
import IconButton from '@mui/material/IconButton';
import ClearIcon from '@mui/icons-material/Clear';
import { useEffect, useState, SyntheticEvent } from 'react';
import { PLACE_SEARCH_PROVIDER, GEOAPIFY_API_KEY } from '../config';

interface SearchResult {
    id: string;
    title: string;
    lat: number;
    lng: number;
}

interface GeoapifyFeature {
    properties: {
        place_id?: string;
        osm_id?: string;
        formatted?: string;
        name?: string;
        display_name?: string;
        lat?: number;
        lon?: number;
        geocoding?: {
            place_id?: string;
        };
    };
    geometry?: {
        coordinates?: [number, number];
    };
}

interface NominatimResult {
    place_id: number;
    display_name: string;
    name?: string;
    lat: string;
    lon: string;
}

interface Props {
    value?: string;
    onChange?: (v: string) => void;
    onSearch?: (v: string) => void;
    options?: string[];
    placeholder?: string;
    onResults?: (results: SearchResult[]) => void;
    onSelect?: (res: { title: string; lat: number; lng: number }) => void;
    onHover?: (id: string | null) => void;
}

type AutocompleteOption = string | SearchResult;

export default function SearchBox({ 
    value,
    onChange, 
    onSearch, 
    options = [], 
    placeholder = 'Search...', 
    onResults, 
    onSelect, 
    onHover 
}: Props) {
    const [results, setResults] = useState<SearchResult[]>([]);
    const [internalValue, setInternalValue] = useState<string>('');

    // Use provided value if available, otherwise use internal state
    const inputValue = value ?? internalValue;

    useEffect(() => {
        if (Array.isArray(options) && options.length > 0 && !onResults) {
            // If parent provided options as strings, use them directly
            // No need to fetch places
        }
    }, [options]);

    async function fetchPlaces(q: string): Promise<void> {
        if (!q || !q.trim()) {
            setResults([]);
            onResults && onResults([]);
            return;
        }

        try {
            if (PLACE_SEARCH_PROVIDER === 'geoapify') {
                const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(q)}&limit=8&apiKey=${encodeURIComponent(GEOAPIFY_API_KEY || '')}`;
                const res = await fetch(url);
                const json = await res.json();
                const features = json?.features || [];
                const items: SearchResult[] = features.map((f: GeoapifyFeature) => ({
                    id: f.properties.place_id || f.properties.osm_id || f.properties.geocoding?.place_id || String(Math.random()),
                    title: f.properties.formatted || f.properties.name || f.properties.display_name || '',
                    lat: Number(f.properties.lat || f.geometry?.coordinates?.[1] || 0),
                    lng: Number(f.properties.lon || f.geometry?.coordinates?.[0] || 0)
                }));
                setResults(items);
                onResults && onResults(items);
            } else {
                // Nominatim
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=8&addressdetails=0`;
                const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
                const json = await res.json();
                const items: SearchResult[] = (json || []).map((r: NominatimResult) => ({
                    id: r.place_id ? String(r.place_id) : String(Math.random()),
                    title: r.display_name || r.name || '',
                    lat: Number(r.lat),
                    lng: Number(r.lon)
                }));
                setResults(items);
                onResults && onResults(items);
            }
        } catch (err) {
            console.error('Failed to fetch places:', err);
            setResults([]);
            onResults && onResults([]);
        }
    }

    const handleClear = (): void => {
        setInternalValue('');
        onChange && onChange('');
        onSearch && onSearch('');
        setResults([]);
        onResults && onResults([]);
    };

    const handleInputChange = (_event: SyntheticEvent, newValue: string): void => {
        setInternalValue(newValue);
        onChange && onChange(newValue);
        onSearch && onSearch(newValue);
        // Trigger place search
        fetchPlaces(newValue);
    };

    const handleChange = (_event: SyntheticEvent | null, newValue: AutocompleteOption | null): void => {
        if (!newValue) return;
        
        // If it's a string (free solo input), use it directly
        if (typeof newValue === 'string') {
            setInternalValue(newValue);
            if (onSelect) {
                onSelect({ title: newValue, lat: NaN, lng: NaN });
            }
            return;
        }
        
        // It's a SearchResult object
        if (newValue.title) {
            setInternalValue(newValue.title);
            if (onSelect) {
                onSelect({ 
                    title: newValue.title, 
                    lat: Number(newValue.lat), 
                    lng: Number(newValue.lng) 
                });
            }
        }
    };

    const handleHighlightChange = (_event: SyntheticEvent, option: AutocompleteOption | null): void => {
        if (onHover) {
            const id = option && typeof option !== 'string' ? option.id : null;
            onHover(id);
        }
    };

    const getOptionLabel = (option: AutocompleteOption): string => {
        if (typeof option === 'string') {
            return option;
        }
        return option.title || '';
    };

    const isOptionEqualToValue = (option: AutocompleteOption, value: AutocompleteOption): boolean => {
        if (typeof option === 'string' && typeof value === 'string') {
            return option === value;
        }
        if (typeof option !== 'string' && typeof value !== 'string') {
            return option.id === value.id;
        }
        return false;
    };

    // Determine which options to show
    const displayOptions = results.length > 0 ? results : options;

    return (
        <Autocomplete
            freeSolo
            options={displayOptions}
            getOptionLabel={getOptionLabel}
            isOptionEqualToValue={isOptionEqualToValue}
            inputValue={inputValue}
            onInputChange={handleInputChange}
            onChange={handleChange}
            onHighlightChange={handleHighlightChange}
            renderInput={(params: AutocompleteRenderInputParams) => {
                const { InputProps, ...restParams } = params;
                const inputProps = InputProps ?? {};
                const textFieldProps = {
                    ...restParams,
                    placeholder,
                    InputProps: {
                        ...inputProps,
                        endAdornment: (
                            <>
                                {inputProps.endAdornment}
                                <IconButton 
                                    onClick={handleClear} 
                                    size="small"
                                    aria-label="clear search"
                                >
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            </>
                        ),
                    },
                } as any;
                return (
                    <TextField {...textFieldProps} />
                );
            }}
        />
    );
}