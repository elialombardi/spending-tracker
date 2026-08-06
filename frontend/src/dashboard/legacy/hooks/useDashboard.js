import { useCallback, useEffect, useRef, useState } from 'react'
import { canWrite, useAuthSession } from '../../../auth'
import { fetchJson, fetchApiResponse, downloadFile, readError } from '../lib/api'
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

function getInitialSelectedCycleStart() {
    const searchParams = new URLSearchParams(window.location.search)

    return searchParams.get('cycleStart') || ''
}

function getEffectiveSelectedCycleStart(selectedCycleStart, cycleOptions) {
    return cycleOptions.some((option) => option.from === selectedCycleStart)
        ? selectedCycleStart
        : cycleOptions[0]?.from || ''
}

function buildComparisonCycleStarts(selectedCycleStart, cycleOptions) {
    if (cycleOptions.length === 0) {
        return []
    }

    const selectedCycleIndex = cycleOptions.findIndex((option) => option.from === selectedCycleStart)
    const comparisonStartIndex = selectedCycleIndex >= 0 ? selectedCycleIndex : 0

    return [...cycleOptions.slice(comparisonStartIndex, comparisonStartIndex + 3)]
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

function getTodayDateOnly() {
    const today = new Date()

    return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
}

function getCurrentCycleOption(cycleOptions, todayText) {
    return cycleOptions.find((option) => option.from <= todayText) ?? null
}

function getCycleEndFromStart(cycleStart) {
    const cycleStartDate = parseDateOnly(cycleStart)
    const cycleEndDate = new Date(Date.UTC(
        cycleStartDate.getUTCFullYear(),
        cycleStartDate.getUTCMonth() + 1,
        27,
    ))

    return {
        from: cycleStart,
        to: formatDateOnly(cycleEndDate),
    }
}

async function fetchCurrentCycleData(cycleOptions, existingReports = []) {
    const today = formatDateOnly(getTodayDateOnly())
    const currentCycleOption = getCurrentCycleOption(cycleOptions, today)
    const existingCurrentCycleReport = currentCycleOption
        ? existingReports.find((report) => report.from === currentCycleOption.from) ?? null
        : null
    const currentCycleRange = currentCycleOption
        ? getCycleEndFromStart(currentCycleOption.from)
        : null

    const [currentCycleReport, currentCycleTransactions] = await Promise.all([
        currentCycleOption && !existingCurrentCycleReport
            ? fetchJson(`/api/reports/cycle?cycleStart=${encodeURIComponent(currentCycleOption.from)}`)
            : Promise.resolve(existingCurrentCycleReport),
        currentCycleRange
            ? fetchJson(`/api/transactions?direction=expense&from=${currentCycleRange.from}&to=${currentCycleRange.to}`)
            : Promise.resolve([]),
    ])

    return {
        currentCycleReport: currentCycleReport
            ? {
                ...currentCycleReport,
                to: currentCycleRange?.to ?? currentCycleReport.to,
            }
            : null,
        currentCycleTransactions,
    }
}

function buildComparableCycleEnd(referenceCycle, comparedCycle) {
    if (!referenceCycle || !comparedCycle) {
        return ''
    }

    const today = new Date()
    const todayDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
    const referenceCycleStart = parseDateOnly(referenceCycle.from)
    const referenceCycleEnd = parseDateOnly(referenceCycle.to)
    const comparedCycleStart = parseDateOnly(comparedCycle.from)
    const comparedCycleEnd = parseDateOnly(comparedCycle.to)
    const effectiveCurrentDate = todayDate < referenceCycleStart
        ? referenceCycleStart
        : todayDate > referenceCycleEnd
            ? referenceCycleEnd
            : todayDate
    const elapsedDays = Math.max(0, Math.floor((effectiveCurrentDate - referenceCycleStart) / 86400000))
    const comparableCycleEnd = new Date(comparedCycleStart)

    comparableCycleEnd.setUTCDate(comparableCycleEnd.getUTCDate() + elapsedDays)

    return formatDateOnly(
        comparableCycleEnd > comparedCycleEnd ? comparedCycleEnd : comparableCycleEnd,
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
            transaction.direction === 'expense' && !transaction.needsReview && !transaction.excludeFromCalculations && Boolean(transaction.category),
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

// use `fetchJson` from ../lib/api which prefixes the shared API base

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
        const { currentCycleReport, currentCycleTransactions } = await fetchCurrentCycleData(cycleOptions)

        return {
            categories,
            categoryMappings,
            categorizedExpenses: [],
            comparisonCycleReports: [],
            comparisonCycleTransactions: [],
            currentCycleReport,
            currentCycleTransactions,
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

    const comparisonCycleStarts = buildComparisonCycleStarts(effectiveCycleStart, cycleOptions)
    const comparisonCycleReports = await Promise.all(
        comparisonCycleStarts.map((cycleStart) =>
            fetchJson(`/api/reports/cycle?cycleStart=${encodeURIComponent(cycleStart)}`),
        ),
    )
    const { currentCycleReport, currentCycleTransactions } = await fetchCurrentCycleData(
        cycleOptions,
        comparisonCycleReports,
    )
    const monthlyReport = comparisonCycleReports.find((report) => report.from === effectiveCycleStart) ?? null

    if (!monthlyReport) {
        return {
            categories,
            categoryMappings,
            categorizedExpenses: [],
            comparisonCycleReports,
            comparisonCycleTransactions: [],
            currentCycleReport,
            currentCycleTransactions,
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
        ? buildComparableCycleEnd(monthlyReport, previousCycleOption)
        : ''
    const [reviewQueue, cycleTransactions, comparisonCycleTransactions] = await Promise.all([
        fetchJson(`/api/transactions?needsReview=true&from=${monthlyReport.from}&to=${monthlyReport.to}`),
        fetchJson(`/api/transactions?from=${monthlyReport.from}&to=${monthlyReport.to}`).then((transactions) =>
            transactions.filter((transaction) => !transaction.excludeFromCalculations),
        ),
        Promise.all(
            comparisonCycleReports.map(async (report) => {
                const transactions = await fetchJson(
                    `/api/transactions?direction=expense&from=${report.from}&to=${report.to}`,
                )

                return {
                    from: report.from,
                    transactions: transactions.filter((transaction) => !transaction.excludeFromCalculations),
                }
            }),
        ),
    ])
    const previousCycleComparisonEntry = previousCycleOption
        ? comparisonCycleTransactions.find((entry) => entry.from === previousCycleOption.from) ?? null
        : null
    const previousCycleTransactions = previousCycleComparisonEntry
        ? previousCycleComparisonEntry.transactions.filter(
            (transaction) => transaction.bookingDate <= previousCycleComparableTo,
        )
        : []

    return {
        categories,
        categoryMappings,
        categorizedExpenses: buildCategorizedExpenses(cycleTransactions),
        comparisonCycleReports,
        comparisonCycleTransactions,
        currentCycleReport,
        currentCycleTransactions,
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
    const { session } = useAuthSession()
    const userCanWrite = canWrite(session)
    const [activeTab, setActiveTab] = useState(getInitialTab)
    const [selectedCycleStart, setSelectedCycleStart] = useState(getInitialSelectedCycleStart)
    const [categories, setCategories] = useState([])
    const [cycleOptions, setCycleOptions] = useState([])
    const [cycleIncomeCategories, setCycleIncomeCategories] = useState({
        usesAllIncomeTransactions: true,
        categories: [],
    })
    const [categoryMappings, setCategoryMappings] = useState([])
    const [comparisonCycleReports, setComparisonCycleReports] = useState([])
    const [comparisonCycleTransactions, setComparisonCycleTransactions] = useState([])
    const [currentCycleReport, setCurrentCycleReport] = useState(null)
    const [currentCycleTransactions, setCurrentCycleTransactions] = useState([])
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

    const showToast = useCallback((message) => {
        setToastMessage(message)

        if (toastTimeoutRef.current) {
            window.clearTimeout(toastTimeoutRef.current)
        }

        toastTimeoutRef.current = window.setTimeout(() => {
            setToastMessage('')
        }, 3200)
    }, [])

    const handleError = useCallback((error) => {
        console.error(error)
        if (error?.code === 'AUTH_REQUIRED') {
            showToast('Your session expired. Please sign in again.')
            return
        }

        if (error?.code === 'FORBIDDEN') {
            showToast('You need a Writer or Admin account to modify data.')
            return
        }

        showToast(error instanceof Error ? error.message : 'Something went wrong.')
    }, [showToast])

    const requireWriteAccess = useCallback(() => {
        if (userCanWrite) {
            return true
        }

        showToast('You need a Writer or Admin account to modify data.')
        return false
    }, [showToast, userCanWrite])

    const applyDashboardData = useCallback((data) => {
        setCategories(data.categories)
        setComparisonCycleReports(data.comparisonCycleReports)
        setComparisonCycleTransactions(data.comparisonCycleTransactions)
        setCurrentCycleReport(data.currentCycleReport)
        setCurrentCycleTransactions(data.currentCycleTransactions)
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
    }, [categorizedPageSize, incomePageSize, mappingPageSize, reviewPageSize, selectedCycleStart])

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
        if (!requireWriteAccess()) {
            return false
        }

        if (!file) {
            showToast('Choose a .xlsx workbook first.')
            return false
        }

        setIsBusy(true)

        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetchApiResponse('/api/imports/poste-italiane', {
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

    async function categorizeTransaction({
        transactionId,
        category,
        ruleMode,
        formContext,
        excludeFromCalculations = false,
        isMonthlyRecurring = false,
    }) {
        if (!requireWriteAccess()) {
            return false
        }

        const normalizedCategory = category.trim()

        if (!normalizedCategory) {
            showToast('Choose or type a category before saving.')
            return false
        }

        setIsBusy(true)

        try {
            await fetchJson(`/api/transactions/${transactionId}/categorize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    category: normalizedCategory,
                    saveRule: ruleMode !== 'one-off',
                    ruleBehavior: ruleMode === 'always-review' ? 'AlwaysReview' : 'AutoApply',
                    excludeFromCalculations: Boolean(excludeFromCalculations),
                    isMonthlyRecurring: Boolean(isMonthlyRecurring),
                }),
            })

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

    async function updateTransactionAmount({ transactionId, amount }) {
        if (!requireWriteAccess()) {
            return false
        }

        if (!Number.isFinite(amount) || amount === 0) {
            showToast('Enter a valid amount before saving.')
            return false
        }

        setIsBusy(true)

        try {
            await fetchJson(`/api/transactions/${transactionId}/amount`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ amount }),
            })

            applyDashboardData(await fetchDashboardData(selectedCycleStart))
            showToast('Transaction amount updated.')
            return true
        } catch (error) {
            handleError(error)
            return false
        } finally {
            setIsBusy(false)
        }
    }

    async function saveCategoryMapping({ mappingId, merchantKey, category, behavior }) {
        if (!requireWriteAccess()) {
            return false
        }

        const normalizedCategory = category.trim()

        if (behavior === 'auto-apply' && !normalizedCategory) {
            showToast('Choose or type a category before saving this mapping.')
            return false
        }

        setIsBusy(true)

        try {
            await fetchJson(`/api/categories/mappings/${mappingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    category: normalizedCategory,
                    behavior: behavior === 'always-review' ? 'AlwaysReview' : 'AutoApply',
                }),
            })

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
        if (!requireWriteAccess()) {
            return false
        }

        const normalizedCategories = normalizeCategoryNames(categoryNames)

        setIsBusy(true)

        try {
            await fetchJson('/api/categories/cycle-income', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    categories: normalizedCategories,
                }),
            })

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

    async function setCycleIncomeTransactionRelation(transaction, isRelatedToCycle) {
        if (!requireWriteAccess()) {
            return false
        }

        const normalizedCategory = (transaction.category || '').trim()

        if (!normalizedCategory) {
            showToast('Assign a category to this income before changing whether it belongs to the cycle.')
            return false
        }

        setIsBusy(true)

        try {
            await fetchJson(`/api/transactions/${transaction.transactionId}/categorize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    category: normalizedCategory,
                    saveRule: false,
                    ruleBehavior: transaction.merchantRuleBehavior === 'AlwaysReview' ? 'AlwaysReview' : 'AutoApply',
                    excludeFromCalculations: !isRelatedToCycle,
                    isMonthlyRecurring: Boolean(transaction.isMonthlyRecurring),
                }),
            })

            applyDashboardData(await fetchDashboardData(selectedCycleStart))
            showToast(
                isRelatedToCycle
                    ? `${normalizedCategory} income is included in cycle totals again.`
                    : `${normalizedCategory} income is no longer counted in cycle totals.`,
            )
            return true
        } catch (error) {
            handleError(error)
            return false
        } finally {
            setIsBusy(false)
        }
    }

    async function deleteCategoryMapping({ mappingId, merchantKey }) {
        if (!requireWriteAccess()) {
            return false
        }

        const confirmed = window.confirm(
            `Delete the mapping for ${merchantKey}? Future imports will stop using this reusable rule.`,
        )

        if (!confirmed) {
            return false
        }

        setIsBusy(true)

        try {
            await fetchJson(`/api/categories/mappings/${mappingId}`, { method: 'DELETE' })

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

    async function triggerExport(format) {
        const cycleStart = selectedCycleStart || cycleOptions[0]?.from
        if (!cycleStart) {
            showToast('No cycle is available to export.')
            return
        }

        try {
            await downloadFile(`/api/reports/cycle/export?cycleStart=${encodeURIComponent(cycleStart)}&format=${format}`, {
                fileName: `cycle-${cycleStart}.${format}`,
            })
        } catch (error) {
            handleError(error)
        }
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
        const searchParams = new URLSearchParams(window.location.search)

        if (selectedCycleStart) {
            searchParams.set('cycleStart', selectedCycleStart)
        } else {
            searchParams.delete('cycleStart')
        }

        const nextSearch = searchParams.toString()
        const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}#${activeTab}`
        window.history.replaceState(null, '', nextUrl)
    }, [activeTab, selectedCycleStart])

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
    }, [selectedCycleStart, applyDashboardData, handleError])

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
        comparisonCycleTransactions,
        currentCycleReport,
        currentCycleTransactions,
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
        setCycleIncomeTransactionRelation,
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
        canWrite: userCanWrite,
        triggerExport,
        updateTransactionAmount,
        uploadWorkbook,
    }
}