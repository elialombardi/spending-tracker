import AppHeader from './components/AppHeader'
import ImportTab from './components/ImportTab'
import InsightsTab from './components/InsightsTab'
import OverviewTab from './components/OverviewTab'
import ReviewTab from './components/ReviewTab'
import TabNavigation from './components/TabNavigation'
import Toast from './components/shared/Toast'
import { useDashboard } from './hooks/useDashboard'

function App() {
  const dashboard = useDashboard()

  return (
    <>
      <div className="page-glow page-glow-left"></div>
      <div className="page-glow page-glow-right"></div>

      <AppHeader
        cycleOptions={dashboard.cycleOptions}
        hasNextCycle={dashboard.hasNextCycle}
        hasPreviousCycle={dashboard.hasPreviousCycle}
        isBusy={dashboard.isBusy}
        monthlyReport={dashboard.monthlyReport}
        onCycleStartChange={dashboard.setSelectedCycleStart}
        onExport={dashboard.triggerExport}
        onNextCycle={dashboard.goToNextCycle}
        onPreviousCycle={dashboard.goToPreviousCycle}
        onRefresh={dashboard.refreshDashboard}
        selectedCycleStart={dashboard.selectedCycleStart}
      />

      <TabNavigation
        activeTab={dashboard.activeTab}
        onTabChange={dashboard.setActiveTab}
        reviewCount={dashboard.reviewQueue.length}
      />

      <main className="shell page-stack">
        <ImportTab
          active={dashboard.activeTab === 'import'}
          categories={dashboard.categories}
          categorizedExpenses={dashboard.categorizedExpenses}
          categorizedPage={dashboard.categorizedPage}
          categorizedPageSize={dashboard.categorizedPageSize}
          cycleIncomeCategories={dashboard.cycleIncomeCategories}
          categoryMappings={dashboard.categoryMappings}
          incomePage={dashboard.incomePage}
          incomePageSize={dashboard.incomePageSize}
          incomeTransactions={dashboard.incomeTransactions}
          importResult={dashboard.importResult}
          isBusy={dashboard.isBusy}
          mappingsPage={dashboard.mappingPage}
          mappingsPageSize={dashboard.mappingPageSize}
          onCategorize={dashboard.categorizeTransaction}
          onCategorizedPageChange={dashboard.setCategorizedPage}
          onCategorizedPageSizeChange={dashboard.setCategorizedPageSize}
          onDeleteMapping={dashboard.deleteCategoryMapping}
          onIncomePageChange={dashboard.setIncomePage}
          onIncomePageSizeChange={dashboard.setIncomePageSize}
          onMappingsPageChange={dashboard.setMappingPage}
          onMappingsPageSizeChange={dashboard.setMappingPageSize}
          onSaveMapping={dashboard.saveCategoryMapping}
          onSaveCycleIncomeCategories={dashboard.saveCycleIncomeCategories}
          onUpload={dashboard.uploadWorkbook}
        />

        <OverviewTab
          active={dashboard.activeTab === 'overview'}
          comparisonCycleReports={dashboard.comparisonCycleReports}
          comparisonCycleTransactions={dashboard.comparisonCycleTransactions}
          cycleTransactions={dashboard.cycleTransactions}
          monthlyReport={dashboard.monthlyReport}
          previousCycleCategorySpend={dashboard.previousCycleCategorySpend}
          previousCycleComparison={dashboard.previousCycleComparison}
          selectedCycleStart={dashboard.selectedCycleStart}
        />

        <ReviewTab
          active={dashboard.activeTab === 'review'}
          categories={dashboard.categories}
          isBusy={dashboard.isBusy}
          onCategorize={dashboard.categorizeTransaction}
          onPageChange={dashboard.setReviewPage}
          onPageSizeChange={dashboard.setReviewPageSize}
          page={dashboard.reviewPage}
          pageSize={dashboard.reviewPageSize}
          reviewQueue={dashboard.reviewQueue}
        />

        <InsightsTab
          active={dashboard.activeTab === 'insights'}
          categories={dashboard.categories}
          monthlyReport={dashboard.monthlyReport}
        />
      </main>

      <Toast message={dashboard.toastMessage} />
    </>
  )
}

export default App
