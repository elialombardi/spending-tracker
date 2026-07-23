const runtimeEnv: any = (typeof window !== 'undefined' && (window as any).__ENV__) || {}
const viteEnv: any = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {}
const processEnv: any = (typeof globalThis !== 'undefined' && (globalThis as any).process && (globalThis as any).process.env) || {}

// Prefer Vite-provided envs during dev/build, allow optional runtime overrides via window.__ENV__
const mode = viteEnv.MODE || runtimeEnv.MODE || processEnv.NODE_ENV || ''

// Normalize API base so that '/' means "same origin" (use relative paths)
const _rawApiBase = viteEnv.VITE_API_BASE
    ?? runtimeEnv.VITE_API_BASE
    ?? runtimeEnv.REACT_APP_API_BASE
    ?? processEnv.REACT_APP_API_BASE
    ?? null

let _apiBase = _rawApiBase !== null
    ? String(_rawApiBase)
    : (mode !== 'production' ? 'https://localhost:7004' : '')

// If user set '/' explicitly, treat as same-origin (empty base)
if (_apiBase === '/') {
    _apiBase = ''
} else {
    // Remove trailing slashes to avoid generating protocol-relative URLs like `//host`
    _apiBase = _apiBase.replace(/\/+$/, '')
}

export const API_BASE = _apiBase

const _rawPlaceSearchProvider = runtimeEnv.VITE_PLACE_SEARCH_PROVIDER
    || viteEnv.VITE_PLACE_SEARCH_PROVIDER
    || runtimeEnv.REACT_APP_PLACE_SEARCH_PROVIDER
    || processEnv.REACT_APP_PLACE_SEARCH_PROVIDER
    || 'nominatim'

export const PLACE_SEARCH_PROVIDER = String(_rawPlaceSearchProvider).trim().toLowerCase() === 'geoapify'
    ? 'geoapify'
    : 'nominatim'

export const GEOAPIFY_API_KEY = runtimeEnv.VITE_GEOAPIFY_API_KEY
    || viteEnv.VITE_GEOAPIFY_API_KEY
    || runtimeEnv.REACT_APP_GEOAPIFY_API_KEY
    || processEnv.REACT_APP_GEOAPIFY_API_KEY
    || ''

export const DEV_AUTH_USERNAME = runtimeEnv.VITE_AUTH_USERNAME
    || viteEnv.VITE_AUTH_USERNAME
    || processEnv.REACT_APP_AUTH_USERNAME
    || 'admin'

export const DEV_AUTH_PASSWORD = runtimeEnv.VITE_AUTH_PASSWORD
    || viteEnv.VITE_AUTH_PASSWORD
    || processEnv.REACT_APP_AUTH_PASSWORD
    || 'dev-password-change-me'

export const APP_VERSION = runtimeEnv.VITE_APP_VERSION
    || viteEnv.VITE_APP_VERSION
    || processEnv.REACT_APP_APP_VERSION
    || '0.0.0'

export const isDevelopmentEnv = Boolean(
    runtimeEnv.DEV ?? viteEnv.DEV ?? mode !== 'production',
)
