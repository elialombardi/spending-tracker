import { useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Ensure Leaflet's default icon URLs are set correctly (Vite bundles images differently)
delete L.Icon.Default.prototype._getIconUrl;
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

const defaultCenter = [41.9028, 12.4964];
function MapClickHandler({ onMapClick }) {
    useMapEvents({
        click(e) {
            if (onMapClick) onMapClick(e.latlng);
        },
    });
    return null;
}

function MapViewSetter({ center }) {
    const map = useMap();
    // synchronize center when it changes
    useEffect(() => {
        if (center) map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
}

function LocationMap({ locations, center = defaultCenter, onMapClick, draftLocation }) {
    return (
        <section className="card" aria-label="map">
            <MapContainer center={center} zoom={13} style={{ height: '500px', width: '100%' }}>
                <MapViewSetter center={center} />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onMapClick={onMapClick} />
                {locations.map((location) => (
                    <Marker key={location.id} position={[location.lat, location.lng]} icon={goldenIcon}>
                        <Popup>
                            <strong>{location.title}</strong> <br />
                            {location.description} <br />
                            {location.url ? (<div><a href={location.url} target="_blank" rel="noopener noreferrer">{location.url}</a></div>) : null}
                            <em>Tags: {(location.tags || []).join(', ')}</em>
                        </Popup>
                    </Marker>
                ))}

                {draftLocation && draftLocation.lat && draftLocation.lng && (
                    <Marker position={[draftLocation.lat, draftLocation.lng]} icon={goldenIcon}>
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