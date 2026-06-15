import { useEffect, useRef, useState } from 'react'
import { readError } from '../lib/api'
import {
    CORRECTION_PAGE_SIZE,
    INCOME_PAGE_SIZE,
    MAPPING_PAGE_SIZE,
    REVIEW_PAGE_SIZE,
} from '../lib/constants'
import { getInitialTab } from '../lib/formatters'
import {
    buildCategoryMappingMessage,
    buildCategoryMessage,
    buildCycleIncomeCategoriesMessage,
} from '../lib/messages'

function getEffectiveSelectedCycleStart(selectedCycleStart, cycleOptions) {
    return cycleOptions.some((option) => option.from === selectedCycleStart)
        ? selectedCycleStart
        : cycleOptions[0]?.from || ''
}

function buildComparisonCycleStarts(cycleOptions) {
    if (cycleOptions.length === 0) {
        return []
    }

    return [...cycleOptions.slice(0, 3)]
        .reverse()
        .map((option) => option.from)
}

function clampPage(currentPage, itemCount, pageSize) {
    const pageCount = Math.max(1, Math.ceil(itemCount / pageSize))
    return Math.max(1, Math.min(currentPage, pageCount))
}

function parseDateOnly(value) {
    const [yearText, monthText, dayText] = value.split('-')

    return new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)))
}

function formatDateOnly(date) {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

function buildComparablePreviousCycleEnd(currentCycle, previousCycle) {
    if (!currentCycle || !previousCycle) {
        return ''
    }

    const today = new Date()
    const todayDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
    const currentCycleStart = parseDateOnly(currentCycle.from)
    const currentCycleEnd = parseDateOnly(currentCycle.to)
    const previousCycleStart = parseDateOnly(previousCycle.from)
    const previousCycleEnd = parseDateOnly(previousCycle.to)
    const effectiveCurrentDate = todayDate < currentCycleStart
        ? currentCycleStart
        : todayDate > currentCycleEnd
            ? currentCycleEnd
            : todayDate
    const elapsedDays = Math.max(0, Math.floor((effectiveCurrentDate - currentCycleStart) / 86400000))
    const comparablePreviousCycleEnd = new Date(previousCycleStart)

    comparablePreviousCycleEnd.setUTCDate(comparablePreviousCycleEnd.getUTCDate() + elapsedDays)

    return formatDateOnly(
        comparablePreviousCycleEnd > previousCycleEnd ? previousCycleEnd : comparablePreviousCycleEnd,
    )
}

function buildCategorySpendLookup(transactions) {
    const totalsInCents = {}

    transactions.forEach((transaction) => {
        const categoryName = transaction.category || 'Uncategorized'
        const amountInCents = Math.round(Math.abs(transaction.amount) * 100)

        totalsInCents[categoryName] = (totalsInCents[categoryName] ?? 0) + amountInCents
    })

    return Object.fromEntries(
        Object.entries(totalsInCents).map(([categoryName, totalInCents]) => [categoryName, totalInCents / 100]),
    )
}

function buildCategorizedExpenses(cycleTransactions) {
    return cycleTransactions.filter(
        (transaction) =>
            transaction.direction === 'expense' && !transaction.needsReview && Boolean(transaction.category),
    )
}

function normalizeCategoryNames(categoryNames) {
    const uniqueNames = []

    categoryNames.forEach((categoryName) => {
        const normalizedCategoryName = categoryName.trim().replace(/\s+/g, ' ')

        if (!normalizedCategoryName) {
            return
        }

        if (uniqueNames.some((currentName) => currentName.toLowerCase() === normalizedCategoryName.toLowerCase())) {
            return
        }

        uniqueNames.push(normalizedCategoryName)
    })

    return uniqueNames.sort((left, right) => left.localeCompare(right))
}

async function fetchJson(url, options) {
    const response = await fetch(url, options)

    if (!response.ok) {
        throw new Error(await readError(response))
    }

    if (response.status === 204) {
        return null
    }

    return response.json()
}

async function fetchDashboardData(selectedCycleStart) {
    const [categories, categoryMappings, cycleIncomeCategories, cycleOptions, incomeTransactions] = await Promise.all([
        fetchJson('/api/categories'),
        fetchJson('/api/categories/mappings'),
        fetchJson('/api/categories/cycle-income'),
        fetchJson('/api/reports/cycles'),
        fetchJson('/api/transactions?direction=income'),
    ])

    const effectiveCycleStart = getEffectiveSelectedCycleStart(selectedCycleStart, cycleOptions)
    if (!effectiveCycleStart) {
        return {
            categories,
            categoryMappings,
            categorizedExpenses: [],
            comparisonCycleReports: [],
            cycleTransactions: [],
            cycleIncomeCategories,
            cycleOptions,
            incomeTransactions,
            monthlyReport: null,
            previousCycleCategorySpend: {},
            previousCycleComparison: null,
            reviewQueue: [],
        }
    }

    const comparisonCycleStarts = buildComparisonCycleStarts(cycleOptions)
    const comparisonCycleReports = await Promise.all(
        comparisonCycleStarts.map((cycleStart) =>
            fetchJson(`/api/reports/cycle?cycleStart=${encodeURIComponent(cycleStart)}`),
        ),
    )
    const monthlyReport = comparisonCycleReports.find((report) => report.from === effectiveCycleStart) ?? null

    if (!monthlyReport) {
        return {
            categories,
            categoryMappings,
            categorizedExpenses: [],
            comparisonCycleReports,
            cycleTransactions: [],
            cycleIncomeCategories,
            cycleOptions,
            incomeTransactions,
            monthlyReport: null,
            previousCycleCategorySpend: {},
            previousCycleComparison: null,
            reviewQueue: [],
        }
    }

    const selectedCycleIndex = cycleOptions.findIndex((option) => option.from === effectiveCycleStart)
    const previousCycleOption = selectedCycleIndex >= 0 && selectedCycleIndex < cycleOptions.length - 1
        ? cycleOptions[selectedCycleIndex + 1]
        : null
    const previousCycleComparableTo = previousCycleOption
        ? buildComparablePreviousCycleEnd(monthlyReport, previousCycleOption)
        : ''

    const [reviewQueue, cycleTransactions, previousCycleTransactions] = await Promise.all([
        fetchJson(`/api/transactions?needsReview=true&from=${monthlyReport.from}&to=${monthlyReport.to}`),
        fetchJson(`/api/transactions?from=${monthlyReport.from}&to=${monthlyReport.to}`),
        previousCycleOption
            ? fetchJson(
                `/api/transactions?direction=expense&from=${previousCycleOption.from}&to=${previousCycleComparableTo}`,
            )
            : Promise.resolve([]),
    ])

    return {
        categories,
        categoryMappings,
        categorizedExpenses: buildCategorizedExpenses(cycleTransactions),
        comparisonCycleReports,
        cycleTransactions,
        cycleIncomeCategories,
        cycleOptions,
        incomeTransactions,
        monthlyReport,
        previousCycleCategorySpend: buildCategorySpendLookup(previousCycleTransactions),
        previousCycleComparison: previousCycleOption
            ? {
                comparableTo: previousCycleComparableTo,
                from: previousCycleOption.from,
                to: previousCycleOption.to,
            }
            : null,
        reviewQueue,
    }
}

export function useDashboard() {
    const [activeTab, setActiveTab] = useState(getInitialTab)
    const [selectedCycleStart, setSelectedCycleStart] = useState('')
    const [categories, setCategories] = useState([])
    const [cycleOptions, setCycleOptions] = useState([])
    const [cycleIncomeCategories, setCycleIncomeCategories] = useState({
        usesAllIncomeTransactions: true,
        categories: [],
    })
    const [categoryMappings, setCategoryMappings] = useState([])
    const [comparisonCycleReports, setComparisonCycleReports] = useState([])
    const [cycleTransactions, setCycleTransactions] = useState([])
    const [incomeTransactions, setIncomeTransactions] = useState([])
    const [monthlyReport, setMonthlyReport] = useState(null)
    const [previousCycleCategorySpend, setPreviousCycleCategorySpend] = useState({})
    const [previousCycleComparison, setPreviousCycleComparison] = useState(null)
    const [reviewQueue, setReviewQueue] = useState([])
    const [categorizedExpenses, setCategorizedExpenses] = useState([])
    const [importResult, setImportResult] = useState(null)
    const [reviewPage, setReviewPage] = useState(1)
    const [categorizedPage, setCategorizedPage] = useState(1)
    const [incomePage, setIncomePage] = useState(1)
    const [mappingPage, setMappingPage] = useState(1)
    const [reviewPageSize, setReviewPageSizeState] = useState(REVIEW_PAGE_SIZE)
    const [categorizedPageSize, setCategorizedPageSizeState] = useState(CORRECTION_PAGE_SIZE)
    const [incomePageSize, setIncomePageSizeState] = useState(INCOME_PAGE_SIZE)
    const [mappingPageSize, setMappingPageSizeState] = useState(MAPPING_PAGE_SIZE)
    const [isBusy, setIsBusy] = useState(false)
    const [toastMessage, setToastMessage] = useState('')
    const toastTimeoutRef = useRef(null)

    function showToast(message) {
        setToastMessage(message)

        if (toastTimeoutRef.current) {
            window.clearTimeout(toastTimeoutRef.current)
        }

        toastTimeoutRef.current = window.setTimeout(() => {
            setToastMessage('')
        }, 3200)
    }

    function handleError(error) {
        console.error(error)
        showToast(error instanceof Error ? error.message : 'Something went wrong.')
    }

    function applyDashboardData(data) {
        setCategories(data.categories)
        setComparisonCycleReports(data.comparisonCycleReports)
        setCycleOptions(data.cycleOptions)
        setCycleIncomeCategories(data.cycleIncomeCategories)
        setCategoryMappings(data.categoryMappings)
        setCycleTransactions(data.cycleTransactions)
        setIncomeTransactions(data.incomeTransactions)
        setMonthlyReport(data.monthlyReport)
        setPreviousCycleCategorySpend(data.previousCycleCategorySpend)
        setPreviousCycleComparison(data.previousCycleComparison)
        setReviewQueue(data.reviewQueue)
        setCategorizedExpenses(data.categorizedExpenses)
        if (selectedCycleStart && !data.cycleOptions.some((option) => option.from === selectedCycleStart)) {
            setSelectedCycleStart('')
        }
        setReviewPage((currentPage) => clampPage(currentPage, data.reviewQueue.length, reviewPageSize))
        setCategorizedPage((currentPage) =>
            clampPage(currentPage, data.categorizedExpenses.length, categorizedPageSize),
        )
        setIncomePage((currentPage) => clampPage(currentPage, data.incomeTransactions.length, incomePageSize))
        setMappingPage((currentPage) =>
            clampPage(currentPage, data.categoryMappings.length, mappingPageSize),
        )
    }

    function setReviewPageSize(pageSize) {
        setReviewPageSizeState(pageSize)
        setReviewPage(1)
    }

    function setCategorizedPageSize(pageSize) {
        setCategorizedPageSizeState(pageSize)
        setCategorizedPage(1)
    }

    function setIncomePageSize(pageSize) {
        setIncomePageSizeState(pageSize)
        setIncomePage(1)
    }

    function setMappingPageSize(pageSize) {
        setMappingPageSizeState(pageSize)
        setMappingPage(1)
    }

    async function refreshDashboard() {
        setIsBusy(true)

        try {
            applyDashboardData(await fetchDashboardData(selectedCycleStart))
            return true
        } catch (error) {
            handleError(error)
            return false
        } finally {
            setIsBusy(false)
        }
    }

    async function uploadWorkbook(file) {
        if (!file) {
            showToast('Choose a .xlsx workbook first.')
            return false
        }

        setIsBusy(true)

        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch('/api/imports/poste-italiane', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                throw new Error(await readError(response))
            }

            const result = await response.json()
            applyDashboardData(await fetchDashboardData(selectedCycleStart))
            setImportResult(result)
            showToast('Workbook imported. The review queue is updated.')
            return true
        } catch (error) {
            handleError(error)
            return false
        } finally {
            setIsBusy(false)
        }
    }

    async function categorizeTransaction({ transactionId, category, ruleMode, formContext }) {
        const normalizedCategory = category.trim()

        if (!normalizedCategory) {
            showToast('Choose or type a category before saving.')
            return false
        }

        setIsBusy(true)

        try {
            const response = await fetch(`/api/transactions/${transactionId}/categorize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    category: normalizedCategory,
                    saveRule: ruleMode !== 'one-off',
                    ruleBehavior: ruleMode === 'always-review' ? 'AlwaysReview' : 'AutoApply',
                }),
            })

            if (!response.ok) {
                throw new Error(await readError(response))
            }

            applyDashboardData(await fetchDashboardData(selectedCycleStart))
            showToast(buildCategoryMessage(normalizedCategory, ruleMode, formContext))
            return true
        } catch (error) {
            handleError(error)
            return false
        } finally {
            setIsBusy(false)
        }
    }

    async function saveCategoryMapping({ mappingId, merchantKey, category, behavior }) {
        const normalizedCategory = category.trim()

        if (behavior === 'auto-apply' && !normalizedCategory) {
            showToast('Choose or type a category before saving this mapping.')
            return false
        }

        setIsBusy(true)

        try {
            const response = await fetch(`/api/categories/mappings/${mappingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    category: normalizedCategory,
                    behavior: behavior === 'always-review' ? 'AlwaysReview' : 'AutoApply',
                }),
            })

            if (!response.ok) {
                throw new Error(await readError(response))
            }

            applyDashboardData(await fetchDashboardData(selectedCycleStart))
            showToast(buildCategoryMappingMessage(normalizedCategory, behavior, merchantKey))
            return true
        } catch (error) {
            handleError(error)
            return false
        } finally {
            setIsBusy(false)
        }
    }

    async function saveCycleIncomeCategories(categoryNames) {
        const normalizedCategories = normalizeCategoryNames(categoryNames)

        setIsBusy(true)

        try {
            const response = await fetch('/api/categories/cycle-income', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    categories: normalizedCategories,
                }),
            })

            if (!response.ok) {
                throw new Error(await readError(response))
            }

            applyDashboardData(await fetchDashboardData(selectedCycleStart))
            showToast(buildCycleIncomeCategoriesMessage(normalizedCategories))
            return true
        } catch (error) {
            handleError(error)
            return false
        } finally {
            setIsBusy(false)
        }
    }

    async function deleteCategoryMapping({ mappingId, merchantKey }) {
        const confirmed = window.confirm(
            `Delete the mapping for ${merchantKey}? Future imports will stop using this reusable rule.`,
        )

        if (!confirmed) {
            return false
        }

        setIsBusy(true)

        try {
            const response = await fetch(`/api/categories/mappings/${mappingId}`, {
                method: 'DELETE',
            })

            if (!response.ok) {
                throw new Error(await readError(response))
            }

            applyDashboardData(await fetchDashboardData(selectedCycleStart))
            showToast(`Deleted the mapping for ${merchantKey}.`)
            return true
        } catch (error) {
            handleError(error)
            return false
        } finally {
            setIsBusy(false)
        }
    }

    function triggerExport(format) {
        const cycleStart = selectedCycleStart || cycleOptions[0]?.from
        if (!cycleStart) {
            showToast('No cycle is available to export.')
            return
        }

        window.location.href = `/api/reports/cycle/export?cycleStart=${encodeURIComponent(cycleStart)}&format=${format}`
    }

    const effectiveSelectedCycleStart = getEffectiveSelectedCycleStart(selectedCycleStart, cycleOptions)
    const selectedCycleIndex = cycleOptions.findIndex((option) => option.from === effectiveSelectedCycleStart)
    const hasPreviousCycle = selectedCycleIndex >= 0 && selectedCycleIndex < cycleOptions.length - 1
    const hasNextCycle = selectedCycleIndex > 0

    function goToPreviousCycle() {
        if (!hasPreviousCycle) {
            return
        }

        setSelectedCycleStart(cycleOptions[selectedCycleIndex + 1].from)
    }

    function goToNextCycle() {
        if (!hasNextCycle) {
            return
        }

        setSelectedCycleStart(cycleOptions[selectedCycleIndex - 1].from)
    }

    useEffect(() => {
        const nextUrl = `${window.location.pathname}${window.location.search}#${activeTab}`
        window.history.replaceState(null, '', nextUrl)
    }, [activeTab])

    useEffect(() => {
        let cancelled = false

        async function loadDashboard() {
            setIsBusy(true)

            try {
                const data = await fetchDashboardData(selectedCycleStart)

                if (!cancelled) {
                    applyDashboardData(data)
                }
            } catch (error) {
                if (!cancelled) {
                    handleError(error)
                }
            } finally {
                if (!cancelled) {
                    setIsBusy(false)
                }
            }
        }

        loadDashboard()

        return () => {
            cancelled = true
        }
    }, [selectedCycleStart])

    useEffect(
        () => () => {
            if (toastTimeoutRef.current) {
                window.clearTimeout(toastTimeoutRef.current)
            }
        },
        [],
    )

    return {
        activeTab,
        categories,
        categorizedExpenses,
        categorizedPage,
        categoryMappings,
        categorizeTransaction,
        comparisonCycleReports,
        cycleTransactions,
        cycleIncomeCategories,
        cycleOptions,
        deleteCategoryMapping,
        goToNextCycle,
        goToPreviousCycle,
        hasNextCycle,
        hasPreviousCycle,
        incomePage,
        incomePageSize,
        incomeTransactions,
        importResult,
        isBusy,
        categorizedPageSize,
        mappingPage,
        mappingPageSize,
        monthlyReport,
        previousCycleCategorySpend,
        previousCycleComparison,
        refreshDashboard,
        reviewPage,
        reviewPageSize,
        reviewQueue,
        saveCategoryMapping,
        saveCycleIncomeCategories,
        selectedCycleStart: effectiveSelectedCycleStart,
        setActiveTab,
        setCategorizedPage,
        setCategorizedPageSize,
        setIncomePage,
        setIncomePageSize,
        setMappingPage,
        setMappingPageSize,
        setReviewPage,
        setReviewPageSize,
        setSelectedCycleStart,
        toastMessage,
        triggerExport,
        uploadWorkbook,
    }
}