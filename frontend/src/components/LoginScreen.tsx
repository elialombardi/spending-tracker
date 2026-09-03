import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'

const appVersion = import.meta.env.VITE_APP_VERSION

export default function LoginScreen({ errorMessage, isBusy, isDevelopment, onSubmit }) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)

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
                background: 'linear-gradient(180deg, #f8fafc 0%, #fff 60%)',
            }}
        >
            <Paper sx={{ maxWidth: 520, p: 4, width: '100%', borderRadius: 3, boxShadow: 3 }}>
                <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src="/logo.png" alt="Spending Tracker logo" sx={{ width: 72, height: 72 }} />
                        <Box>
                            <Typography variant="overline">Welcome to</Typography>
                            <Typography variant="h5">The Picci&#39;s</Typography>
                        </Box>
                    </Box>

                    {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

                    {isDevelopment && isBusy ? (
                        <Alert icon={<CircularProgress color="inherit" size={18} />} severity="info">
                            Trying the development bootstrap credentials first.
                        </Alert>
                    ) : null}

                    <Box component="form" onSubmit={handleSubmit} aria-label="login form">
                        <Stack spacing={2}>
                            <TextField
                                autoComplete="username"
                                label="Username"
                                onChange={(event) => setUsername(event.target.value)}
                                required
                                value={username}
                                fullWidth
                                slotProps={{
                                    htmlInput: {
                                        'aria-label': 'username'
                                    }
                                }}
                            />
                            <TextField
                                autoComplete="current-password"
                                label="Password"
                                onChange={(event) => setPassword(event.target.value)}
                                required
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                fullWidth
                                slotProps={{
                                    htmlInput: {
                                        'aria-label': 'password'
                                    },
                                    input: {
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                    onClick={() => setShowPassword((s) => !s)}
                                                    edge="end"
                                                >
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }
                                }}
                            />

                            <Button disabled={isBusy} type="submit" variant="contained" size="large">
                                {isBusy ? 'Signing in…' : 'Sign in'}
                            </Button>
                        </Stack>
                    </Box>
                </Stack>
                <Box sx={{ mt: 1, textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary">Version {appVersion}</Typography>
                </Box>
            </Paper>
        </Box>
    )
}