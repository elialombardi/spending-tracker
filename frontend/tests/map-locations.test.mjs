import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

test('places search, tag filtering, ordering, and coordinate validation', async () => {
    const server = await createServer({
        configFile: false,
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    })
    try {
        const { filterLocations, isMappableLocation, UNTAGGED } = await server.ssrLoadModule('/src/pages/mapLocations.ts')
        const locations = [
            { id: 1, title: 'Zoo', description: 'Family day in Rome', tags: ['Family', 'Family'], lat: 41, lng: 12 },
            { id: 2, title: 'Art cafe', description: 'Coffee in Rome', tags: ['Food'], lat: 0, lng: 0 },
            { id: 3, title: 'Beach', description: 'Quiet coast', tags: ['', '  '], lat: 91, lng: 12 },
            { id: 4, title: 'Cabin', description: '', tags: null, lat: 45, lng: 8 },
        ]
        const ids = result => result.map(location => location.id)
        assert.deepEqual(ids(filterLocations(locations, '', null)), [2, 3, 4, 1])
        assert.deepEqual(ids(filterLocations(locations, '  ROME   food ', null)), [2])
        assert.deepEqual(ids(filterLocations(locations, 'family', 'Family')), [1])
        assert.deepEqual(ids(filterLocations(locations, 'rome', 'Family')), [1])
        assert.deepEqual(ids(filterLocations(locations, 'coffee', 'Family')), [])
        assert.deepEqual(ids(filterLocations(locations, '', UNTAGGED)), [3, 4])
        assert.deepEqual(ids(filterLocations(locations, 'coast', UNTAGGED)), [3])
        assert.deepEqual(ids(filterLocations(locations, '', 'Unused tag')), [])
        assert.deepEqual(ids(filterLocations([], '', null)), [])
        assert.deepEqual(locations.map(location => location.id), [1, 2, 3, 4], 'sorting must not mutate query data')
        for (const point of [{ lat: 0, lng: 0 }, { lat: -90, lng: 180 }, { lat: 90, lng: -180 }]) {
            assert.equal(isMappableLocation(point), true)
        }
        for (const point of [
            { lat: 91, lng: 0 }, { lat: 0, lng: -181 }, { lat: NaN, lng: 0 },
            { lat: 0, lng: Infinity }, { lat: null, lng: 0 }, { lat: '41', lng: 12 },
        ]) {
            assert.equal(isMappableLocation(point), false)
        }
    } finally {
        await server.close()
    }
})
