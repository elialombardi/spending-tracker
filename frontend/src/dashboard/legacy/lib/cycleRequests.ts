import type { CycleReport, ReportTransaction } from '../../../types/reports'

export type DashboardFetcher = <T>(path: string, options?: { signal?: AbortSignal }) => Promise<T>

export function createCycleRequests(fetcher: DashboardFetcher, signal?: AbortSignal) {
    const reports = new Map<string, Promise<CycleReport>>()
    const transactions = new Map<string, Promise<ReportTransaction[]>>()
    return {
        report(cycleStart: string) {
            if (!reports.has(cycleStart)) {
                reports.set(cycleStart, fetcher<CycleReport>(
                    `/api/reports/cycle?cycleStart=${encodeURIComponent(cycleStart)}`, { signal },
                ))
            }
            return reports.get(cycleStart)
        },
        transactions(from: string, to: string) {
            const key = `${from}:${to}`
            if (!transactions.has(key)) {
                transactions.set(key, fetcher<ReportTransaction[]>(
                    `/api/transactions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { signal },
                ))
            }
            return transactions.get(key)
        },
    }
}
