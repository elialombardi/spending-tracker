import { useEffect, useState } from 'react'
import { PAGE_SIZE_OPTIONS } from '../lib/constants'
import { formatCycleOptionLabel, formatDate, formatMoney, formatPercent } from '../lib/formatters'
import EmptyState from './shared/EmptyState'
import Pagination from './shared/Pagination'

const ALL_CATEGORIES_VALUE = '__all__'
const CHART_COLORS = ['#cf6b48', '#2f7a73', '#dcae54', '#7c8f5a', '#3e5f8a', '#c97b63']

function formatSignedMoney(value) {
    return value > 0 ? `+${formatMoney(value)}` : formatMoney(value)
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
    cycleTransactions,
    monthlyReport,
    previousCycleCategorySpend,
    previousCycleComparison,
    selectedCycleStart,
}) {
    const [selectedComparisonCategory, setSelectedComparisonCategory] = useState(ALL_CATEGORIES_VALUE)
    const [currentCyclePage, setCurrentCyclePage] = useState(1)
    const [currentCyclePageSize, setCurrentCyclePageSize] = useState(PAGE_SIZE_OPTIONS[0])

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
                            <h2>Compare the last three cycles</h2>
                        </div>
                        <p className="section-note">
                            The charts below always show the three most recent recorded cycles.
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

                <section className="panel trend-panel">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Category trend</p>
                            <h2>See one category across recent cycles</h2>
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