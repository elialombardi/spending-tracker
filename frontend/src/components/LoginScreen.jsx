import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

export default function LoginScreen({ errorMessage, isBusy, isDevelopment, onSubmit }) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')

    async function handleSubmit(event) {
        event.preventDefault()
        await onSubmit({ password, username })
    }

    return (
        <Box
            sx={{
                alignItems: 'center',
                display: 'flex',
                justifyContent: 'center',
                minHeight: '100vh',
                px: 2,
            }}
        >
            <Paper sx={{ maxWidth: 440, p: 3, width: '100%' }}>
                <Stack spacing={2}>
                    <Box>
                        <Typography variant="overline">Authentication</Typography>
                        <Typography variant="h5">Sign in to the API</Typography>
                        <Typography color="text.secondary" variant="body2">
                            Every API route now requires a bearer token. Reader accounts keep read access, while Writer and Admin accounts can modify data.
                        </Typography>
                    </Box>

                    {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

                    {isDevelopment && isBusy ? (
                        <Alert icon={<CircularProgress color="inherit" size={18} />} severity="info">
                            Trying the development bootstrap credentials first.
                        </Alert>
                    ) : null}

                    <Box component="form" onSubmit={handleSubmit}>
                        <Stack spacing={2}>
                            <TextField
                                autoComplete="username"
                                label="Username"
                                onChange={(event) => setUsername(event.target.value)}
                                required
                                value={username}
                            />
                            <TextField
                                autoComplete="current-password"
                                label="Password"
                                onChange={(event) => setPassword(event.target.value)}
                                required
                                type="password"
                                value={password}
                            />
                            <Button disabled={isBusy} type="submit" variant="contained">
                                Sign in
                            </Button>
                        </Stack>
                    </Box>
                </Stack>
            </Paper>
        </Box>
    )
}
