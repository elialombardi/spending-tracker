import { useState } from 'react';
import {
    Alert, Box, Button, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogTitle, Paper, Stack, TextField, Typography,
} from '@mui/material';
import {
    useGetRegisteredDevicesQuery, useRenameRegisteredDeviceMutation,
    useRevokeRegisteredDeviceMutation, type RegisteredDevice,
} from '../api/devicesApi';

function deviceError(error: unknown, loading = false): string {
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object') {
        const status = 'originalStatus' in error ? error.originalStatus : 'status' in error ? error.status : undefined;
        if (status === 405 || (loading && status === 404)) {
            return 'Device management is unavailable. Enable biometric authentication on the API and deploy the latest server version.';
        }
        if ('data' in error && error.data && typeof error.data === 'object') {
            if ('error' in error.data && typeof error.data.error === 'string') return error.data.error;
            if ('message' in error.data && typeof error.data.message === 'string') return error.data.message;
        }
    }
    return 'Unable to manage registered devices. Please try again.';
}

export default function RegisteredDevicesPage() {
    const { data: devices = [], isLoading, isFetching, error: loadError, refetch } = useGetRegisteredDevicesQuery();
    const [renameDevice, { isLoading: isRenaming }] = useRenameRegisteredDeviceMutation();
    const [revokeDevice, { isLoading: isRevoking }] = useRevokeRegisteredDeviceMutation();
    const [editing, setEditing] = useState<RegisteredDevice | null>(null);
    const [revoking, setRevoking] = useState<RegisteredDevice | null>(null);
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const busy = isRenaming || isRevoking;
    const validName = name.trim().length > 0 && new TextEncoder().encode(name.trim()).length <= 200;

    async function rename(event: React.FormEvent) {
        event.preventDefault();
        if (!editing || !validName) return;
        setError('');
        setSuccess('');
        try {
            await renameDevice({ device_id: editing.device_id, device_name: name.trim() }).unwrap();
            setEditing(null);
            setSuccess('Device renamed.');
        } catch (err) {
            setError(deviceError(err));
        }
    }

    async function revoke() {
        if (!revoking) return;
        setError('');
        setSuccess('');
        try {
            await revokeDevice(revoking.device_id).unwrap();
            setRevoking(null);
            setSuccess('Device revoked. It can no longer sign in using biometrics.');
        } catch (err) {
            setError(deviceError(err));
        }
    }

    return (
        <Stack spacing={3}>
            <Box>
                <Typography variant="h4" component="h1">Registered devices</Typography>
                <Typography color="text.secondary">
                    Manage devices registered for biometric sign-in to your account.
                </Typography>
            </Box>
            <Alert severity="info">
                Revoking a device blocks future biometric sign-ins. Tokens already issued remain valid
                until they expire (up to 15 minutes). Sign in with your password to manage devices.
            </Alert>
            {loadError && <Alert severity="error">{deviceError(loadError, true)}</Alert>}
            {error && !editing && !revoking && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}
            <Box>
                <Button onClick={() => refetch()} disabled={isFetching || busy}>Refresh devices</Button>
            </Box>
            {isLoading ? <CircularProgress aria-label="Loading registered devices" /> : !loadError && (
                devices.length === 0 ? <Typography>No registered devices.</Typography> :
                    devices.map(device => (
                        <Paper key={device.device_id} sx={{ p: 2 }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
                                <Box sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                                    <Typography variant="h6">{device.device_name}</Typography>
                                    <Typography variant="body2" color="text.secondary">{device.device_id}</Typography>
                                </Box>
                                <Button disabled={busy} aria-label={`Rename ${device.device_name}`} onClick={() => {
                                    setEditing(device);
                                    setName(device.device_name);
                                    setError('');
                                }}>Rename</Button>
                                <Button color="error" disabled={busy} aria-label={`Revoke ${device.device_name}`} onClick={() => {
                                    setRevoking(device);
                                    setError('');
                                }}>Revoke</Button>
                            </Stack>
                        </Paper>
                    ))
            )}
            <Dialog open={editing !== null} onClose={() => { if (!busy) setEditing(null); }} fullWidth maxWidth="xs">
                <Box component="form" onSubmit={rename}>
                    <DialogTitle>Rename device</DialogTitle>
                    <DialogContent>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField autoFocus fullWidth margin="dense" label="Device name" value={name}
                            onChange={event => setName(event.target.value)} disabled={busy}
                            error={!validName} helperText="Enter a name between 1 and 200 bytes." />
                    </DialogContent>
                    <DialogActions>
                        <Button disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
                        <Button type="submit" variant="contained" disabled={busy || !validName}>
                            {isRenaming ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
            <Dialog open={revoking !== null} onClose={() => { if (!busy) setRevoking(null); }} fullWidth maxWidth="xs">
                <DialogTitle>Revoke device?</DialogTitle>
                <DialogContent>
                    {error && <Alert severity="error">{error}</Alert>}
                    <Typography>
                        Remove biometric access for {revoking?.device_name}? You will need to register
                        it again to restore access. Existing tokens may work for up to 15 minutes.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button disabled={busy} onClick={() => setRevoking(null)}>Cancel</Button>
                    <Button color="error" variant="contained" disabled={busy} onClick={revoke}>
                        {isRevoking ? 'Revoking...' : 'Revoke device'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}
