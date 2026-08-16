import { ensureAuthenticated, logout } from '../auth';
import { API_BASE } from '../config';

export function isAbsoluteUrl(path) {
  return typeof path === 'string' && (path.startsWith('http://') || path.startsWith('https://'));
}

export function createApiError(message, response, body = '') {
  const error = new Error(message);
  error.body = body;
  error.code = response.status === 401 ? 'AUTH_REQUIRED' : response.status === 403 ? 'FORBIDDEN' : 'API_ERROR';
  error.status = response.status;
  return error;
}

export async function readError(response) {
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

export async function fetchApiResponse(path, opts = {}) {
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

export function getDownloadName(contentDisposition, fallback = 'download') {
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

  const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (asciiMatch?.[1]) return asciiMatch[1];

  return fallback;
}

export async function fetchJSON(path, opts = {}) {
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

export async function downloadFile(path, opts = {}) {
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