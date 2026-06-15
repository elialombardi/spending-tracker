import { useEffect, useState } from 'react'
import { PAGE_SIZE_OPTIONS } from '../lib/constants'
import { formatCycleOptionLabel, formatDate, formatMoney, formatPercent } from '../lib/formatters'
import EmptyState from './shared/EmptyState'
import Pagination from './shared/Pagination'

const ALL_CATEGORIES_VALUE = '__all__'
const CHART_COLORS = ['#cf6b48', '#2f7a73', '#dcae54', '#7c8f5a', '#3e5f8a', '#c97b63']
const SPENDING_SERIES_COLORS = ['#cf6b48', '#dcae54', '#3e5f8a']
const SPENDING_GRANULARITY_OPTIONS = [
    { label: 'Day', value: 'day' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
]
const SPENDING_CHART_WIDTH = 760
const SPENDING_CHART_HEIGHT = 300
const SPENDING_CHART_PADDING = {
    top: 16,
    right: 28,
    bottom: 48,
    left: 96,
}
const chartPointMoneyFormatter = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
})

function formatSignedMoney(value) {
    return value > 0 ? `+${formatMoney(value)}` : formatMoney(value)
}

function formatChartPointValue(value) {
    return chartPointMoneyFormatter.format(value)
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

function buildAxisLabelIndexes(bucketCount) {
    if (bucketCount <= 0) {
        return []
    }

    if (bucketCount <= 6) {
        return Array.from({ length: bucketCount }, (_, bucketIndex) => bucketIndex)
    }

    const requestedLabelCount = 6
    const labelIndexes = Array.from({ length: requestedLabelCount }, (_, labelIndex) =>
        Math.round((labelIndex * (bucketCount - 1)) / (requestedLabelCount - 1)),
    )

    return [...new Set(labelIndexes)]
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
    const plotWidth = SPENDING_CHART_WIDTH - SPENDING_CHART_PADDING.left - SPENDING_CHART_PADDING.right

    if (bucketCount <= 1) {
        return SPENDING_CHART_PADDING.left + plotWidth / 2
    }

    return SPENDING_CHART_PADDING.left + (bucketIndex / (bucketCount - 1)) * plotWidth
}

function getChartYPosition(value, maxValue) {
    const plotHeight = SPENDING_CHART_HEIGHT - SPENDING_CHART_PADDING.top - SPENDING_CHART_PADDING.bottom
    const normalizedValue = maxValue === 0 ? 0 : value / maxValue

    return SPENDING_CHART_PADDING.top + plotHeight - normalizedValue * plotHeight
}

function buildLineChartPoints(values, bucketCount, maxValue) {
    return values.map((value, bucketIndex) => ({
        value,
        x: getChartXPosition(bucketIndex, bucketCount),
        y: getChartYPosition(value, maxValue),
    }))
}

function getPointLabelVerticalOffset(seriesIndex) {
    return [-12, 20, -28][seriesIndex % 3]
}

function getPointLabelYPosition(pointY, verticalOffset) {
    const minY = SPENDING_CHART_PADDING.top + 12
    const maxY = SPENDING_CHART_HEIGHT - SPENDING_CHART_PADDING.bottom - 10
    const labelY = pointY + verticalOffset

    return Math.max(minY, Math.min(maxY, labelY))
}

function getPointLabelTextAnchor(pointIndex, pointCount) {
    if (pointCount <= 1) {
        return 'middle'
    }

    if (pointIndex === 0) {
        return 'start'
    }

    if (pointIndex === pointCount - 1) {
        return 'end'
    }

    return 'middle'
}

function getPointLabelXPosition(pointX, pointIndex, pointCount) {
    if (pointCount <= 1) {
        return pointX
    }

    if (pointIndex === 0) {
        return pointX + 8
    }

    if (pointIndex === pointCount - 1) {
        return pointX - 8
    }

    return pointX
}

function getPreviousCycleComparisonTone(currentAmount, previousAmount) {
    if (previousAmount > currentAmount) {
        return 'is-higher'
    }

    if (previousAmount < currentAmount) {
        return 'is-lower'
    }

    return ''
}

function buildPieSegments(categories) {
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

function buildPieBackground(segments) {
    if (segments.length === 0) {
        return 'linear-gradient(180deg, rgba(32, 50, 39, 0.08), rgba(32, 50, 39, 0.04))'
    }

    return `conic-gradient(from -90deg, ${segments
        .map((segment) => `${segment.color} ${segment.start.toFixed(2)}% ${segment.end.toFixed(2)}%`)
        .join(', ')})`
}

function buildComparisonCategoryOptions(comparisonCycleReports) {
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

export default function OverviewTab({
    active,
    comparisonCycleReports,
    comparisonCycleTransactions,
    cycleTransactions,
    monthlyReport,
    previousCycleCategorySpend,
    previousCycleComparison,
    selectedCycleStart,
}) {
    const [selectedComparisonCategory, setSelectedComparisonCategory] = useState(ALL_CATEGORIES_VALUE)
    const [currentCyclePage, setCurrentCyclePage] = useState(1)
    const [currentCyclePageSize, setCurrentCyclePageSize] = useState(PAGE_SIZE_OPTIONS[0])
    const [spendingGranularity, setSpendingGranularity] = useState(SPENDING_GRANULARITY_OPTIONS[1].value)

    const currentCyclePageCount = Math.max(1, Math.ceil(cycleTransactions.length / currentCyclePageSize))
    const currentCycleVisiblePage = Math.min(currentCyclePage, currentCyclePageCount)
    const currentCycleStart = (currentCycleVisiblePage - 1) * currentCyclePageSize
    const currentCycleItems = cycleTransactions.slice(currentCycleStart, currentCycleStart + currentCyclePageSize)

    const metricCards = monthlyReport
        ? [
            {
                label: 'Spent',
                value: formatMoney(monthlyReport.totalSpent),
                tone: 'accent',
            },
            {
                label: 'Income',
                value: formatMoney(monthlyReport.totalIncome),
                tone: 'secondary',
            },
            {
                label: 'Uncategorized',
                value: formatMoney(monthlyReport.uncategorizedSpent),
                tone: 'accent',
            },
            {
                label: 'Transactions',
                value: String(monthlyReport.totalTransactions),
                tone: '',
            },
        ]
        : []
    const comparisonCategoryOptions = buildComparisonCategoryOptions(comparisonCycleReports)
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
    const comparisonChartTickIndexes = buildAxisLabelIndexes(comparisonChartBucketCount)
    const comparisonChartSeries = rawComparisonSpendSeries.map((series) => ({
        ...series,
        points: buildLineChartPoints(series.visibleSpend, comparisonChartBucketCount, comparisonChartScale.axisMax),
    }))
    const comparisonTrendData = comparisonCycleReports.map((report) => ({
        report,
        totalSpent:
            selectedComparisonCategory === ALL_CATEGORIES_VALUE
                ? report.totalSpent
                : report.categories.find((category) => category.category === selectedComparisonCategory)?.totalSpent ?? 0,
    }))
    const maxComparisonSpend = comparisonTrendData.reduce(
        (currentMaximum, item) => Math.max(currentMaximum, item.totalSpent),
        0,
    )

    useEffect(() => {
        if (selectedComparisonCategory === ALL_CATEGORIES_VALUE) {
            return
        }

        const categoryStillExists = comparisonCycleReports.some((report) =>
            report.categories.some((category) => category.category === selectedComparisonCategory),
        )

        if (!categoryStillExists) {
            setSelectedComparisonCategory(ALL_CATEGORIES_VALUE)
        }
    }, [comparisonCycleReports, selectedComparisonCategory])

    useEffect(() => {
        setCurrentCyclePage(1)
    }, [selectedCycleStart])

    function handleCurrentCyclePageSizeChange(pageSize) {
        setCurrentCyclePageSize(pageSize)
        setCurrentCyclePage(1)
    }

    return (
        <section
            id="page-overview"
            className={`tab-page${active ? ' is-active' : ''}`}
            role="tabpanel"
            aria-labelledby="tab-overview"
            hidden={!active}
        >
            <div className="layout">
                <section className="panel metrics-panel">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Snapshot</p>
                            <h2>Current cycle at a glance</h2>
                        </div>
                    </div>

                    {monthlyReport ? (
                        <div className="metric-grid">
                            {metricCards.map((metric) => (
                                <article key={metric.label} className="metric-card">
                                    <span className="metric-label">{metric.label}</span>
                                    <strong className={`metric-value ${metric.tone}`.trim()}>{metric.value}</strong>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <EmptyState message="No spending-cycle data available yet." />
                    )}
                </section>

                <section className="panel comparison-panel">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Recent cycles</p>
                            <h2>Compare the selected cycle with the two before it</h2>
                        </div>
                        <p className="section-note">
                            The cards below follow the selected cycle and the two earlier income cycles.
                        </p>
                    </div>

                    {comparisonCycleReports.length === 0 ? (
                        <EmptyState message="Not enough cycle data is available to compare recent spending yet." />
                    ) : (
                        <div className="comparison-pie-grid">
                            {comparisonCycleReports.map((report) => {
                                const pieSegments = buildPieSegments(report.categories)
                                const isSelectedCycle = report.from === selectedCycleStart

                                return (
                                    <article
                                        key={report.from}
                                        className={`comparison-pie-card${isSelectedCycle ? ' is-selected' : ''}`}
                                    >
                                        <header className="comparison-card-header">
                                            <div>
                                                <h3>{formatCycleOptionLabel(report)}</h3>
                                                <p className="section-note comparison-card-note">
                                                    {report.categories.length} categories across {report.totalTransactions} transactions
                                                </p>
                                            </div>
                                            {isSelectedCycle ? <span className="tag">Selected</span> : null}
                                        </header>

                                        {pieSegments.length === 0 ? (
                                            <EmptyState message="No outgoing spending in this cycle yet." />
                                        ) : (
                                            <div className="comparison-pie-layout">
                                                <div
                                                    className="comparison-pie-visual"
                                                    style={{ background: buildPieBackground(pieSegments) }}
                                                >
                                                    <div className="comparison-pie-center">
                                                        <span className="metric-label">Spent</span>
                                                        <strong>{formatMoney(report.totalSpent)}</strong>
                                                    </div>
                                                </div>

                                                <div className="comparison-pie-legend">
                                                    {pieSegments.map((segment) => (
                                                        <div key={`${report.from}-${segment.category}`} className="comparison-pie-legend-item">
                                                            <span
                                                                className="comparison-pie-swatch"
                                                                style={{ backgroundColor: segment.color }}
                                                            ></span>
                                                            <div className="comparison-pie-legend-copy">
                                                                <strong>{segment.category}</strong>
                                                                <span>
                                                                    {formatMoney(segment.totalSpent)} ({formatPercent(segment.share)})
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </article>
                                )
                            })}
                        </div>
                    )}
                </section>

                <section className="panel spending-comparison-panel">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Spending pace</p>
                            <h2>Compare spend inside each cycle</h2>
                            <p className="section-note spending-comparison-note">
                                Outgoing spending is shown across the full cycle timeline. If the selected cycle is still
                                in progress, its line stops at the latest recorded bucket instead of dropping future
                                periods to zero.
                            </p>
                        </div>

                        <label className="field field-compact spending-granularity-field">
                            <span>Group by</span>
                            <select
                                value={spendingGranularity}
                                onChange={(event) => setSpendingGranularity(event.target.value)}
                            >
                                {SPENDING_GRANULARITY_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    {comparisonCycleReports.length === 0 ? (
                        <EmptyState message="No cycle transactions are available for the grouped comparison chart yet." />
                    ) : (
                        <div className="spending-comparison-layout">
                            <div className="spending-comparison-chart-shell">
                                <div className="spending-comparison-chart-frame">
                                    <svg
                                        viewBox={`0 0 ${SPENDING_CHART_WIDTH} ${SPENDING_CHART_HEIGHT}`}
                                        role="img"
                                        aria-label={`Outgoing spending grouped by ${spendingGranularity} for the selected cycle and the two earlier cycles.`}
                                    >
                                        {comparisonChartScale.gridValues.map((value) => {
                                            const y = getChartYPosition(value, comparisonChartScale.axisMax)

                                            return (
                                                <g key={`grid-${value}`}>
                                                    <line
                                                        className="spending-chart-grid-line"
                                                        x1={SPENDING_CHART_PADDING.left}
                                                        x2={SPENDING_CHART_WIDTH - SPENDING_CHART_PADDING.right}
                                                        y1={y}
                                                        y2={y}
                                                    ></line>
                                                    <text
                                                        className="spending-chart-grid-label"
                                                        x={SPENDING_CHART_PADDING.left - 12}
                                                        y={y + 4}
                                                        textAnchor="end"
                                                    >
                                                        {formatMoney(value)}
                                                    </text>
                                                </g>
                                            )
                                        })}

                                        <line
                                            className="spending-chart-axis-line"
                                            x1={SPENDING_CHART_PADDING.left}
                                            x2={SPENDING_CHART_WIDTH - SPENDING_CHART_PADDING.right}
                                            y1={SPENDING_CHART_HEIGHT - SPENDING_CHART_PADDING.bottom}
                                            y2={SPENDING_CHART_HEIGHT - SPENDING_CHART_PADDING.bottom}
                                        ></line>

                                        {comparisonChartSeries.map((series, seriesIndex) => (
                                            <g key={`series-${series.report.from}`}>
                                                {series.points.length > 1 ? (
                                                    <polyline
                                                        className={`spending-chart-line${series.isSelectedCycle ? ' is-selected' : ''}`}
                                                        points={series.points
                                                            .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
                                                            .join(' ')}
                                                        stroke={series.color}
                                                    ></polyline>
                                                ) : null}

                                                {series.points.map((point, pointIndex) => {
                                                    const labelVerticalOffset = getPointLabelVerticalOffset(seriesIndex)
                                                    const pointCount = series.points.length

                                                    return (
                                                        <g key={`${series.report.from}-${pointIndex}`} className="spending-chart-point-group">
                                                            <circle
                                                                className="spending-chart-point"
                                                                cx={point.x}
                                                                cy={point.y}
                                                                r={series.isSelectedCycle ? 5 : 4}
                                                                fill={series.color}
                                                                stroke="rgba(255, 250, 243, 0.96)"
                                                                strokeWidth={series.isSelectedCycle ? 3 : 2}
                                                                tabIndex={0}
                                                            >
                                                                <title>{formatChartPointValue(point.value)}</title>
                                                            </circle>
                                                            <text
                                                                className={`spending-chart-point-label${series.isSelectedCycle ? ' is-selected' : ''}`}
                                                                x={getPointLabelXPosition(point.x, pointIndex, pointCount)}
                                                                y={getPointLabelYPosition(point.y, labelVerticalOffset)}
                                                                textAnchor={getPointLabelTextAnchor(pointIndex, pointCount)}
                                                                dominantBaseline={labelVerticalOffset > 0 ? 'hanging' : 'auto'}
                                                            >
                                                                {formatChartPointValue(point.value)}
                                                            </text>
                                                        </g>
                                                    )
                                                })}
                                            </g>
                                        ))}

                                        {comparisonChartTickIndexes.map((bucketIndex) => {
                                            const x = getChartXPosition(bucketIndex, comparisonChartBucketCount)
                                            const textAnchor = comparisonChartBucketCount === 1
                                                ? 'middle'
                                                : bucketIndex === 0
                                                    ? 'start'
                                                    : bucketIndex === comparisonChartBucketCount - 1
                                                        ? 'end'
                                                        : 'middle'

                                            return (
                                                <g key={`tick-${bucketIndex}`}>
                                                    <line
                                                        className="spending-chart-tick"
                                                        x1={x}
                                                        x2={x}
                                                        y1={SPENDING_CHART_HEIGHT - SPENDING_CHART_PADDING.bottom}
                                                        y2={SPENDING_CHART_HEIGHT - SPENDING_CHART_PADDING.bottom + 6}
                                                    ></line>
                                                    <text
                                                        className="spending-chart-axis-label"
                                                        x={x}
                                                        y={SPENDING_CHART_HEIGHT - SPENDING_CHART_PADDING.bottom + 24}
                                                        textAnchor={textAnchor}
                                                    >
                                                        {buildBucketLabel(bucketIndex, spendingGranularity)}
                                                    </text>
                                                </g>
                                            )
                                        })}
                                    </svg>
                                </div>
                            </div>

                            <div className="spending-comparison-series-grid">
                                {comparisonChartSeries.map((series) => (
                                    <article
                                        key={`summary-${series.report.from}`}
                                        className={`spending-series-card${series.isSelectedCycle ? ' is-selected' : ''}`}
                                    >
                                        <header className="spending-series-header">
                                            <div className="spending-series-title">
                                                <span
                                                    className="spending-series-swatch"
                                                    style={{ backgroundColor: series.color }}
                                                ></span>
                                                <div className="spending-series-copy">
                                                    <strong>{formatCycleOptionLabel(series.report)}</strong>
                                                    <span>
                                                        {series.isSelectedCycle && series.through !== series.report.to
                                                            ? `Selected cycle through ${formatDate(series.through)}`
                                                            : `Cycle ends ${formatDate(series.report.to)}`}
                                                    </span>
                                                </div>
                                            </div>
                                            {series.isSelectedCycle ? <span className="tag tag-secondary">Selected</span> : null}
                                        </header>

                                        <div className="spending-series-meta">
                                            <span>
                                                {formatMoney(series.totalSpent)}{' '}
                                                {series.isSelectedCycle && series.through !== series.report.to
                                                    ? 'spent so far'
                                                    : 'spent in cycle'}
                                            </span>
                                            <span>
                                                {series.groupedSpend.length}{' '}
                                                {spendingGranularity === 'day'
                                                    ? 'days'
                                                    : spendingGranularity === 'week'
                                                        ? 'weeks'
                                                        : 'months'}{' '}
                                                in cycle
                                            </span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                <section className="panel trend-panel">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Category trend</p>
                            <h2>See one category across nearby cycles</h2>
                        </div>

                        <label className="field field-compact trend-filter-field">
                            <span>Category</span>
                            <select
                                value={selectedComparisonCategory}
                                onChange={(event) => setSelectedComparisonCategory(event.target.value)}
                            >
                                {comparisonCategoryOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    {comparisonCycleReports.length === 0 ? (
                        <EmptyState message="No cycle totals are available for the comparison chart yet." />
                    ) : (
                        <div className="trend-chart-grid">
                            {comparisonTrendData.map((item) => {
                                const barHeight = maxComparisonSpend === 0
                                    ? 6
                                    : Math.max((item.totalSpent / maxComparisonSpend) * 100, 6)
                                const isSelectedCycle = item.report.from === selectedCycleStart

                                return (
                                    <article
                                        key={item.report.from}
                                        className={`trend-bar-card${isSelectedCycle ? ' is-selected' : ''}`}
                                    >
                                        <span className="trend-bar-value">{formatMoney(item.totalSpent)}</span>
                                        <div className="trend-bar-track">
                                            <div className="trend-bar-fill" style={{ height: `${barHeight}%` }}></div>
                                        </div>
                                        <div className="trend-bar-labels">
                                            <strong>{formatDate(item.report.from)}</strong>
                                            <span>
                                                {isSelectedCycle ? 'Selected cycle' : `Ends ${formatDate(item.report.to)}`}
                                            </span>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    )}
                </section>

                <section className="panel categories-panel">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Breakdown</p>
                            <h2>Where the money is going</h2>
                        </div>
                        {previousCycleComparison ? (
                            <p className="section-note">
                                Previous cycle values are matched through {formatDate(previousCycleComparison.comparableTo)}.
                            </p>
                        ) : null}
                    </div>

                    {monthlyReport && monthlyReport.categories.length > 0 ? (
                        <div className="category-breakdown">
                            {monthlyReport.categories.map((category) => {
                                const width = Math.max(category.shareOfSpent * 100, 2)
                                const previousCycleAmount = previousCycleCategorySpend[category.category] ?? 0
                                const currentCostTone = getPreviousCycleComparisonTone(
                                    category.totalSpent,
                                    previousCycleAmount,
                                )

                                return (
                                    <article key={category.category} className="category-row">
                                        <header>
                                            <h3>{category.category}</h3>
                                            <span className={`money-pill ${currentCostTone}`.trim()}>
                                                {formatMoney(category.totalSpent)}
                                            </span>
                                        </header>
                                        <div className="category-bar-track">
                                            <div className="category-bar-fill" style={{ width: `${width}%` }}></div>
                                        </div>
                                        <div className="merchant-meta">
                                            <span>{formatPercent(category.shareOfSpent)} of spending</span>
                                            <span>{category.transactions} transactions</span>
                                        </div>
                                        {previousCycleComparison ? (
                                            <div className="merchant-meta">
                                                <span>
                                                    Previous cycle through {formatDate(previousCycleComparison.comparableTo)}:{' '}
                                                    {formatMoney(previousCycleAmount)}
                                                </span>
                                            </div>
                                        ) : null}
                                    </article>
                                )
                            })}
                        </div>
                    ) : (
                        <EmptyState message="No expenses in the selected income cycle yet." />
                    )}
                </section>

                <section className="panel cycle-items-panel">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Line items</p>
                            <h2>Every transaction in this cycle</h2>
                        </div>
                        <p className="section-note">Incoming and outgoing items, ordered newest first.</p>
                    </div>

                    {cycleTransactions.length === 0 ? (
                        <EmptyState message="No transactions in the selected cycle yet." />
                    ) : (
                        <>
                            <div className="expense-list">
                                {currentCycleItems.map((transaction) => (
                                    <article key={transaction.transactionId} className="expense-card">
                                        <header>
                                            <div>
                                                <h3>{transaction.description}</h3>
                                                <div className="expense-meta">
                                                    <span>{formatDate(transaction.bookingDate)}</span>
                                                    <span>{transaction.merchantKey}</span>
                                                </div>
                                            </div>
                                            <span className="money-pill">{formatSignedMoney(transaction.amount)}</span>
                                        </header>

                                        <div className="merchant-meta">
                                            <span>{transaction.direction === 'income' ? 'Income' : 'Expense'}</span>
                                            <span>{transaction.category || 'Uncategorized'}</span>
                                            {transaction.needsReview ? <span>Needs review</span> : null}
                                        </div>
                                    </article>
                                ))}
                            </div>

                            <Pagination
                                currentPage={currentCycleVisiblePage}
                                itemCount={cycleTransactions.length}
                                onPageChange={setCurrentCyclePage}
                                onPageSizeChange={handleCurrentCyclePageSizeChange}
                                pageCount={currentCyclePageCount}
                                pageSize={currentCyclePageSize}
                            />
                        </>
                    )}
                </section>

            </div>
        </section>
    )
}