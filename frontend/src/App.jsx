import { lazy, Suspense, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import NavBar from './components/NavBar';
import LoginScreen from './components/LoginScreen';
import api from './api';
import { Routes, Route } from 'react-router-dom';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import { bootstrapDevelopmentSession, canWrite, isSessionExpired, login, logout, useAuthSession } from './auth';
import { isDevelopmentEnv } from './config';

const MapPage = lazy(() => import('./pages/MapPage'));
const TagsPage = lazy(() => import('./pages/TagsPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));

const defaultLocations = [
  {
    id: 1,
    title: 'Central Park',
    tags: ['kids'],
    url: 'https://www.nycgovparks.org/parks/central-park',
    lat: 40.7829,
    lng: -73.9654,
    description: 'Great for kids',
  },
  {
    id: 2,
    title: 'Joe’s Pizza',
    tags: ['restaurant'],
    url: 'https://www.joespizza.com',
    lat: 40.7308,
    lng: -73.9973,
    description: 'Classic NY slice',
  },
];

const emptyLocation = {
  title: '',
  tags: [],
  lat: '',
  lng: '',
  description: '',
  url: '',
};

const defaultTags = ['restaurant', 'kids'];

const defaultCenter = [41.9028, 12.4964];

function App() {
  const { message: authMessage, session, status } = useAuthSession();
  const [locations, setLocations] = useState(() => {
    const saved = localStorage.getItem('locations');
    return saved ? JSON.parse(saved) : defaultLocations;
  });

  const [tags, setTags] = useState(() => {
    const saved = localStorage.getItem('tags');
    return saved ? JSON.parse(saved) : defaultTags;
  });

  const [filter, setFilter] = useState('all');
  // routing will handle views

  const [newLocation, setNewLocation] = useState(emptyLocation);
  const [center, setCenter] = useState(defaultCenter);
  const [appError, setAppError] = useState('');

  const canModify = canWrite(session);

  useEffect(() => {
    if (session && isSessionExpired(session)) {
      logout('Your session expired. Please sign in again.');
    }
  }, [session]);

  useEffect(() => {
    if (!session && isDevelopmentEnv) {
      bootstrapDevelopmentSession().catch((error) => {
        console.warn('Development auth bootstrap failed', error);
      });
    }
  }, [session]);

  useEffect(() => {
    localStorage.setItem('locations', JSON.stringify(locations));
  }, [locations]);

  useEffect(() => {
    localStorage.setItem('tags', JSON.stringify(tags));
  }, [tags]);

  // Load from API if available, otherwise keep localStorage/defaults
  useEffect(() => {
    if (!session) {
      return undefined;
    }

    let mounted = true;
    (async () => {
      try {
        const [remoteLocations, remoteTags] = await Promise.all([api.listLocations(), api.listTags()]);
        if (!mounted) return;
        if (Array.isArray(remoteLocations)) setLocations(remoteLocations);
        if (Array.isArray(remoteTags)) setTags(remoteTags);
      } catch (err) {
        if (!mounted || err?.code === 'AUTH_REQUIRED') return;
        if (err?.code === 'FORBIDDEN') {
          setAppError('Your account can sign in, but it cannot load the requested data.');
          return;
        }
        setAppError(err instanceof Error ? err.message : 'Failed to load data from the API.');
      }
    })();
    return () => { mounted = false; };
  }, [session]);

  function handleApiError(err, fallbackMessage) {
    if (err?.code === 'AUTH_REQUIRED') {
      return;
    }

    if (err?.code === 'FORBIDDEN') {
      setAppError('Your role does not allow that action.');
      return;
    }

    setAppError(err instanceof Error ? err.message : fallbackMessage);
  }

  const handleAddLocation = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    (async () => {
      const payload = { ...newLocation, lat: parseFloat(newLocation.lat), lng: parseFloat(newLocation.lng) };
      try {
        const created = await api.createLocation(payload);
        setLocations((current) => [...current, created || payload]);
      } catch (err) {
        handleApiError(err, 'Failed to create the location.');
      } finally {
        setNewLocation(emptyLocation);
      }
    })();
  };

  const handleMapClick = (latlng) => {
    const { lat, lng } = latlng;
    setNewLocation((cur) => ({ ...cur, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
    setCenter([lat, lng]);
  };

  const handleSelectPlace = ({ title, lat, lng }) => {
    setNewLocation((cur) => ({ ...cur, title: title || cur.title, lat, lng }));
    setCenter([lat, lng]);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return alert('Geolocation not supported in this browser or context');

    // Try to get permission info when available to provide clearer messages
    try {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' }).then((res) => {
          if (res.state === 'denied') return alert('Location access is denied. Please enable location permissions for this site.');
        }).catch((error) => {
          console.debug('Unable to query geolocation permissions', error);
        });
      }
    } catch (error) {
      console.debug('Geolocation permissions API unavailable', error);
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // keep same format as map click (strings with fixed decimals)
        const latStr = typeof lat === 'number' ? lat.toFixed(6) : String(lat);
        const lngStr = typeof lng === 'number' ? lng.toFixed(6) : String(lng);
        setNewLocation((cur) => ({ ...cur, lat: latStr, lng: lngStr }));
        setCenter([parseFloat(latStr), parseFloat(lngStr)]);
      },
      (err) => {
        console.warn('geolocation error', err);
        if (err && err.code === 1) return alert('Permission denied. Please allow location access.');
        if (err && err.code === 3) return alert('Location request timed out. Try again.');
        return alert('Unable to retrieve your location');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const filteredLocations = locations.filter((loc) => {
    if (filter === 'all') return true;
    return (loc.tags || []).includes(filter);
  });

  const routeFallback = <Box sx={{ p: 3 }}>Loading…</Box>;

  async function handleLogin(credentials) {
    setAppError('');
    await login(credentials);
  }

  if (!session) {
    return (
      <LoginScreen
        errorMessage={appError || authMessage}
        isBusy={status === 'authenticating'}
        isDevelopment={isDevelopmentEnv}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <NavBar canWrite={canModify} onLogout={() => logout()} session={session} />
      <Box>
        {appError ? <Alert severity="error" sx={{ mb: 2 }}>{appError}</Alert> : null}
        <Suspense fallback={routeFallback}>
          <Routes>
            <Route path="/" element={
              <MapPage
                canWrite={canModify}
                filteredLocations={filteredLocations}
                tags={tags}
                filter={filter}
                setFilter={setFilter}
                newLocation={newLocation}
                setNewLocation={setNewLocation}
                handleAddLocation={handleAddLocation}
                handleMapClick={handleMapClick}
                handleSelectPlace={handleSelectPlace}
                handleUseCurrentLocation={handleUseCurrentLocation}
                center={center}
              />
            } />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tags" element={
              <TagsPage
                canWrite={canModify}
                tags={tags}
                locations={locations}
                onRenameTag={async (oldTag, newTag) => {
                  try {
                    await api.renameTag(oldTag, newTag);
                  } catch (err) {
                    handleApiError(err, 'Failed to rename the tag.');
                    return;
                  }
                  setTags((t) => t.map((x) => (x === oldTag ? newTag : x)));
                  setLocations((locs) => locs.map((L) => ({ ...L, tags: (L.tags || []).map((tg) => (tg === oldTag ? newTag : tg)) })));
                }}
                onDeleteTag={async (tagToDelete) => {
                  try {
                    await api.deleteTag(tagToDelete);
                  } catch (err) {
                    handleApiError(err, 'Failed to delete the tag.');
                    return;
                  }
                  setTags((t) => t.filter((x) => x !== tagToDelete));
                  setLocations((locs) => locs.map((L) => ({ ...L, tags: (L.tags || []).filter((tg) => tg !== tagToDelete) })));
                }}
                onCreateTag={async (newTag) => {
                  try {
                    await api.createTag(newTag);
                  } catch (err) {
                    handleApiError(err, 'Failed to create the tag.');
                    return;
                  }
                  setTags((t) => (t.includes(newTag) ? t : [...t, newTag]));
                }}
                onToggleLocationTag={async (locId, tag, present) => {
                  try {
                    const updated = await api.toggleLocationTag(locId, tag, present);
                    if (updated && updated.id) {
                      setLocations((locs) => locs.map((L) => (L.id === updated.id ? updated : L)));
                    }
                  } catch (err) {
                    handleApiError(err, 'Failed to update the location tag.');
                  }
                }}
                onUpdateLocation={async (locId, updated) => {
                  try {
                    const remote = await api.updateLocation(locId, updated);
                    if (remote && remote.id) {
                      setLocations((locs) => locs.map((L) => (L.id === locId ? remote : L)));
                    }
                  } catch (err) {
                    handleApiError(err, 'Failed to update the location.');
                  }
                }}
                onDeleteLocation={async (locId) => {
                  try {
                    await api.deleteLocation(locId);
                    setLocations((locs) => locs.filter((L) => L.id !== locId));
                  } catch (err) {
                    handleApiError(err, 'Failed to delete the location.');
                  }
                }}
              />
            } />
          </Routes>
        </Suspense>
      </Box>
    </Container>
  );
}

export default App;