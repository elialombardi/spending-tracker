import { APIError, bookmarkURL, canWrite, createAPI, isSessionActive, normalizeSettings, originPermission } from './core.mjs';

const $ = id => document.getElementById(id);
let settings = null;
let storedSession = null;
let folders = [];
let busy = false;
let settingsOpen = false;
let hasPermission = false;
let saved = false;
let expiryTimer;

function message(text, tone = 'info') {
  $('message').textContent = text;
  $('message').dataset.tone = tone;
  $('message').setAttribute('role', tone === 'error' ? 'alert' : 'status');
  $('message').hidden = !text;
}

function render() {
  const configuring = settingsOpen || !settings || !hasPermission;
  $('settings-panel').hidden = !configuring;
  $('login-panel').hidden = configuring || !!storedSession;
  $('bookmark-panel').hidden = configuring || !storedSession;
  $('cancel-settings').hidden = !settings || !hasPermission;
  $('open-app').disabled = busy || !settings;
  $('settings-button').disabled = busy;
  $('sign-out').disabled = busy;
  for (const fieldset of document.querySelectorAll('fieldset')) fieldset.disabled = busy;
  $('refresh-folders').disabled = busy || !storedSession;
  $('save-bookmark').disabled = busy || saved || !folders.length || !canWrite(storedSession?.auth);
  $('save-bookmark').hidden = configuring || !storedSession;
  $('save-bookmark').textContent = saved ? 'Bookmark saved' : 'Save bookmark';
  $('busy-label').textContent = busy ? 'Working...' : storedSession ? 'Connected to your app' : 'Your links, organized.';
  $('server-label').textContent = settings?.apiBase ?? '';
  $('account-label').textContent = storedSession ? `${storedSession.auth.username} - ${storedSession.auth.role}` : '';
  scheduleExpiry();
}

function scheduleExpiry() {
  clearTimeout(expiryTimer);
  if (!storedSession) return;
  const remaining = Date.parse(storedSession.auth.expires_at) - Date.now();
  const delay = Math.min(Math.max(remaining, busy ? 1000 : 0), 2147483647);
  expiryTimer = setTimeout(() => {
    if (busy || isSessionActive(storedSession?.auth)) {
      scheduleExpiry();
      return;
    }
    void run(async () => {
      storedSession = null;
      folders = [];
      await chrome.storage.session.remove('bookmarkSession');
      message('Your session expired. Sign in again.', 'error');
    });
  }, delay);
}

async function run(action) {
  if (busy) return;
  busy = true;
  message('');
  render();
  try {
    await action();
  } catch (error) {
    if (error instanceof APIError && error.status === 401 && storedSession) {
      storedSession = null;
      folders = [];
      try {
        await chrome.storage.session.remove('bookmarkSession');
      } catch {
        message(`${error.message} Could not clear the stored session. Reload the extension before signing in again.`, 'error');
        return;
      }
    }
    message(error instanceof Error ? error.message : 'Something went wrong. Please try again.', 'error');
  } finally {
    busy = false;
    render();
  }
}

async function refreshFolders() {
  const selected = Number($('folder').value) || storedSession.lastFolderId;
  folders = [];
  $('folder').replaceChildren();
  folders = await createAPI(settings.apiBase).listFolders(storedSession.auth);
  for (const folder of folders) {
    const option = document.createElement('option');
    option.value = String(folder.id);
    option.textContent = folder.path;
    $('folder').append(option);
  }
  if (folders.some(folder => folder.id === selected)) $('folder').value = String(selected);
  $('folder-help').textContent = folders.length
    ? 'Only Bookmarks folders are shown, including nested folders.'
    : 'No Bookmarks folders yet. Open the app, create a folder with type Bookmarks, then refresh.';
}

async function captureTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !/^https?:\/\//iu.test(tab.url)) {
    $('page-hint').textContent = 'This page cannot be captured. Enter a web URL manually.';
    return;
  }
  $('url').value = bookmarkURL(tab.url);
  $('title').value = (tab.title || new URL(tab.url).hostname).slice(0, 200);
  $('page-hint').textContent = new URL(tab.url).hostname;
}

async function initialize() {
  if (!globalThis.chrome?.storage?.session || !chrome.permissions || !chrome.tabs) {
    throw new Error('Load this folder as an unpacked Chrome extension and open it from the toolbar.');
  }
  const local = await chrome.storage.local.get('bookmarkSettings');
  if (local.bookmarkSettings) {
    settings = normalizeSettings(local.bookmarkSettings);
    $('app-base').value = settings.appBase;
    $('api-base').value = settings.apiBase;
    hasPermission = await chrome.permissions.contains({ origins: [originPermission(settings.apiBase)] });
  }
  const session = (await chrome.storage.session.get('bookmarkSession')).bookmarkSession;
  if (settings && hasPermission && session?.apiBase === settings.apiBase && isSessionActive(session.auth) && canWrite(session.auth)) {
    storedSession = session;
  } else if (session) {
    await chrome.storage.session.remove('bookmarkSession');
    message('Your connection or session changed. Sign in again.');
  }
  await captureTab();
  if (storedSession) await refreshFolders();
  if (settings && !hasPermission) message('API access was revoked. Save the connection to grant access again.', 'error');
}

$('settings-button').addEventListener('click', () => {
  settingsOpen = true;
  $('app-base').value = settings?.appBase ?? '';
  $('api-base').value = settings?.apiBase ?? '';
  message('');
  render();
  $('app-base').focus();
});
$('cancel-settings').addEventListener('click', () => {
  settingsOpen = false;
  message('');
  render();
});
$('settings-form').addEventListener('submit', event => {
  event.preventDefault();
  void run(async () => {
    const next = normalizeSettings({ appBase: $('app-base').value, apiBase: $('api-base').value });
    const granted = await chrome.permissions.request({ origins: [originPermission(next.apiBase)] });
    if (!granted) throw new Error('API access was not granted. Allow access to connect to this server.');
    const previous = settings;
    if (previous?.apiBase !== next.apiBase) {
      await chrome.storage.session.remove('bookmarkSession');
      storedSession = null;
      folders = [];
    }
    await chrome.storage.local.set({ bookmarkSettings: next });
    settings = next;
    hasPermission = true;
    settingsOpen = false;
    if (previous && originPermission(previous.apiBase) !== originPermission(next.apiBase)) {
      await chrome.permissions.remove({ origins: [originPermission(previous.apiBase)] });
    }
    message(storedSession ? 'Connection saved.' : 'Connection saved. Sign in to start saving bookmarks.', 'success');
  });
});
$('login-form').addEventListener('submit', event => {
  event.preventDefault();
  void run(async () => {
    let auth;
    try {
      auth = await createAPI(settings.apiBase).login($('username').value.trim(), $('password').value);
    } finally {
      $('password').value = '';
    }
    if (!canWrite(auth)) throw new Error('This account is read-only. Sign in with a Writer or Admin account to save bookmarks.');
    const next = { apiBase: settings.apiBase, auth, lastFolderId: null };
    await chrome.storage.session.set({ bookmarkSession: next });
    storedSession = next;
    saved = false;
    await refreshFolders();
    $('title').focus();
  });
});
$('sign-out').addEventListener('click', () => {
  void run(async () => {
    await chrome.storage.session.remove('bookmarkSession');
    storedSession = null;
    folders = [];
    message('Signed out.');
  });
});
$('refresh-folders').addEventListener('click', () => {
  void run(refreshFolders);
});
function draftChanged() {
  if (saved) message('');
  saved = false;
  render();
}
$('bookmark-form').addEventListener('input', draftChanged);
$('bookmark-form').addEventListener('change', draftChanged);
$('bookmark-form').addEventListener('submit', event => {
  event.preventDefault();
  void run(async () => {
    if (saved) return;
    const folderId = Number($('folder').value);
    const api = createAPI(settings.apiBase);
    const currentFolders = await api.listFolders(storedSession.auth);
    await api.saveBookmark(storedSession.auth, {
      folderId, title: $('title').value, url: $('url').value, description: $('description').value,
    }, currentFolders);
    saved = true;
    folders = currentFolders;
    const folder = folders.find(item => item.id === folderId);
    folder.nextPosition += 1;
    storedSession = { ...storedSession, lastFolderId: folderId };
    try {
      await chrome.storage.session.set({ bookmarkSession: storedSession });
    } catch {
      throw new Error('Bookmark saved, but the selected folder could not be remembered for next time.');
    }
    message(`Saved to ${folder.path}.`, 'success');
  });
});
$('open-app').addEventListener('click', () => {
  void run(async () => {
    await chrome.tabs.create({ url: `${settings.appBase}/notes` });
  });
});

void run(initialize);
