import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

test('dashboard reuses cycle requests while preserving review, exclusion, and direction filters', async () => {
    const server = await createServer({
        configFile: false,
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    })
    try {
        const { fetchDashboardData } = await server.ssrLoadModule('/src/dashboard/legacy/hooks/useDashboard.ts')
        const year = new Date().getFullYear() - 1
        const cycles = [
            { from: `${year}-03-28`, to: `${year}-04-27` },
            { from: `${year}-02-28`, to: `${year}-03-27` },
            { from: `${year}-01-28`, to: `${year}-02-27` },
        ]
        const calls = []
        const controller = new AbortController()
        const fetcher = async (path, options) => {
            assert.equal(options.signal, controller.signal)
            calls.push(path)
            if (path === '/api/categories') return []
            if (path === '/api/categories/mappings') return []
            if (path === '/api/categories/cycle-income') return { usesAllIncomeTransactions: true, categories: [] }
            if (path === '/api/reports/cycles') return cycles
            if (path === '/api/transactions?direction=income') return []
            const url = new URL(path, 'http://api.test')
            if (url.pathname === '/api/reports/cycle') {
                return cycles.find(cycle => cycle.from === url.searchParams.get('cycleStart'))
            }
            if (url.pathname === '/api/transactions') {
                const bookingDate = url.searchParams.get('from')
                return [
                    { transactionId: 'expense', bookingDate, amount: -10, direction: 'expense', category: 'Food', needsReview: false },
                    { transactionId: 'excluded-review', bookingDate, amount: -20, direction: 'expense', needsReview: true, excludeFromCalculations: true },
                    { transactionId: 'income', bookingDate, amount: 100, direction: 'income' },
                    { transactionId: 'zero', bookingDate, amount: 0, direction: 'expense' },
                ]
            }
            throw new Error(`Unexpected dashboard request: ${path}`)
        }
        const data = await fetchDashboardData(cycles[0].from, controller.signal, fetcher)
        assert.equal(calls.length, 11)
        assert.equal(new Set(calls).size, calls.length)
        assert.deepEqual(data.reviewQueue.map(transaction => transaction.transactionId), ['excluded-review'])
        assert.deepEqual(data.cycleTransactions.map(transaction => transaction.transactionId), ['expense', 'income', 'zero'])
        assert.deepEqual(data.currentCycleTransactions.map(transaction => transaction.transactionId), ['expense', 'excluded-review'])
        assert.deepEqual(data.comparisonCycleTransactions.map(cycle => cycle.transactions.map(transaction => transaction.transactionId)), [['expense'], ['expense'], ['expense']])
        assert.deepEqual(data.categorizedExpenses.map(transaction => transaction.transactionId), ['expense'])

        await assert.rejects(fetchDashboardData('', undefined, async () => { throw new Error('Report failure') }), /Report failure/)
    } finally {
        await server.close()
    }
})
