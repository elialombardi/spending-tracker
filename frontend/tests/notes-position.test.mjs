import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

test('note and folder API requests preserve explicit positions including zero', async () => {
    const originalFetch = globalThis.fetch
    const originalWindow = globalThis.window
    globalThis.window = {
        __ENV__: { VITE_API_BASE: 'http://api.test' },
        sessionStorage: {
            getItem: () => JSON.stringify({
                access_token: 'notes-test-token',
                expires_at: new Date(Date.now() + 3600000).toISOString(),
                role: 'Admin',
            }),
        },
    }
    const calls = []
    const tree = [{
        id: 1, name: 'Folder', position: 2, parentId: null, children: [],
        notes: [{ id: 1, folderId: 1, title: 'Note', position: 4 }],
    }]
    globalThis.fetch = async (input, options) => {
        const request = new Request(input, options)
        const path = new URL(request.url).pathname
        if (request.method === 'GET') return Response.json(tree)
        const payload = await request.json()
        calls.push({ method: request.method, path, payload })
        return Response.json({ id: 1, ...payload })
    }
    const server = await createServer({
        configFile: false,
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    })
    try {
        const { notesApi } = await server.ssrLoadModule('/src/api/domains/notes.ts')
        assert.deepEqual(await notesApi.listNotesTree(), tree)
        for (const position of [5, 0]) {
            assert.equal((await notesApi.createNoteFolder({ name: 'Folder', position })).position, position)
            assert.equal((await notesApi.updateNoteFolder(1, { position })).position, position)
            assert.equal((await notesApi.createNote({ folderId: 1, title: 'Note', content: '', style: {}, position })).position, position)
            assert.equal((await notesApi.updateNote(1, { position })).position, position)
        }
        assert.deepEqual(calls.map(({ method, path, payload }) => [method, path, payload.position]), [
            ['POST', '/api/note-folders', 5],
            ['PUT', '/api/note-folders/1', 5],
            ['POST', '/api/notes', 5],
            ['PUT', '/api/notes/1', 5],
            ['POST', '/api/note-folders', 0],
            ['PUT', '/api/note-folders/1', 0],
            ['POST', '/api/notes', 0],
            ['PUT', '/api/notes/1', 0],
        ])
        await notesApi.updateNoteFolder(1, { name: 'Renamed' })
        await notesApi.updateNote(1, { title: 'Renamed' })
        for (const { payload } of calls.slice(-2)) {
            assert.equal(Object.hasOwn(payload, 'position'), false)
        }
    } finally {
        await server.close()
        globalThis.fetch = originalFetch
        globalThis.window = originalWindow
    }
})
