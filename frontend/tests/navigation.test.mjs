import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

test('sidebar prioritizes the main tools and collapses secondary navigation', async () => {
    const server = await createServer({
        configFile: false,
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    })
    try {
        const { default: SidebarNav } = await server.ssrLoadModule('/src/components/NavBar/SidebarNav.tsx')
        const { getNavigationSections } = await server.ssrLoadModule('/src/components/NavBar/navigationConfig.ts')
        const render = (isAdmin, currentPath) => renderToStaticMarkup(createElement(
            MemoryRouter, { initialEntries: [currentPath] },
            createElement(SidebarNav, {
                isDesktop: true, open: false, onClose() {}, collapsed: false, onCollapse() {},
                sections: getNavigationSections(isAdmin), currentPath,
            }),
        ))
        const main = render(true, '/notes')
        assert.match(main, /aria-label="Main navigation"/)
        assert.match(main, /aria-label="Collapse navigation"/)
        assert.deepEqual([...main.matchAll(/<a [^>]*href="([^"]+)"/g)].map(match => match[1]), [
            '/notes', '/fuel-manager', '/dashboard', '/tasks',
        ])
        assert.match(main, /aria-expanded="false"[^>]*>.*?More tools/)
        assert.match(main, /<a (?=[^>]*aria-current="page")(?=[^>]*href="\/notes")[^>]*>/)

        const secondary = render(true, '/diary')
        assert.match(secondary, /aria-expanded="true"/)
        assert.match(secondary, /<a (?=[^>]*aria-current="page")(?=[^>]*href="\/diary")[^>]*>/)
        assert.equal((secondary.match(/aria-current="page"/g) || []).length, 1)

        const reader = render(false, '/map')
        assert.deepEqual([...reader.matchAll(/<a [^>]*href="([^"]+)"/g)].map(match => match[1]), [
            '/map', '/search', '/cognitive', '/workout',
        ])
        assert.match(reader, /<a (?=[^>]*aria-current="page")(?=[^>]*href="\/map")[^>]*>/)
    } finally {
        await server.close()
    }
})

test('collapsed desktop navigation renders nothing and the sidebar footer hosts the account menu', async () => {
    const server = await createServer({
        configFile: false,
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    })
    try {
        const { default: SidebarNav } = await server.ssrLoadModule('/src/components/NavBar/SidebarNav.tsx')
        const render = props => renderToStaticMarkup(createElement(MemoryRouter, null,
            createElement(SidebarNav, {
                isDesktop: true, open: false, collapsed: false,
                onClose() {}, onCollapse() {}, sections: [], currentPath: '/notes',
                footer: createElement('button', { 'aria-label': 'Account menu' }, 'test'),
                ...props,
            }),
        ))
        assert.equal(render({ collapsed: true }), '')
        const expanded = render({})
        assert.match(expanded, /aria-label="Main navigation"/)
        assert.match(expanded, /aria-label="Collapse navigation"/)
        assert.match(expanded, /aria-label="Account menu"/)
        assert.doesNotMatch(expanded, /<header/)
    } finally {
        await server.close()
    }
})
