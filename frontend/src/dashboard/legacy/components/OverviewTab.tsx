import { useState } from 'react'
import MetricsPanel from './MetricsPanel'
import CycleItemsPanel from './CycleItemsPanel'
import ComparisonCyclesSection from './overview/ComparisonCyclesSection'
import SpendingPaceSection from './overview/SpendingPaceSection'
import CategoryTrendSection from './overview/CategoryTrendSection'
import CategoryBreakdownSection from './overview/CategoryBreakdownSection'
import CurrentMonthTrendsSection from './overview/CurrentMonthTrendsSection'
import {
    ALL_CATEGORIES_VALUE,
    SPENDING_GRANULARITY_OPTIONS,
    buildComparisonCategoryOptions,
    buildComparisonSpendChart,
    buildComparisonTrendData,
} from './overview/data'

export default function OverviewTab({
    active,
    canWrite,
    comparisonCycleReports,
    comparisonCycleTransactions,
    currentCycleReport,
    currentCycleTransactions,
    cycleTransactions,
    isBusy,
    monthlyReport,
    onSetCycleIncomeTransactionRelation,
    previousCycleCategorySpend,
    previousCycleComparison,
    selectedCycleStart,
}) {
    const [selectedComparisonCategory, setSelectedComparisonCategory] = useState(ALL_CATEGORIES_VALUE)
    const [spendingGranularity, setSpendingGranularity] = useState(SPENDING_GRANULARITY_OPTIONS[1].value)

    const comparisonCategoryOptions = buildComparisonCategoryOptions(comparisonCycleReports)
    const visibleSelectedComparisonCategory = comparisonCategoryOptions.some(
        (option) => option.value === selectedComparisonCategory,
    )
        ? selectedComparisonCategory
        : ALL_CATEGORIES_VALUE
    const {
        comparisonChartData,
        comparisonChartScale,
        comparisonChartSeries,
        comparisonChartYTicks,
    } = buildComparisonSpendChart({
        comparisonCycleReports,
        comparisonCycleTransactions,
        selectedCycleStart,
        spendingGranularity,
    })
    const comparisonTrendData = buildComparisonTrendData(
        comparisonCycleReports,
        visibleSelectedComparisonCategory,
    )

    return (
        <section
            id="page-overview"
            className={`tab-page${active ? ' is-active' : ''}`}
            role="tabpanel"
            aria-labelledby="tab-overview"
            hidden={!active}
        >
            <div className="layout">

                <CurrentMonthTrendsSection
                    canWrite={canWrite}
                    cycleReport={monthlyReport}
                    cycleTransactions={cycleTransactions}
                    isBusy={isBusy}
                    onSetCycleIncomeTransactionRelation={onSetCycleIncomeTransactionRelation}
                />
                <MetricsPanel cycleTransactions={cycleTransactions} monthlyReport={monthlyReport} />

                <ComparisonCyclesSection
                    comparisonCycleReports={comparisonCycleReports}
                    selectedCycleStart={selectedCycleStart}
                />

                <SpendingPaceSection
                    comparisonCycleReports={comparisonCycleReports}
                    comparisonChartData={comparisonChartData}
                    comparisonChartYTicks={comparisonChartYTicks}
                    comparisonChartScale={comparisonChartScale}
                    comparisonChartSeries={comparisonChartSeries}
                    spendingGranularity={spendingGranularity}
                    onSpendingGranularityChange={setSpendingGranularity}
                />

                <CategoryTrendSection
                    comparisonCategoryOptions={comparisonCategoryOptions}
                    comparisonCycleReports={comparisonCycleReports}
                    comparisonTrendData={comparisonTrendData}
                    onSelectedComparisonCategoryChange={setSelectedComparisonCategory}
                    selectedComparisonCategory={visibleSelectedComparisonCategory}
                    selectedCycleStart={selectedCycleStart}
                />

                <CategoryBreakdownSection
                    monthlyReport={monthlyReport}
                    previousCycleComparison={previousCycleComparison}
                    previousCycleCategorySpend={previousCycleCategorySpend}
                />

                <CycleItemsPanel cycleTransactions={cycleTransactions} />

            </div>
        </section>
    )
}
