import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { createServer } from 'vite'

const serverOptions = {
    configFile: false,
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
}

test('note editors show only the fields for their folder type', async () => {
    const server = await createServer(serverOptions)
    try {
        const { NoteEditor } = await server.ssrLoadModule('/src/components/Notes/NoteEditor.tsx')
        const { defaultStyle } = await server.ssrLoadModule('/src/components/Notes/types.ts')
        const props = {
            title: 'Milk', position: '0', content: 'Private diary content',
            description: 'Task details', endDate: '', completed: true, style: defaultStyle,
            canWrite: true, errorMessage: '', onPositionChange() {}, onTitleChange() {},
            onContentChange() {}, onStyleChange() {}, onDescriptionChange() {},
            onEndDateChange() {}, onCompletedChange() {},
        }
        const render = folderType => renderToStaticMarkup(createElement(
            LocalizationProvider, { dateAdapter: AdapterDateFns },
            createElement(NoteEditor, { ...props, folderType }),
        ))
        const buyList = render('buy_list')
        assert.match(buyList, /Purchased/)
        assert.match(buyList, /type="checkbox"[^>]*checked/)
        assert.doesNotMatch(buyList, /Private diary content|Task details|End date|Description|Content/)
        const tasksList = render('tasks_list')
        assert.match(tasksList, /Done/)
        assert.match(tasksList, /Task details/)
        assert.match(tasksList, /End date \(optional\)/)
        assert.doesNotMatch(tasksList, /Private diary content/)
        const diary = render('diary')
        assert.match(diary, /Private diary content/)
        assert.doesNotMatch(diary, /Purchased|Task details|End date|>Done</)
    } finally {
        await server.close()
    }
})

test('sidebar tree displays nested folders and types but never items or completion controls', async () => {
    const server = await createServer(serverOptions)
    try {
        const { NoteTree } = await server.ssrLoadModule('/src/components/Notes/NoteTree.tsx')
        const tree = ['buy_list', 'tasks_list', 'diary'].map((type, index) => ({
            id: index + 1, name: type, type, position: 0, children: [],
            notes: [{ id: index + 1, title: `Item ${index}`, completed: true, endDate: '2026-11-30' }],
        }))
        tree[0].children.push({
            id: 4, name: 'Nested folder', type: 'diary', children: [],
            notes: [{ id: 4, title: 'Nested item' }],
        })
        const markup = renderToStaticMarkup(createElement(NoteTree, {
            tree, selectedFolderID: 1, onSelectFolder() {},
        }))
        assert.match(markup, /Buy list/)
        assert.match(markup, /Tasks list/)
        assert.match(markup, /Diary/)
        assert.match(markup, /Nested folder/)
        assert.equal((markup.match(/aria-label="1 item"/g) || []).length, 4)
        assert.equal((markup.match(/aria-current="page"/g) || []).length, 1)
        assert.doesNotMatch(markup, /Item [012]|Nested item|type="checkbox"|End date:/)
    } finally {
        await server.close()
    }
})

test('folder actions have accessible labels and retain selection and read-only restrictions', async () => {
    const server = await createServer(serverOptions)
    try {
        const { FolderActions } = await server.ssrLoadModule('/src/components/Notes/FolderActions.tsx')
        const props = {
            selectedFolder: { id: 1, name: 'Selected folder' }, isSidebarOpen: true,
            onOpenCreateDialog() {}, onOpenCreateRootDialog() {}, onToggleSidebar() {},
            onOpenRenameDialog() {}, onDeleteFolder() {},
        }
        const render = overrides => renderToStaticMarkup(createElement(FolderActions, { ...props, canWrite: true, ...overrides }))
        const writable = render({})
        for (const label of ['Add root folder', 'Add child folder', 'Edit folder', 'Delete folder', 'Collapse sidebar']) {
            assert.match(writable, new RegExp(`aria-label="${label}"`))
        }
        assert.match(writable, /New folder/)
        assert.match(writable, /Subfolder/)
        assert.equal((writable.match(/disabled=""/g) || []).length, 0)
        assert.equal((render({ canWrite: false }).match(/disabled=""/g) || []).length, 4)
        assert.equal((render({ selectedFolder: null }).match(/disabled=""/g) || []).length, 3)
        assert.match(render({ isSidebarOpen: false }), /aria-label="Expand sidebar"/)
    } finally {
        await server.close()
    }
})

test('main item list shows only the selected folder and preserves type-specific completion controls', async () => {
    const server = await createServer(serverOptions)
    try {
        const { NoteList } = await server.ssrLoadModule('/src/components/Notes/NoteList.tsx')
        for (const type of ['buy_list', 'tasks_list', 'diary']) {
            const props = {
                folder: {
                    id: 1, name: 'Selected folder', type, children: [{
                        id: 2, name: 'Child folder', type: 'buy_list', children: [],
                        notes: [{ id: 2, title: 'Child item' }],
                    }],
                    notes: [{ id: 1, title: 'Selected item', completed: true, endDate: '2026-11-30' }],
                },
                selectedNoteID: 1, isBusy: false, onSelectNote() {}, onToggleCompleted() {},
            }
            const writable = renderToStaticMarkup(createElement(NoteList, { ...props, canWrite: true }))
            assert.match(writable, /Selected item/)
            assert.match(writable, /aria-label="Folder items"/)
            assert.doesNotMatch(writable, /Child item|Child folder/)
            if (type === 'diary') {
                assert.doesNotMatch(writable, /type="checkbox"|End date:/)
            } else {
                assert.equal((writable.match(/type="checkbox"/g) || []).length, 1)
                assert.match(writable, new RegExp(`${type === 'buy_list' ? 'Purchased' : 'Done'}: Selected item`))
                const readonly = renderToStaticMarkup(createElement(NoteList, { ...props, canWrite: false }))
                assert.equal((readonly.match(/disabled="" type="checkbox"/g) || []).length, 1)
                const busy = renderToStaticMarkup(createElement(NoteList, { ...props, canWrite: true, isBusy: true }))
                assert.equal((busy.match(/disabled="" type="checkbox"/g) || []).length, 1)
            }
            assert.equal(writable.includes('End date: 2026-11-30'), type === 'tasks_list')
        }
        for (const type of ['buy_list', 'tasks_list', 'diary']) {
            const empty = renderToStaticMarkup(createElement(NoteList, {
                folder: { id: 1, name: 'Empty', type, notes: [] },
                selectedNoteID: null, canWrite: true, isBusy: false,
                onSelectNote() {}, onToggleCompleted() {},
            }))
            assert.match(empty, type === 'diary' ? /No notes in this folder/ : /No items in this folder/)
        }
    } finally {
        await server.close()
    }
})

test('notes API supports types, title-only items, date clearing and completion without resetting hidden fields', async () => {
    const originalFetch = globalThis.fetch
    const originalWindow = globalThis.window
    globalThis.window = {
        __ENV__: { VITE_API_BASE: 'http://api.test' },
        sessionStorage: {
            getItem: () => JSON.stringify({
                access_token: 'notes-types-test', expires_at: new Date(Date.now() + 3600000).toISOString(), role: 'Admin',
            }),
        },
    }
    const calls = []
    globalThis.fetch = async (input, options) => {
        const request = new Request(input, options)
        const payload = await request.json()
        calls.push({ method: request.method, path: new URL(request.url).pathname, payload })
        return Response.json({ id: 1, ...payload })
    }
    const server = await createServer(serverOptions)
    try {
        const { notesApi } = await server.ssrLoadModule('/src/api/domains/notes.ts')
        await notesApi.createNoteFolder({ name: 'Shopping', type: 'buy_list' })
        await notesApi.updateNoteFolder(1, { type: 'tasks_list' })
        await notesApi.createNote({ folderId: 1, title: 'Milk' })
        await notesApi.createNote({ folderId: 1, title: 'Task', description: 'Details', endDate: '2026-11-30', completed: true })
        await notesApi.updateNote(1, { completed: false })
        await notesApi.updateNote(1, { endDate: '' })
        await notesApi.createNote({ folderId: 1, title: 'No description', description: null })
        await notesApi.updateNote(1, { description: null })
        await notesApi.updateNote(1, { title: 'Preserve description' })
        assert.deepEqual(calls, [
            { method: 'POST', path: '/api/note-folders', payload: { name: 'Shopping', type: 'buy_list' } },
            { method: 'PUT', path: '/api/note-folders/1', payload: { type: 'tasks_list' } },
            { method: 'POST', path: '/api/notes', payload: { folderId: 1, title: 'Milk' } },
            { method: 'POST', path: '/api/notes', payload: { folderId: 1, title: 'Task', description: 'Details', endDate: '2026-11-30', completed: true } },
            { method: 'PUT', path: '/api/notes/1', payload: { completed: false } },
            { method: 'PUT', path: '/api/notes/1', payload: { endDate: '' } },
            { method: 'POST', path: '/api/notes', payload: { folderId: 1, title: 'No description', description: null } },
            { method: 'PUT', path: '/api/notes/1', payload: { description: null } },
            { method: 'PUT', path: '/api/notes/1', payload: { title: 'Preserve description' } },
        ])
    } finally {
        await server.close()
        globalThis.fetch = originalFetch
        globalThis.window = originalWindow
    }
})
