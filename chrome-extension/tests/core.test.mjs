import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APIError, bookmarkFolders, bookmarkPayload, bookmarkURL, canWrite, createAPI,
  isSessionActive, normalizeSettings, originPermission,
} from '../core.mjs';

const session = {
  access_token: 'fixture-token',
  expires_at: '2099-01-01T00:00:00Z',
  username: 'fixture-user',
  role: 'Writer',
};
const tree = [{
  id: 1, name: 'Projects', type: 'diary', notes: [], children: [{
    id: 2, name: 'References', type: 'links', children: [],
    notes: [{ position: 0 }, { position: 7 }, { position: 2 }],
  }],
}, {
  id: 3, name: 'Reading', type: 'links', notes: [], children: [],
}];

test('connection URLs preserve proxy base paths and only permit secure or loopback servers', () => {
  assert.deepEqual(normalizeSettings({
    appBase: ' https://tracker.example/app/// ', apiBase: 'http://localhost:7004/backend/',
  }), { appBase: 'https://tracker.example/app', apiBase: 'http://localhost:7004/backend' });
  assert.equal(originPermission('https://api.example:8443/backend'), 'https://api.example:8443/*');
  for (const url of [
    'http://api.example', 'https://user:pass@api.example', 'https://api.example?token=secret',
    'https://api.example/#fragment', 'javascript:alert(1)', '//api.example',
    'https://api.example/has space', 'https://api.example\\@other.example',
  ]) {
    assert.throws(() => normalizeSettings({ appBase: url, apiBase: 'https://api.example' }), Error, url);
    assert.throws(() => normalizeSettings({ appBase: 'https://tracker.example', apiBase: url }), Error, url);
  }
});

test('nested Bookmarks folders include full paths and append after existing positions', () => {
  assert.deepEqual(bookmarkFolders(tree), [
    { id: 2, path: 'Projects / References', nextPosition: 8 },
    { id: 3, path: 'Reading', nextPosition: 0 },
  ]);
  assert.deepEqual(bookmarkFolders([]), []);
  for (const invalid of [{ data: tree }, null, [{ ...tree[0], children: null }]]) {
    assert.throws(() => bookmarkFolders(invalid), /invalid folder tree/);
  }
  assert.throws(() => bookmarkFolders([{
    ...tree[1], notes: [{ position: -1 }],
  }]), /invalid bookmark position/);
});

test('bookmark drafts validate the selected folder and URL without overwriting hidden fields', () => {
  const draft = { folderId: '2', title: ' Reference ', url: ' https://example.com/docs?q=go#intro ', description: '  ' };
  assert.deepEqual(bookmarkPayload(draft, bookmarkFolders(tree)), {
    folderId: 2, title: 'Reference', url: 'https://example.com/docs?q=go#intro', description: null, position: 8,
  });
  assert.equal(bookmarkPayload({ ...draft, description: ' Read later ' }, bookmarkFolders(tree)).description, 'Read later');
  for (const title of ['', '   ', 'x'.repeat(201)]) {
    assert.throws(() => bookmarkPayload({ ...draft, title }, bookmarkFolders(tree)), /Title must/);
  }
  assert.throws(() => bookmarkPayload({ ...draft, folderId: 1 }, bookmarkFolders(tree)), /existing Bookmarks folder/);
  for (const url of [
    '', 'javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', '//example.com',
    'https:example.com', 'https://', 'https://user:pass@example.com', 'https://example.com/with space',
    'https://example.com\\@other.test', 'https://example.com/%zz',
  ]) {
    assert.throws(() => bookmarkURL(url), Error, url);
  }
});

test('expired, malformed, and read-only sessions cannot write', () => {
  assert.equal(canWrite(session), true);
  assert.equal(canWrite({ ...session, role: 'Admin' }), true);
  assert.equal(canWrite({ ...session, role: 'Reader' }), false);
  for (const invalid of [null, {}, { ...session, expires_at: 'invalid' },
    { ...session, expires_at: '2000-01-01T00:00:00Z' }, { ...session, access_token: '' }]) {
    assert.equal(isSessionActive(invalid), false);
    assert.equal(canWrite(invalid), false);
  }
});

test('login, folder reads and bookmark saves use the existing API with isolated credentials', async () => {
  const calls = [];
  const api = createAPI('https://api.example/backend/', async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/login')) return Response.json({ ...session, ignored: 'not persisted' });
    if (url.endsWith('/tree')) return Response.json(tree);
    return Response.json({ id: 10 });
  });
  assert.deepEqual(await api.login('fixture-user', 'fixture-password'), session);
  const folders = await api.listFolders(session);
  assert.deepEqual(await api.saveBookmark(session, {
    folderId: 2, title: 'Docs', url: 'https://example.com', description: '',
  }, folders), { id: 10 });
  assert.deepEqual(calls.map(call => call.url), [
    'https://api.example/backend/api/auth/login',
    'https://api.example/backend/api/note-folders/tree',
    'https://api.example/backend/api/notes',
  ]);
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(calls[0].options.body), { username: 'fixture-user', password: 'fixture-password' });
  assert.equal(calls[1].options.headers.Authorization, 'Bearer fixture-token');
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    folderId: 2, title: 'Docs', url: 'https://example.com', description: null, position: 8,
  });
  for (const { options } of calls) {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.referrerPolicy, 'no-referrer');
  }
});

test('auth failures, server errors, malformed replies and ambiguous saves surface explicitly', async () => {
  const api = response => createAPI('https://api.example', async () => response());
  await assert.rejects(api(() => Response.json({}, { status: 401 })).login('user', 'wrong'), /Invalid username or password/);
  await assert.rejects(api(() => Response.json({}, { status: 401 })).listFolders(session),
    error => error instanceof APIError && error.status === 401 && /expired/.test(error.message));
  await assert.rejects(api(() => Response.json({ error: 'Access denied' }, { status: 403 })).listFolders(session), /Access denied/);
  await assert.rejects(api(() => new Response('<html>proxy failure</html>', { status: 502 })).listFolders(session), /invalid response/);
  await assert.rejects(api(() => Response.json({ access_token: 'incomplete' })).login('user', 'pass'), /invalid or expired/);
  await assert.rejects(api(() => Response.json({ data: tree })).listFolders(session), /invalid folder tree/);
  await assert.rejects(api(() => { throw new TypeError('Network failure'); }).listFolders(session), /Could not reach the API/);
  await assert.rejects(api(() => { throw new DOMException('timeout', 'TimeoutError'); }).listFolders(session), /timed out/);
  await assert.rejects(api(() => Response.json({})).saveBookmark(session, {
    folderId: 3, title: 'Docs', url: 'https://example.com', description: '',
  }, bookmarkFolders(tree)), /did not confirm the saved bookmark/);
});

test('invalid sessions, read-only users and missing folders never send a bookmark request', async () => {
  let requests = 0;
  const api = createAPI('https://api.example', async () => { requests++; return Response.json({ id: 10 }); });
  const draft = { folderId: 2, title: 'Docs', url: 'https://example.com', description: '' };
  await assert.rejects(api.saveBookmark({ ...session, role: 'Reader' }, draft, bookmarkFolders(tree)), /Writer or Admin/);
  await assert.rejects(api.saveBookmark({ ...session, expires_at: '2000-01-01' }, draft, bookmarkFolders(tree)), /expired/);
  await assert.rejects(api.saveBookmark(session, draft, []), /existing Bookmarks folder/);
  assert.equal(requests, 0);
});
