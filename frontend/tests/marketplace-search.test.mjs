import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

test('marketplace prices use exact cents and reject invalid thresholds', async () => {
    const server = await createServer({
        configFile: false,
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    })
    try {
        const { parseMaximumPrice, marketplaceError } = await server.ssrLoadModule('/src/helpers/marketplace.ts')
        for (const [value, expected] of [['0.01', 1], ['99.99', 9999], ['100', 10000], [' 12,50 ', 1250], ['1.5', 150]]) {
            assert.equal(parseMaximumPrice(value), expected, value)
        }
        for (const value of ['', '0', '-1', '1.001', '1e2', 'NaN', 'Infinity', '1,000.00', '90071992547409.92']) {
            assert.equal(parseMaximumPrice(value), null, value)
        }
        assert.equal(marketplaceError({ status: 409, data: { error: 'Search is being checked' } }), 'Search is being checked')
        assert.equal(marketplaceError(new Error('Offline')), 'Offline')
    } finally {
        await server.close()
    }
})

test('search API preserves marketplace selections, exact thresholds, pause state and cache invalidation', async () => {
    const originalFetch = globalThis.fetch
    const originalWindow = globalThis.window
    globalThis.window = {
        __ENV__: { VITE_API_BASE: 'http://api.test' },
        sessionStorage: {
            getItem: () => JSON.stringify({
                access_token: 'marketplace-test-token',
                expires_at: new Date(Date.now() + 3600000).toISOString(),
                role: 'User',
            }),
        },
    }
    let searches = []
    const calls = []
    globalThis.fetch = async (input, options) => {
        const request = input instanceof Request ? input : new Request(input, options)
        const path = new URL(request.url).pathname
        assert.equal(request.headers.get('Authorization'), 'Bearer marketplace-test-token')
        const payload = ['POST', 'PUT'].includes(request.method) ? await request.json() : null
        calls.push({ method: request.method, path, payload })
        if (path.endsWith('/configuration')) {
            return Response.json({ dailyEnabled: true, telegramConfigured: true, marketplaces: [
                { id: 'ebay', available: true, configured: true },
                { id: 'facebook', available: false, configured: false },
                { id: 'subito', available: false, configured: false },
            ] })
        }
        if (path.endsWith('/matches')) return Response.json([])
        if (request.method === 'GET') return Response.json(searches)
        if (request.method === 'DELETE') {
            searches = []
            return new Response(null, { status: 204 })
        }
        searches = [{ id: 1, ...payload }]
        return Response.json(searches[0])
    }
    const server = await createServer({
        configFile: false,
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    })
    let store, baseApi
    try {
        ;({ store } = await server.ssrLoadModule('/src/api/store.ts'))
        ;({ baseApi } = await server.ssrLoadModule('/src/api/baseApi.ts'))
        const { marketplaceApi: api } = await server.ssrLoadModule('/src/api/marketplaceApi.ts')
        const settle = () => Promise.all(store.dispatch(baseApi.util.getRunningQueriesThunk()))
        const config = await store.dispatch(api.endpoints.getMarketplaceConfiguration.initiate()).unwrap()
        assert.deepEqual(config.marketplaces.filter(m => !m.available).map(m => m.id), ['facebook', 'subito'])
        await store.dispatch(api.endpoints.getMarketplaceSearches.initiate()).unwrap()
        const input = { keywords: 'bicycle', marketplaces: ['ebay'], maxPriceCents: 9999, enabled: true }
        await store.dispatch(api.endpoints.saveMarketplaceSearch.initiate({ input })).unwrap()
        await settle()
        assert.deepEqual(api.endpoints.getMarketplaceSearches.select()(store.getState()).data, [{ id: 1, ...input }])
        await store.dispatch(api.endpoints.getMarketplaceMatches.initiate(1)).unwrap()
        await store.dispatch(api.endpoints.saveMarketplaceSearch.initiate({ id: 1, input: { ...input, enabled: false } })).unwrap()
        await settle()
        assert.equal(api.endpoints.getMarketplaceSearches.select()(store.getState()).data[0].enabled, false)
        await store.dispatch(api.endpoints.deleteMarketplaceSearch.initiate(1)).unwrap()
        await settle()
        assert.deepEqual(api.endpoints.getMarketplaceSearches.select()(store.getState()).data, [])
        assert.deepEqual(calls.filter(c => c.payload).map(c => [c.method, c.path, c.payload]), [
            ['POST', '/api/marketplace-searches', input],
            ['PUT', '/api/marketplace-searches/1', { ...input, enabled: false }],
        ])
        assert.ok(calls.filter(c => c.method === 'GET' && c.path === '/api/marketplace-searches').length >= 4)
    } finally {
        if (store && baseApi) store.dispatch(baseApi.util.resetApiState())
        await server.close()
        globalThis.fetch = originalFetch
        globalThis.window = originalWindow
    }
})
