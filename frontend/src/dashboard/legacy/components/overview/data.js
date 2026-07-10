import {
    ALL_CATEGORIES_VALUE,
    CHART_COLORS,
    SPENDING_GRANULARITY_OPTIONS,
    SPENDING_SERIES_COLORS,
} from './constants'

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

function clampDateOnlyToRange(currentDate, startDate, endDate) {
    if (currentDate < startDate) {
        return startDate
    }

    if (currentDate > endDate) {
        return endDate
    }

    return currentDate
}

function getVisibleThroughDate(cycleStart, cycleEnd, isSelectedCycle) {
    if (!isSelectedCycle) {
        return cycleEnd
    }

    const cycleStartDate = parseDateOnly(cycleStart)
    const cycleEndDate = parseDateOnly(cycleEnd)

    return formatDateOnly(clampDateOnlyToRange(getTodayDateOnly(), cycleStartDate, cycleEndDate))
}

function getDayDifference(startDate, endDate) {
    return Math.max(0, Math.floor((endDate - startDate) / 86400000))
}

function getMonthDifference(startDate, endDate) {
    return Math.max(
        0,
        (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12
        + endDate.getUTCMonth()
        - startDate.getUTCMonth(),
    )
}

function getBucketIndex(cycleStartDate, currentDate, granularity) {
    const dayDifference = getDayDifference(cycleStartDate, currentDate)

    if (granularity === 'day') {
        return dayDifference
    }

    if (granularity === 'week') {
        return Math.floor(dayDifference / 7)
    }

    return getMonthDifference(cycleStartDate, currentDate)
}

function getBucketCount(cycleStartDate, cycleEndDate, granularity) {
    return getBucketIndex(cycleStartDate, cycleEndDate, granularity) + 1
}

function getVisibleBucketCount(cycleStart, visibleThrough, granularity) {
    if (!cycleStart || !visibleThrough) {
        return 0
    }

    return getBucketCount(parseDateOnly(cycleStart), parseDateOnly(visibleThrough), granularity)
}

function buildGroupedSpendingBuckets(transactions, cycleStart, cycleEnd, granularity) {
    if (!cycleStart || !cycleEnd) {
        return []
    }

    const cycleStartDate = parseDateOnly(cycleStart)
    const cycleEndDate = parseDateOnly(cycleEnd)
    const totals = Array.from(
        { length: getBucketCount(cycleStartDate, cycleEndDate, granularity) },
        () => 0,
    )

    transactions.forEach((transaction) => {
        const bookingDate = parseDateOnly(transaction.bookingDate)

        if (bookingDate < cycleStartDate || bookingDate > cycleEndDate) {
            return
        }

        const bucketIndex = getBucketIndex(cycleStartDate, bookingDate, granularity)
        totals[bucketIndex] += Math.abs(transaction.amount)
    })

    return totals
}

function buildBucketLabel(bucketIndex, granularity) {
    if (granularity === 'day') {
        return `Day ${bucketIndex + 1}`
    }

    if (granularity === 'week') {
        return `Week ${bucketIndex + 1}`
    }

    return `Month ${bucketIndex + 1}`
}

function getNiceAxisStep(maxValue, intervalCount) {
    const rawStep = maxValue / intervalCount
    const magnitude = 10 ** Math.floor(Math.log10(rawStep))
    const normalizedStep = rawStep / magnitude

    if (normalizedStep <= 1) {
        return magnitude
    }

    if (normalizedStep <= 2) {
        return 2 * magnitude
    }

    if (normalizedStep <= 2.5) {
        return 2.5 * magnitude
    }

    if (normalizedStep <= 5) {
        return 5 * magnitude
    }

    return 10 * magnitude
}

function buildChartScale(maxValue) {
    if (maxValue === 0) {
        return {
            axisMax: 0,
            gridValues: [0],
        }
    }

    const intervalCount = 4
    const axisStep = getNiceAxisStep(maxValue, intervalCount)
    const axisMax = axisStep * intervalCount

    return {
        axisMax,
        gridValues: Array.from({ length: intervalCount + 1 }, (_, index) => axisMax - axisStep * index),
    }
}

function getChartXPosition(bucketIndex, bucketCount) {
    const chartWidth = 760
    const chartPadding = {
        left: 96,
        right: 28,
    }
    const plotWidth = chartWidth - chartPadding.left - chartPadding.right

    if (bucketCount <= 1) {
        return chartPadding.left + plotWidth / 2
    }

    return chartPadding.left + (bucketIndex / (bucketCount - 1)) * plotWidth
}

function getChartYPosition(value, maxValue) {
    const chartHeight = 300
    const chartPadding = {
        top: 16,
        bottom: 48,
    }
    const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom
    const normalizedValue = maxValue === 0 ? 0 : value / maxValue

    return chartPadding.top + plotHeight - normalizedValue * plotHeight
}

function buildLineChartPoints(values, bucketCount, maxValue) {
    return values.map((value, bucketIndex) => ({
        value,
        x: getChartXPosition(bucketIndex, bucketCount),
        y: getChartYPosition(value, maxValue),
    }))
}

function getAmountSpent(transaction) {
    return Math.abs(transaction.amount)
}

function getMonthStartDate(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function getMonthEndDate(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
}

function getStartOfWeek(date) {
    const weekDate = new Date(date)
    const dayOfWeek = weekDate.getUTCDay()
    const dayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

    weekDate.setUTCDate(weekDate.getUTCDate() + dayOffset)
    return weekDate
}

function getEndOfWeek(date) {
    const weekDate = getStartOfWeek(date)

    weekDate.setUTCDate(weekDate.getUTCDate() + 6)
    return weekDate
}

function getDaySpanInclusive(startDate, endDate) {
    return Math.max(1, getDayDifference(startDate, endDate) + 1)
}

function clampDate(currentDate, startDate, endDate) {
    if (currentDate < startDate) {
        return startDate
    }

    if (currentDate > endDate) {
        return endDate
    }

    return currentDate
}

function buildWeekRangeLabel(startDate, endDate) {
    const startMonth = String(startDate.getUTCMonth() + 1).padStart(2, '0')
    const startDay = String(startDate.getUTCDate()).padStart(2, '0')
    const endMonth = String(endDate.getUTCMonth() + 1).padStart(2, '0')
    const endDay = String(endDate.getUTCDate()).padStart(2, '0')

    return `${startDay}/${startMonth} - ${endDay}/${endMonth}`
}

function buildPeriodWeeks(periodStart, periodEnd, today) {
    const weeks = []
    let currentWeekStart = clampDate(getStartOfWeek(periodStart), periodStart, periodEnd)

    while (currentWeekStart <= periodEnd) {
        const weekStart = new Date(currentWeekStart)
        const weekEnd = clampDate(getEndOfWeek(weekStart), periodStart, periodEnd)

        weeks.push({
            label: buildWeekRangeLabel(weekStart, weekEnd),
            from: formatDateOnly(weekStart),
            isCurrent:
                today >= weekStart && today <= weekEnd,
            to: formatDateOnly(weekEnd),
            totalSpent: 0,
        })

        currentWeekStart = new Date(weekEnd)
        currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() + 1)
    }

    return weeks
}

export function buildPieSegments(categories) {
    const visibleCategories = categories.filter((category) => category.totalSpent > 0)
    if (visibleCategories.length === 0) {
        return []
    }

    const topCategories = visibleCategories.slice(0, 5).map((category, index) => ({
        ...category,
        color: CHART_COLORS[index % CHART_COLORS.length],
    }))
    const otherCategories = visibleCategories.slice(5)

    if (otherCategories.length > 0) {
        topCategories.push({
            category: 'Other',
            color: CHART_COLORS[topCategories.length % CHART_COLORS.length],
            shareOfSpent: 0,
            totalSpent: otherCategories.reduce((total, category) => total + category.totalSpent, 0),
            transactions: otherCategories.reduce((total, category) => total + category.transactions, 0),
        })
    }

    const totalSpent = topCategories.reduce((total, category) => total + category.totalSpent, 0)
    let runningPercentage = 0

    return topCategories.map((category) => {
        const share = totalSpent === 0 ? 0 : category.totalSpent / totalSpent
        const start = runningPercentage
        runningPercentage += share * 100

        return {
            ...category,
            end: runningPercentage,
            share,
            start,
        }
    })
}

export function buildComparisonCategoryOptions(comparisonCycleReports) {
    const categoryNames = []

    comparisonCycleReports.forEach((report) => {
        report.categories.forEach((category) => {
            if (!categoryNames.includes(category.category)) {
                categoryNames.push(category.category)
            }
        })
    })

    return [
        { label: 'All categories', value: ALL_CATEGORIES_VALUE },
        ...categoryNames
            .sort((left, right) => left.localeCompare(right))
            .map((categoryName) => ({ label: categoryName, value: categoryName })),
    ]
}

export function buildComparisonSpendChart({
    comparisonCycleReports,
    comparisonCycleTransactions,
    selectedCycleStart,
    spendingGranularity,
}) {
    const comparisonCycleTransactionLookup = new Map(
        comparisonCycleTransactions.map((comparisonCycleTransaction) => [
            comparisonCycleTransaction.from,
            comparisonCycleTransaction,
        ]),
    )

    const rawComparisonSpendSeries = comparisonCycleReports.map((report, index) => {
        const comparisonCycleTransaction = comparisonCycleTransactionLookup.get(report.from)
        const isSelectedCycle = report.from === selectedCycleStart
        const visibleThrough = getVisibleThroughDate(report.from, report.to, isSelectedCycle)
        const groupedSpend = buildGroupedSpendingBuckets(
            comparisonCycleTransaction?.transactions ?? [],
            report.from,
            report.to,
            spendingGranularity,
        )
        const visibleBucketCount = getVisibleBucketCount(report.from, visibleThrough, spendingGranularity)
        const visibleSpend = groupedSpend.slice(0, visibleBucketCount)

        return {
            color: isSelectedCycle ? '#2f7a73' : SPENDING_SERIES_COLORS[index % SPENDING_SERIES_COLORS.length],
            groupedSpend,
            isSelectedCycle,
            report,
            through: visibleThrough,
            totalSpent: visibleSpend.reduce((runningTotal, total) => runningTotal + total, 0),
            visibleSpend,
        }
    })

    const comparisonChartBucketCount = rawComparisonSpendSeries.reduce(
        (currentMaximum, series) => Math.max(currentMaximum, series.groupedSpend.length),
        0,
    )
    const comparisonChartMaxSpend = rawComparisonSpendSeries.reduce(
        (currentMaximum, series) =>
            Math.max(
                currentMaximum,
                series.visibleSpend.reduce((seriesMaximum, value) => Math.max(seriesMaximum, value), 0),
            ),
        0,
    )
    const comparisonChartScale = buildChartScale(comparisonChartMaxSpend)
    const comparisonChartSeries = rawComparisonSpendSeries.map((series) => ({
        ...series,
        points: buildLineChartPoints(series.visibleSpend, comparisonChartBucketCount, comparisonChartScale.axisMax),
    }))
    const comparisonChartData = Array.from({ length: comparisonChartBucketCount }, (_, bucketIndex) => {
        const row = { name: buildBucketLabel(bucketIndex, spendingGranularity) }

        comparisonChartSeries.forEach((series, seriesIndex) => {
            row[`s${seriesIndex}`] = series.groupedSpend[bucketIndex] ?? 0
        })

        return row
    })

    return {
        comparisonChartData,
        comparisonChartScale,
        comparisonChartSeries,
        comparisonChartYTicks: comparisonChartScale.gridValues.slice().sort((left, right) => left - right),
    }
}

export function buildComparisonTrendData(comparisonCycleReports, selectedComparisonCategory) {
    return comparisonCycleReports.map((report) => ({
        report,
        totalSpent:
            selectedComparisonCategory === ALL_CATEGORIES_VALUE
                ? report.totalSpent
                : report.categories.find((category) => category.category === selectedComparisonCategory)?.totalSpent ?? 0,
    }))
}

export function getWeeklyBudgetAllocation(cycleTotalIncome, cycleStart, cycleEnd, today) {
    const cycleStartDate = parseDateOnly(cycleStart)
    const cycleEndDate = parseDateOnly(cycleEnd)
    const effectiveDate = clampDate(
        typeof today === 'string' ? parseDateOnly(today) : today,
        cycleStartDate,
        cycleEndDate,
    )

    const weeksInCycle = buildPeriodWeeks(cycleStartDate, cycleEndDate, effectiveDate).length

    return weeksInCycle === 0 ? 0 : cycleTotalIncome / weeksInCycle

    // const daysRemainingInCycle = getDaySpanInclusive(effectiveDate, cycleEndDate)
    // const daysRemainingInWeek = getDaySpanInclusive(effectiveDate, getEndOfWeek(effectiveDate))

    // return daysRemainingInCycle === 0
    //     ? cycleTotalIncome
    //     : (cycleTotalIncome * daysRemainingInWeek) / daysRemainingInCycle
}

export function buildCurrentCycleTrendData({ currentCycleReport, currentCycleTransactions }) {
    const payments = currentCycleTransactions.filter((transaction) => transaction.direction !== 'income')
    const today = getTodayDateOnly()
    const cycleStart = currentCycleReport ? parseDateOnly(currentCycleReport.from) : getMonthStartDate(today)
    const cycleEnd = currentCycleReport ? parseDateOnly(currentCycleReport.to) : getMonthEndDate(today)
    const isCurrentCycle = today >= cycleStart && today <= cycleEnd
    const effectiveDate = clampDate(today, cycleStart, cycleEnd)
    const currentWeekStart = clampDate(getStartOfWeek(effectiveDate), cycleStart, cycleEnd)
    const currentWeekEnd = clampDate(getEndOfWeek(effectiveDate), cycleStart, cycleEnd)
    const cycleBudget = currentCycleReport?.totalIncome ?? 0
    const cycleSpent = payments.reduce(
        (runningTotal, transaction) => runningTotal + getAmountSpent(transaction),
        0,
    )
    const weekSpent = payments.reduce((runningTotal, transaction) => {
        if (
            transaction.isMonthlyRecurring
            || transaction.bookingDate < formatDateOnly(currentWeekStart)
            || transaction.bookingDate > formatDateOnly(effectiveDate)
        ) {
            return runningTotal
        }

        return runningTotal + getAmountSpent(transaction)
    }, 0)
    const cycleRemaining = cycleBudget - cycleSpent
    const cycleBudgetWithoutMontylyRecurring = currentCycleTransactions.reduce(
        (runningTotal, transaction) => {
            if (transaction.isMonthlyRecurring) {
                return runningTotal - getAmountSpent(transaction)
            }
            return runningTotal
        },
        cycleBudget,
    )
    const weekAvailable = getWeeklyBudgetAllocation(cycleBudgetWithoutMontylyRecurring, formatDateOnly(cycleStart), formatDateOnly(cycleEnd), effectiveDate)
    const weekRemaining = weekAvailable - weekSpent
    const weekChartData = buildPeriodWeeks(cycleStart, cycleEnd, effectiveDate)
        .map((week) => {
            const transactions = payments.filter((transaction) => (
                !transaction.isMonthlyRecurring
                && transaction.bookingDate >= week.from
                && transaction.bookingDate <= week.to
            ))

            return {
                ...week,
                availableBudget: weekAvailable,
                totalSpent: transactions.reduce(
                    (runningTotal, transaction) => runningTotal + getAmountSpent(transaction),
                    0,
                ),
                transactions,
                weekKey: `${week.from}:${week.to}`,
            }
        })

    return {
        currentWeekLabel: buildWeekRangeLabel(currentWeekStart, currentWeekEnd),
        cycleBudget,
        isCurrentCycle,
        cycleRemaining,
        cycleSpent,
        weekAvailable,
        weekChartData,
        weekRemaining,
        weekSpent,
    }
}

export { ALL_CATEGORIES_VALUE, SPENDING_GRANULARITY_OPTIONS }
