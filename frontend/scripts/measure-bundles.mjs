import { build, normalizePath } from 'vite'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const root = resolve(import.meta.dirname, '..')
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'spending-tracker-bundles-'))

async function startupJavaScript(directory) {
    const html = await readFile(join(directory, 'index.html'), 'utf8')
    const files = new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map(match => match[1]))
    let bytes = 0
    let gzipBytes = 0
    for (const file of files) {
        const content = await readFile(join(directory, file))
        bytes += content.length
        gzipBytes += gzipSync(content).length
    }
    return { files: files.size, bytes, gzipBytes }
}

try {
    const lazyDirectory = join(temporaryDirectory, 'lazy')
    const eagerDirectory = join(temporaryDirectory, 'eager')
    await build({ root, build: { outDir: lazyDirectory, emptyOutDir: true } })
    await build({
        root,
        build: { outDir: eagerDirectory, emptyOutDir: true },
        plugins: [{
            name: 'measure-eager-route-baseline',
            enforce: 'pre',
            transform(code, id) {
                if (id !== normalizePath(join(root, 'src/App.tsx'))) return
                const eager = code
                    .replace("const DiaryPage = lazy(() => import('./pages/Diary/DiaryPage'));", "import DiaryPage from './pages/Diary/DiaryPage';")
                    .replace("const YoutubeManager = lazy(() => import('./pages/YoutubeManager').then(module => ({ default: module.YoutubeManager })));", "import { YoutubeManager } from './pages/YoutubeManager';")
                if (eager === code || eager.includes('const DiaryPage = lazy') || eager.includes('const YoutubeManager = lazy')) {
                    throw new Error('Eager route benchmark did not replace both lazy imports')
                }
                return { code: eager, map: null }
            },
        }],
    })
    console.log(JSON.stringify({
        eagerRoutes: await startupJavaScript(eagerDirectory),
        lazyRoutes: await startupJavaScript(lazyDirectory),
    }, null, 2))
} finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
}
