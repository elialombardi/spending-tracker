// API layer: endpoints, data schemas, and lightweight client helpers
// This file is intended to be handed to the backend developer so they
// know the routes, HTTP verbs, and expected request/response shapes.

import { ensureAuthenticated, logout } from './auth';
import { API_BASE } from './config';

const endpoints = {
    // Tasks
    listTasks: { method: 'GET', path: '/api/tasks' }, // returns Task[]
    createTask: { method: 'POST', path: '/api/tasks' }, // body: CreateTask -> returns Task
    listProjects: { method: 'GET', path: '/api/projects' }, // returns Project[]
    createProject: { method: 'POST', path: '/api/projects' }, // body: CreateProject -> returns Project

    // Locations
    listLocations: { method: 'GET', path: '/locations' }, // returns Location[]
    getLocation: { method: 'GET', path: '/locations/:id' }, // returns Location
    createLocation: { method: 'POST', path: '/locations' }, // body: CreateLocation -> returns Location
    updateLocation: { method: 'PUT', path: '/locations/:id' }, // body: UpdateLocation -> returns Location
    deleteLocation: { method: 'DELETE', path: '/locations/:id' }, // returns { success: true }

    // Tags
    listTags: { method: 'GET', path: '/tags' }, // returns string[]
    createTag: { method: 'POST', path: '/tags' }, // body: { name } -> returns tag string
    renameTag: { method: 'PATCH', path: '/tags/:name' }, // body: { newName } -> returns { oldName, newName }
    deleteTag: { method: 'DELETE', path: '/tags/:name' }, // returns { success: true }

    // Location-specific tag toggle (alternate to updating whole location)
    toggleLocationTag: { method: 'POST', path: '/locations/:id/tags' }, // body: { tag, present: boolean } -> returns Location
};

// Data shape documentation (JS object examples and JSDoc-like typedefs)
const schemas = {
    Location: {
        // A single place/location saved by the app
        // id: number|string (server-generated)
        // title: string
        // tags: string[]
        // url: optional string
        // lat: number (decimal degrees)
        // lng: number (decimal degrees)
        // description: optional string
        example: {
            id: 1,
            title: 'Central Park',
            tags: ['kids'],
            url: 'https://example.com',
            lat: 40.7829,
            lng: -73.9654,
            description: 'Great for kids',
        },
    },

    CreateLocation: {
        // Fields required to create a Location. `id` is assigned by server.
        example: {
            title: 'Joe\'s Pizza',
            tags: ['restaurant'],
            url: 'https://www.joespizza.com',
            lat: 40.7308,
            lng: -73.9973,
            description: 'Classic NY slice',
        },
    },

    UpdateLocation: {
        // Full resource replacement expected by PUT; partial updates can be supported via PATCH if preferred.
        example: {
            title: 'Updated title',
            tags: ['restaurant', 'favorite'],
            url: 'https://example.com',
            lat: 40.7308,
            lng: -73.9973,
            description: 'Updated',
        },
    },

    Tag: {
        // tags are simple strings
        example: 'restaurant',
    },
};

function isAbsoluteUrl(path) {
    return typeof path === 'string' && (path.startsWith('http://') || path.startsWith('https://'));
}

function createApiError(message, response, body = '') {
    const error = new Error(message);
    error.body = body;
    error.code = response.status === 401 ? 'AUTH_REQUIRED' : response.status === 403 ? 'FORBIDDEN' : 'API_ERROR';
    error.status = response.status;
    return error;
}

async function readError(response) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        const payload = await response.json().catch(() => null);
        if (!payload) {
            return `${response.status} ${response.statusText}`;
        }

        return payload.title || payload.detail || payload.message || JSON.stringify(payload);
    }

    return (await response.text().catch(() => '')) || `${response.status} ${response.statusText}`;
}

async function fetchApiResponse(path, opts = {}) {
    const url = isAbsoluteUrl(path) ? path : (API_BASE || '') + path;
    const headers = new Headers(opts.headers || {});

    if (!opts.allowAnonymous) {
        const session = await ensureAuthenticated();
        headers.set('Authorization', `Bearer ${session.accessToken}`);
    }

    const response = await fetch(url, { ...opts, headers });

    if (response.status === 401) {
        logout('Your session expired. Please sign in again.');
        throw createApiError('Authentication is required.', response);
    }

    if (response.status === 403) {
        throw createApiError('You do not have permission to perform that action.', response, await readError(response));
    }

    return response;
}

function getDownloadName(contentDisposition, fallback = 'download') {
    if (!contentDisposition) {
        return fallback;
    }

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        return decodeURIComponent(utf8Match[1]);
    }

    const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (asciiMatch?.[1]) {
        return asciiMatch[1];
    }

    return fallback;
}

// Lightweight fetch wrapper used by client helpers
async function fetchJSON(path, opts = {}) {
    const headers = new Headers(opts.headers || {});

    if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
    }

    if (opts.body && !(opts.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const res = await fetchApiResponse(path, { ...opts, headers });
    if (!res.ok) {
        const message = await readError(res);
        throw createApiError(message || `Request failed ${res.status} ${res.statusText}`, res, message);
    }
    if (res.status === 204) return null;
    return res.json().catch(() => null);
}

async function downloadFile(path, opts = {}) {
    const response = await fetchApiResponse(path, opts);
    if (!response.ok) {
        const message = await readError(response);
        throw createApiError(message || `Request failed ${response.status} ${response.statusText}`, response, message);
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = opts.fileName || getDownloadName(response.headers.get('content-disposition'));
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
}

// Client helper functions
const api = {
    endpoints,
    schemas,
    API_BASE,

    // Tasks
    listTasks: async () => fetchJSON(endpoints.listTasks.path),
    createTask: async (task) => fetchJSON(endpoints.createTask.path, { method: 'POST', body: JSON.stringify(task) }),
    updateTask: async (task) => {
        if (!task || task.id == null) throw new Error('Task id is required for update');
        const path = `${endpoints.createTask.path.replace(/\/$/, '')}/${encodeURIComponent(String(task.id))}`;
        return fetchJSON(path, { method: 'PUT', body: JSON.stringify(task) });
    },
    listProjects: async () => fetchJSON(endpoints.listProjects.path),
    createProject: async (project) => fetchJSON(endpoints.createProject.path, { method: 'POST', body: JSON.stringify(project) }),

    // Locations
    listLocations: async () => fetchJSON(endpoints.listLocations.path),
    getLocation: async (id) => fetchJSON(endpoints.getLocation.path.replace(':id', encodeURIComponent(String(id)))),
    createLocation: async (location) => fetchJSON(endpoints.createLocation.path, { method: 'POST', body: JSON.stringify(location) }),
    updateLocation: async (id, location) => fetchJSON(endpoints.updateLocation.path.replace(':id', encodeURIComponent(String(id))), { method: 'PUT', body: JSON.stringify(location) }),
    deleteLocation: async (id) => fetchJSON(endpoints.deleteLocation.path.replace(':id', encodeURIComponent(String(id))), { method: 'DELETE' }),

    // Tags
    listTags: async () => fetchJSON(endpoints.listTags.path),
    createTag: async (name) => fetchJSON(endpoints.createTag.path, { method: 'POST', body: JSON.stringify({ name }) }),
    renameTag: async (oldName, newName) => fetchJSON(endpoints.renameTag.path.replace(':name', encodeURIComponent(String(oldName))), { method: 'PATCH', body: JSON.stringify({ newName }) }),
    deleteTag: async (name) => fetchJSON(endpoints.deleteTag.path.replace(':name', encodeURIComponent(String(name))), { method: 'DELETE' }),

    // Toggle a tag on a location (server may also accept full location updates)
    toggleLocationTag: async (id, tag, present) => fetchJSON(endpoints.toggleLocationTag.path.replace(':id', encodeURIComponent(String(id))), { method: 'POST', body: JSON.stringify({ tag, present }) }),
};

export default api;

// Also export named pieces for convenience
export { API_BASE, downloadFile, endpoints, fetchApiResponse, fetchJSON, readError, schemas };
