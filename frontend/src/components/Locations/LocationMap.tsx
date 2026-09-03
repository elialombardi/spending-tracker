import { useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L, { LatLngExpression, PointExpression } from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Type definitions
interface Location {
    id?: string | number;
    _id?: string;
    title?: string;
    name?: string;
    description?: string;
    lat: number;
    lng: number;
    tags?: string[];
    url?: string;
}

interface LocationMapProps {
    locations: Location[];
    center?: LatLngExpression;
    onMapClick?: (latlng: L.LatLng) => void;
    draftLocation?: Location | null;
    highlightedId?: string | number | null;
    centerZoom?: number;
    visible?: boolean;
}

// Fix: Use type assertion for Leaflet Default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

// Create a custom golden pin SVG icon (data URL) and a Leaflet Icon
const createGoldenIcon = (color = '#F0C330') => {
    const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='36' height='48' viewBox='0 0 24 32' fill='none'>
        <path d='M12 0C7.029 0 3 4.03 3 9c0 7.5 9 17 9 17s9-9.5 9-17c0-4.97-4.029-9-9-9z' fill='${color}' stroke='#b68f1a' stroke-width='0.6'/>
        <circle cx='12' cy='9' r='3.5' fill='white' opacity='0.95'/>
    </svg>`;

    const iconUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

    return L.icon({
        iconUrl,
        iconSize: [28, 42],
        iconAnchor: [14, 42],
        popupAnchor: [0, -40],
        className: 'leaflet-marker-golden'
    });
};

const goldenIcon = createGoldenIcon();
const highlightedIcon = createGoldenIcon('#1976d2');

const defaultCenter: LatLngExpression = [41.9028, 12.4964];

function MapClickHandler({ onMapClick }: { onMapClick?: (latlng: L.LatLng) => void }) {
    useMapEvents({
        click(e) {
            if (onMapClick) onMapClick(e.latlng);
        },
    });
    return null;
}

function MapViewSetter({ center, zoom }: { center?: LatLngExpression; zoom?: number }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            try {
                if (typeof zoom === 'number') {
                    map.setView(center, zoom);
                } else {
                    map.setView(center, map.getZoom());
                }
            } catch (err) {
                console.warn('Failed to set map view', err);
            }
        }
    }, [center, zoom, map]);
    return null;
}

function FitBoundsToLocations({ locations, padding = [50, 50] }: { locations: Location[]; padding?: PointExpression }) {
    const map = useMap();
    useEffect(() => {
        if (!map) return;
        if (Array.isArray(locations) && locations.length > 0) {
            const latlngs = locations
                .filter((l) => typeof l.lat === 'number' && typeof l.lng === 'number')
                .map((l) => [l.lat, l.lng] as LatLngExpression);
            if (latlngs.length === 0) return;
            const bounds = L.latLngBounds(latlngs);
            map.fitBounds(bounds, { padding });
        }
    }, [map, locations, padding]);
    return null;
}

function InvalidateSize({ visible }: { visible?: boolean }) {
    const map = useMap();
    useEffect(() => {
        if (!map) return;
        if (visible) {
            const t = setTimeout(() => {
                try { map.invalidateSize(); } catch (e) { /* ignore */ }
            }, 150);
            return () => clearTimeout(t);
        }
    }, [map, visible]);
    return null;
}

function LocationMap({
    locations,
    center = defaultCenter,
    onMapClick,
    draftLocation,
    highlightedId,
    centerZoom,
    visible = true
}: LocationMapProps) {
    // Get location ID safely
    const getLocationId = (loc: Location) => {
        return loc.id || loc._id || `${loc.lat}-${loc.lng}`;
    };

    return (
        <section className="card" aria-label="map" style={{ height: '100%' }}>
            <MapContainer
                key={visible ? 'visible' : 'hidden'}
                center={center}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
            >
                <MapViewSetter center={center} zoom={centerZoom} />
                <InvalidateSize visible={visible} />
                <FitBoundsToLocations locations={locations} padding={[50, 50] as PointExpression} />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onMapClick={onMapClick} />

                {locations.map((location) => (
                    <Marker
                        key={getLocationId(location)}
                        position={[location.lat, location.lng]}
                        icon={location.id === highlightedId || location._id === highlightedId ? highlightedIcon : goldenIcon}
                    >
                        <Popup>
                            <strong>{location.title || location.name || 'Unnamed Location'}</strong> <br />
                            {location.description} <br />
                            {location.url ? (<div><a href={location.url} target="_blank" rel="noopener noreferrer">{location.url}</a></div>) : null}
                            <em>Tags: {(location.tags || []).join(', ')}</em>
                        </Popup>
                    </Marker>
                ))}

                {draftLocation && draftLocation.lat && draftLocation.lng && (
                    <Marker
                        position={[draftLocation.lat, draftLocation.lng]}
                        icon={goldenIcon}
                    >
                        <Popup>
                            New location position<br />
                            {draftLocation.title || 'Unnamed'}
                        </Popup>
                    </Marker>
                )}
            </MapContainer>
        </section>
    );
}

export default LocationMap;