import { VALID_TAB_IDS } from './constants'

const currencyFormatter = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
})

const percentFormatter = new Intl.NumberFormat('it-IT', {
    style: 'percent',
    maximumFractionDigits: 1,
})

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
})

export function formatMoney(value) {
    return currencyFormatter.format(value)
}

export function formatPercent(value) {
    return percentFormatter.format(value)
}

export function formatDate(value) {
    return dateFormatter.format(new Date(`${value}T00:00:00`))
}

export function formatReportRange(report) {
    return `Cycle ${formatDate(report.from)} - ${formatDate(report.to)}`
}

export function formatCycleOptionLabel(cycleOption) {
    return `${formatDate(cycleOption.from)} - ${formatDate(cycleOption.to)}`
}

export function getCurrentMonthValue() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function getInitialTab() {
    const hashTab = window.location.hash.replace('#', '')
    return VALID_TAB_IDS.has(hashTab) ? hashTab : 'overview'
}

export function parseMonthValue(monthValue) {
    const [yearText, monthText] = monthValue.split('-')

    return {
        year: Number(yearText),
        month: Number(monthText),
    }
}