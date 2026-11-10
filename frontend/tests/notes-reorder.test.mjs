import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const serverOptions = {
    configFile: false,
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
}

test('reordering persists unique positions for tied, sparse, and already ordered siblings', async () => {
    const server = await createServer(serverOptions)
    try {
        const { reorderItems } = await server.ssrLoadModule('/src/components/Notes/utils/noteTreeUtils.ts')
        for (const positions of [[0, 0, 0], [4, 12, 30], [0, 1, 2]]) {
            for (const [id, direction, expected] of [[2, -1, [2, 1, 3]], [2, 1, [1, 3, 2]]]) {
                const items = positions.map((position, index) => ({ id: index + 1, position }))
                const original = structuredClone(items)
                const stored = structuredClone(items)
                const calls = []
                const updates = await reorderItems(items, id, direction, async (id, position) => {
                    calls.push({ id, position })
                    stored.find(item => item.id === id).position = position
                })
                assert.deepEqual(calls, updates)
                assert.deepEqual(stored.sort((a, b) => a.position - b.position).map(item => item.id), expected)
                assert.deepEqual(stored.map(item => item.position), [0, 1, 2])
                assert.deepEqual(items, original, 'does not mutate the rendered tree')
                assert.equal(updates.every(update => original.find(item => item.id === update.id).position !== update.position), true)
            }
        }
        for (const [id, direction] of [[1, -1], [3, 1], [999, 1]]) {
            assert.deepEqual(await reorderItems(
                [1, 2, 3].map((id, position) => ({ id, position })),
                id, direction, () => assert.fail('boundary move must not save'),
            ), [])
        }
        assert.deepEqual(await reorderItems([], 1, 1, () => assert.fail('empty list must not save')), [])
    } finally {
        await server.close()
    }
})

test('reordering stops and reports a failed save instead of returning success', async () => {
    const server = await createServer(serverOptions)
    try {
        const { reorderItems } = await server.ssrLoadModule('/src/components/Notes/utils/noteTreeUtils.ts')
        const calls = []
        await assert.rejects(reorderItems(
            [1, 2, 3].map(id => ({ id, position: 0 })),
            1, 1, async (id, position) => {
                calls.push({ id, position })
                throw new Error('Save failed')
            },
        ), /Save failed/)
        assert.equal(calls.length, 1)
    } finally {
        await server.close()
    }
})

test('reorder controls respect sibling boundaries, nested folders, permissions and busy state', async () => {
    const server = await createServer(serverOptions)
    try {
        const { NoteTree } = await server.ssrLoadModule('/src/components/Notes/NoteTree.tsx')
        const { NoteList } = await server.ssrLoadModule('/src/components/Notes/NoteList.tsx')
        const folder = (id, name) => ({ id, name, type: 'diary', position: 0, children: [], notes: [] })
        const tree = [folder(1, 'First'), folder(2, 'Last')]
        tree[0].children = [folder(3, 'Only child')]
        const treeProps = { tree, selectedFolderID: 1, onSelectFolder() {}, onMoveFolder() {} }
        const renderTree = (canWrite, isBusy = false) => renderToStaticMarkup(createElement(NoteTree, {
            ...treeProps, canWrite, isBusy,
        }))
        const button = (markup, label) => {
            const tag = markup.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))
            assert.ok(tag, `missing ${label}`)
            return tag[0]
        }
        const writable = renderTree(true)
        assert.match(button(writable, 'Move folder First up'), /disabled=""/)
        assert.doesNotMatch(button(writable, 'Move folder First down'), /disabled=""/)
        assert.doesNotMatch(button(writable, 'Move folder Last up'), /disabled=""/)
        assert.match(button(writable, 'Move folder Last down'), /disabled=""/)
        for (const direction of ['up', 'down']) {
            assert.match(button(writable, `Move folder Only child ${direction}`), /disabled=""/)
            assert.match(button(renderTree(true, true), `Move folder First ${direction}`), /disabled=""/)
        }
        assert.doesNotMatch(renderTree(false), /aria-label="Move folder/)

        for (const type of ['buy_list', 'tasks_list', 'diary']) {
            const listProps = {
                folder: { ...folder(1, 'Items'), type, notes: [
                    { id: 1, title: 'First item', position: 0 },
                    { id: 2, title: 'Last item', position: 0 },
                ] },
                selectedNoteID: 1, onSelectNote() {}, onToggleCompleted() {}, onMoveNote() {},
            }
            const renderList = (canWrite, isBusy = false) => renderToStaticMarkup(createElement(NoteList, {
                ...listProps, canWrite, isBusy,
            }))
            const markup = renderList(true)
            assert.match(button(markup, 'Move item First item up'), /disabled=""/)
            assert.doesNotMatch(button(markup, 'Move item First item down'), /disabled=""/)
            assert.doesNotMatch(button(markup, 'Move item Last item up'), /disabled=""/)
            assert.match(button(markup, 'Move item Last item down'), /disabled=""/)
            assert.match(button(renderList(true, true), 'Move item First item down'), /disabled=""/)
            assert.doesNotMatch(renderList(false), /aria-label="Move item/)
        }
    } finally {
        await server.close()
    }
})
