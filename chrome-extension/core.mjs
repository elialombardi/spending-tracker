export function bookmarkURL(value) {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed) || /[\s\\]/u.test(trimmed) || /%(?![\da-f]{2})/iu.test(trimmed)) {
    throw new Error('Enter a complete HTTP or HTTPS page URL without credentials or spaces.');
  }
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Enter a valid HTTP or HTTPS page URL.');
  }
  if (!url.hostname || url.username || url.password) {
    throw new Error('Page URLs must have a hostname and cannot contain credentials.');
  }
  return trimmed;
}

function baseURL(value, label) {
  const normalized = bookmarkURL(value);
  const url = new URL(normalized);
  if (url.search || url.hash) {
    throw new Error(`${label} cannot include a query string or fragment.`);
  }
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error(`${label} must use HTTPS. HTTP is allowed only on localhost.`);
  }
  return `${url.origin}${url.pathname.replace(/\/+$/u, '')}`;
}

export function normalizeSettings({ appBase, apiBase }) {
  return { appBase: baseURL(appBase, 'App URL'), apiBase: baseURL(apiBase, 'API URL') };
}

export function originPermission(apiBase) {
  return `${new URL(apiBase).origin}/*`;
}

export function isSessionActive(session, now = Date.now()) {
  return !!session && typeof session.access_token === 'string' && !!session.access_token.trim()
    && typeof session.username === 'string' && !!session.username.trim()
    && ['Reader', 'Writer', 'Admin'].includes(session.role)
    && typeof session.expires_at === 'string' && Date.parse(session.expires_at) > now;
}

export function canWrite(session) {
  return isSessionActive(session) && (session.role === 'Writer' || session.role === 'Admin');
}

export function bookmarkFolders(tree) {
  if (!Array.isArray(tree)) throw new Error('The API returned an invalid folder tree.');
  const result = [];
  function visit(nodes, ancestors) {
    for (const node of nodes) {
      if (!node || !Number.isSafeInteger(node.id) || node.id <= 0 || typeof node.name !== 'string'
        || !Array.isArray(node.children) || !Array.isArray(node.notes)) {
        throw new Error('The API returned an invalid folder tree.');
      }
      const path = [...ancestors, node.name];
      if (node.type === 'links') {
        let nextPosition = 0;
        for (const note of node.notes) {
          if (!Number.isSafeInteger(note.position) || note.position < 0 || note.position >= Number.MAX_SAFE_INTEGER) {
            throw new Error(`Folder "${path.join(' / ')}" contains an invalid bookmark position.`);
          }
          nextPosition = Math.max(nextPosition, note.position + 1);
        }
        result.push({ id: node.id, path: path.join(' / '), nextPosition });
      }
      visit(node.children, path);
    }
  }
  visit(tree, []);
  return result;
}

export function bookmarkPayload({ folderId, title, url, description }, folders) {
  const folder = folders.find(item => item.id === Number(folderId));
  if (!folder) throw new Error('Choose an existing Bookmarks folder. Refresh folders if it was moved or deleted.');
  const trimmedTitle = title.trim();
  if (!trimmedTitle || trimmedTitle.length > 200) throw new Error('Title must contain between 1 and 200 characters.');
  return {
    folderId: folder.id,
    title: trimmedTitle,
    url: bookmarkURL(url),
    description: description.trim() || null,
    position: folder.nextPosition,
  };
}

export class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

export function createAPI(apiBase, fetchRequest = fetch) {
  const base = baseURL(apiBase, 'API URL');
  async function request(path, { token, body, method = 'GET' } = {}) {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await fetchRequest(`${base}${path}`, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
        credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer',
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      throw new Error(error.name === 'TimeoutError'
        ? 'The API timed out. If you were saving, check the app before trying again.'
        : 'Could not reach the API. Check the URL, site permission, and HTTPS certificate. If saving, check the app before retrying.');
    }
    if (response.status === 401) {
      throw new APIError(token ? 'Your session expired. Sign in again.' : 'Invalid username or password.', 401);
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new APIError(`The API returned an invalid response (HTTP ${response.status}). Check the API base URL.`, response.status);
    }
    if (!response.ok) {
      const detail = data?.error || data?.message || data?.detail;
      throw new APIError(typeof detail === 'string' ? detail : `The request failed (HTTP ${response.status}).`, response.status);
    }
    return data;
  }
  return {
    async login(username, password) {
      const session = await request('/api/auth/login', { method: 'POST', body: { username, password } });
      if (!isSessionActive(session)) throw new Error('The API returned an invalid or expired sign-in session.');
      return {
        access_token: session.access_token, expires_at: session.expires_at,
        username: session.username, role: session.role,
      };
    },
    async listFolders(session) {
      if (!isSessionActive(session)) throw new APIError('Your session expired. Sign in again.', 401);
      return bookmarkFolders(await request('/api/note-folders/tree', { token: session.access_token }));
    },
    async saveBookmark(session, draft, folders) {
      if (!isSessionActive(session)) throw new APIError('Your session expired. Sign in again.', 401);
      if (!canWrite(session)) throw new APIError('Saving bookmarks requires a Writer or Admin account.', 403);
      const payload = bookmarkPayload(draft, folders);
      const note = await request('/api/notes', { token: session.access_token, method: 'POST', body: payload });
      if (!Number.isSafeInteger(note?.id) || note.id <= 0) {
        throw new Error('The API did not confirm the saved bookmark. Check the app before trying again.');
      }
      return note;
    },
  };
}
