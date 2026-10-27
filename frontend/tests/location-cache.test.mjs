import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

test('location mutations invalidate shared lists without colliding with YouTube tags; logout clears caches', async () => {
    const originalFetch = globalThis.fetch
    const originalWindow = globalThis.window
    const storage = new Map([
        ['spending-tracker.auth-session', JSON.stringify({
            access_token: 'cache-test-token',
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            role: 'Admin',
        })],
    ])
    globalThis.window = {
        __ENV__: { VITE_API_BASE: 'http://api.test' },
        sessionStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key),
        },
    }
    const calls = []
    let locations = [{ id: 7, title: 'Initial', tags: ['old'] }]
    let tags = ['old']
    let syncStatus = { isSyncing: false }
    globalThis.fetch = async (input, options) => {
        const request = input instanceof Request ? input : new Request(input, options)
        const path = new URL(request.url).pathname
        calls.push(`${request.method} ${path}`)
        let body = null
        if (request.method === 'POST' && path === '/api/auth/login') {
            body = { access_token: 'second-test-account', expires_at: new Date(Date.now() + 3600000).toISOString(), role: 'Admin' }
        } else if (request.method === 'GET' && path === '/api/youtube/sync/status') {
            body = syncStatus
        } else if (request.method === 'GET' && (path === '/api/youtube/channels' || path === '/api/youtube/videos/latest')) {
            body = []
        } else if (request.method === 'POST' && path === '/api/youtube/sync') {
            syncStatus = { isSyncing: true, currentSync: { id: 'sync-1', status: 'pending' } }
            body = { syncId: 'sync-1' }
        } else if (request.method === 'GET') {
            body = path === '/api/locations' ? locations : path === '/api/tags' ? tags : locations[0]
        } else if (path === '/api/locations/7' && request.method === 'PUT') {
            body = { ...locations[0], ...await request.json() }
            locations = [body]
        } else if (path === '/api/locations/7/toggle-tag') {
            body = locations[0]
        } else if (path === '/api/locations' && request.method === 'POST') {
            body = { id: 8, ...await request.json() }
            locations = [...locations, body]
        } else if (path === '/api/locations/7' && request.method === 'DELETE') {
            locations = locations.filter(location => location.id !== 7)
        } else if (path === '/api/tags' && request.method === 'POST') {
            body = (await request.json()).name
            tags = [...tags, body]
        } else if (path === '/api/tags/old' && request.method === 'PATCH') {
            body = (await request.json()).newName
            tags = tags.map(tag => tag === 'old' ? body : tag)
        } else if (path === '/api/tags/new' && request.method === 'DELETE') {
            tags = tags.filter(tag => tag !== 'new')
        } else if (path === '/api/youtube/tags') {
            body = { id: 'youtube-tag', name: 'YouTube' }
        } else {
            throw new Error(`Unexpected request: ${request.method} ${path}`)
        }
        return Response.json(body)
    }
    const server = await createServer({
        configFile: false,
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    })
    let store
    let baseApi
    try {
        ;({ store } = await server.ssrLoadModule('/src/api/store.ts'))
        ;({ baseApi } = await server.ssrLoadModule('/src/api/baseApi.ts'))
        const { locationsApi } = await server.ssrLoadModule('/src/api/locationsApi.ts')
        const { locationTagsApi } = await server.ssrLoadModule('/src/api/locationTagsApi.ts')
        const { youtubeApi } = await server.ssrLoadModule('/src/api/youtube/endpoints.ts')
        const count = request => calls.filter(call => call === request).length
        const settle = () => Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()))
        await store.dispatch(locationsApi.endpoints.listLocations.initiate()).unwrap()
        await store.dispatch(locationTagsApi.endpoints.listTags.initiate()).unwrap()
        await store.dispatch(locationsApi.endpoints.getLocation.initiate(7)).unwrap()
        const initialListCalls = count('GET /api/locations')
        const initialTagCalls = count('GET /api/tags')

        await store.dispatch(locationsApi.endpoints.updateLocation.initiate({ id: 7, location: { title: 'Updated' } })).unwrap()
        await settle()
        assert.equal(locationsApi.endpoints.listLocations.select()(store.getState()).data[0].title, 'Updated')
        assert.equal(count('GET /api/locations/7'), 2)

        await store.dispatch(locationsApi.endpoints.createLocation.initiate({ title: 'Created', tags: [], lat: 1, lng: 2 })).unwrap()
        await settle()
        assert.equal(locationsApi.endpoints.listLocations.select()(store.getState()).data.length, 2)

        await store.dispatch(locationsApi.endpoints.toggleLocationTag.initiate({ id: 7, tag: 'old', present: false })).unwrap()
        await settle()
        await store.dispatch(locationTagsApi.endpoints.renameLocationTag.initiate({ oldName: 'old', newName: 'new' })).unwrap()
        await settle()
        await store.dispatch(locationTagsApi.endpoints.deleteLocationTag.initiate('new')).unwrap()
        await settle()
        await store.dispatch(locationsApi.endpoints.deleteLocation.initiate(7)).unwrap()
        await settle()
        assert.equal(count('GET /api/locations') - initialListCalls, 6)
        assert.equal(count('GET /api/tags') - initialTagCalls, 5)

        await store.dispatch(locationTagsApi.endpoints.createLocationTag.initiate('Location')).unwrap()
        await settle()
        await store.dispatch(youtubeApi.endpoints.createTag.initiate({ name: 'YouTube' })).unwrap()
        assert.equal(count('POST /api/tags'), 1)
        assert.equal(count('POST /api/youtube/tags'), 1)

        await store.dispatch(youtubeApi.endpoints.getChannels.initiate({ includeVideos: true, limit: 10 })).unwrap()
        await store.dispatch(youtubeApi.endpoints.getLatestVideos.initiate({ limit: 20 })).unwrap()
        await store.dispatch(youtubeApi.endpoints.getSyncStatus.initiate()).unwrap()
        await store.dispatch(youtubeApi.endpoints.syncAll.initiate()).unwrap()
        await settle()
        assert.equal(count('GET /api/youtube/channels'), 1)
        assert.equal(youtubeApi.endpoints.getSyncStatus.select()(store.getState()).data.currentSync.status, 'pending')
        syncStatus = { isSyncing: false, lastSync: { id: 'sync-1', status: 'completed' } }
        await store.dispatch(youtubeApi.endpoints.getSyncStatus.initiate(undefined, { forceRefetch: true })).unwrap()
        await settle()
        assert.equal(count('GET /api/youtube/channels'), 2)
        assert.equal(count('GET /api/youtube/videos/latest'), 2)

        const { login, logout } = await server.ssrLoadModule('/src/auth.ts')
        await login({ username: 'second-account', password: 'test-password' })
        assert.deepEqual(store.getState().baseApi.queries, {})
        assert.deepEqual(store.getState().baseApi.mutations, {})
        await store.dispatch(locationsApi.endpoints.listLocations.initiate()).unwrap()
        assert.equal(Object.keys(store.getState().baseApi.queries).length, 1)
        logout()
        assert.deepEqual(store.getState().baseApi.queries, {})
        assert.deepEqual(store.getState().baseApi.mutations, {})
    } finally {
        if (store && baseApi) store.dispatch(baseApi.util.resetApiState())
        await server.close()
        globalThis.fetch = originalFetch
        if (originalWindow === undefined) delete globalThis.window
        else globalThis.window = originalWindow
    }
})
