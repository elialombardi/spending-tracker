import { useSyncExternalStore } from 'react'
import { API_BASE, DEV_AUTH_PASSWORD, DEV_AUTH_USERNAME, isDevelopmentEnv } from './config'

const STORAGE_KEY = 'spending-tracker.auth-session'
const listeners = new Set()
const MANUAL_LOGOUT_KEY = 'spending-tracker.manual-logout'

function createAuthError(message, code, status) {
    const error = new Error(message)
    error.code = code
    error.status = status
    return error
}

export function isSessionExpired(session) {
    if (!session?.expiresAt) {
        return true
    }

    return Date.parse(session.expiresAt) <= Date.now()
}

function persistSession(session) {
    if (typeof window === 'undefined') {
        return
    }

    if (session) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
        return
    }

    window.sessionStorage.removeItem(STORAGE_KEY)
}

function loadStoredSession() {
    if (typeof window === 'undefined') {
        return null
    }

    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY)
        if (!raw) {
            return null
        }

        const parsed = JSON.parse(raw)
        if (isSessionExpired(parsed)) {
            window.sessionStorage.removeItem(STORAGE_KEY)
            return null
        }

        return parsed
    } catch {
        window.sessionStorage.removeItem(STORAGE_KEY)
        return null
    }
}

let authState = {
    message: '',
    session: loadStoredSession(),
    status: 'idle',
}

authState = {
    ...authState,
    status: authState.session ? 'authenticated' : 'anonymous',
}

function emitChange() {
    listeners.forEach((listener) => listener())
}

function setAuthState(nextState) {
    authState = nextState
    emitChange()
}

function updateAuthState(partialState) {
    setAuthState({
        ...authState,
        ...partialState,
    })
}

export function getAuthState() {
    return authState
}

export function subscribeToAuth(listener) {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function useAuthSession() {
    return useSyncExternalStore(subscribeToAuth, getAuthState, getAuthState)
}

export function canWrite(session) {
    return session?.role === 'Writer' || session?.role === 'Admin'
}

export function isAdmin(session) {
    return session?.role === 'Admin'
}

export function clearAuthMessage() {
    if (!authState.message) {
        return
    }

    updateAuthState({ message: '' })
}

function setAuthenticatedSession(session) {
    persistSession(session)
    try { if (typeof window !== 'undefined') window.sessionStorage.removeItem(MANUAL_LOGOUT_KEY) } catch (_) { }
    setAuthState({
        message: '',
        session,
        status: 'authenticated',
    })
    return session
}

export function logout(message = '', manual = true) {
    if (typeof window !== 'undefined' && manual) {
        try { window.sessionStorage.setItem(MANUAL_LOGOUT_KEY, '1') } catch (_) { }
    }
    persistSession(null)
    setAuthState({
        message,
        session: null,
        status: 'anonymous',
    })
}

async function requestToken({ username, password }) {
    const response = await fetch(`${API_BASE}/api/auth/token`, {
        body: JSON.stringify({ username, password }),
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        method: 'POST',
    })

    if (response.status === 401) {
        throw createAuthError('Invalid username or password.', 'AUTH_INVALID', 401)
    }

    if (!response.ok) {
        throw createAuthError(`Login failed with status ${response.status}.`, 'AUTH_LOGIN_FAILED', response.status)
    }

    return response.json()
}

export async function login(credentials) {
    updateAuthState({ message: '', status: 'authenticating' })

    try {
        const session = await requestToken(credentials)
        return setAuthenticatedSession(session)
    } catch (error) {
        updateAuthState({
            message: error instanceof Error ? error.message : 'Login failed.',
            session: null,
            status: 'anonymous',
        })
        throw error
    }
}

let bootstrapPromise = null

export async function bootstrapDevelopmentSession() {
    if (!isDevelopmentEnv) {
        return null
    }

    // respect manual logout flag: if user manually logged out, don't auto-bootstrap
    if (typeof window !== 'undefined') {
        try {
            if (window.sessionStorage.getItem(MANUAL_LOGOUT_KEY)) {
                return null
            }
        } catch (_) { }
    }

    if (authState.session && !isSessionExpired(authState.session)) {
        return authState.session
    }

    if (bootstrapPromise) {
        return bootstrapPromise
    }

    updateAuthState({ message: '', status: 'authenticating' })

    bootstrapPromise = requestToken({
        password: DEV_AUTH_PASSWORD,
        username: DEV_AUTH_USERNAME,
    })
        .then((session) => setAuthenticatedSession(session))
        .catch((error) => {
            logout('Development login failed. Set VITE_AUTH_USERNAME and VITE_AUTH_PASSWORD or sign in manually.', false)
            throw error
        })
        .finally(() => {
            bootstrapPromise = null
        })

    return bootstrapPromise
}

export async function ensureAuthenticated() {
    if (authState.session && !isSessionExpired(authState.session)) {
        return authState.session
    }

    if (authState.session) {
        logout('Your session expired. Please sign in again.', false)
    }

    if (isDevelopmentEnv) {
        return bootstrapDevelopmentSession()
    }

    throw createAuthError('Authentication is required.', 'AUTH_REQUIRED', 401)
}
