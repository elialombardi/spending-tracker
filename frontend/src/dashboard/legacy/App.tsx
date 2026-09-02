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
          canWrite={dashboard.canWrite}
          importResult={dashboard.importResult}
          isBusy={dashboard.isBusy}
          onUpload={dashboard.uploadWorkbook}
        />

        <OverviewTab
          active={dashboard.activeTab === 'overview'}
          canWrite={dashboard.canWrite}
          comparisonCycleReports={dashboard.comparisonCycleReports}
          comparisonCycleTransactions={dashboard.comparisonCycleTransactions}
          currentCycleReport={dashboard.currentCycleReport}
          currentCycleTransactions={dashboard.currentCycleTransactions}
          cycleTransactions={dashboard.cycleTransactions}
          isBusy={dashboard.isBusy}
          monthlyReport={dashboard.monthlyReport}
          onSetCycleIncomeTransactionRelation={dashboard.setCycleIncomeTransactionRelation}
          previousCycleCategorySpend={dashboard.previousCycleCategorySpend}
          previousCycleComparison={dashboard.previousCycleComparison}
          selectedCycleStart={dashboard.selectedCycleStart}
        />

        <ReviewTab
          active={dashboard.activeTab === 'review'}
          canWrite={dashboard.canWrite}
          categories={dashboard.categories}
          categorizedExpenses={dashboard.categorizedExpenses}
          categorizedPage={dashboard.categorizedPage}
          categorizedPageSize={dashboard.categorizedPageSize}
          cycleIncomeCategories={dashboard.cycleIncomeCategories}
          categoryMappings={dashboard.categoryMappings}
          incomePage={dashboard.incomePage}
          incomePageSize={dashboard.incomePageSize}
          incomeTransactions={dashboard.incomeTransactions}
          isBusy={dashboard.isBusy}
          onCategorize={dashboard.categorizeTransaction}
          onCategorizedPageChange={dashboard.setCategorizedPage}
          onCategorizedPageSizeChange={dashboard.setCategorizedPageSize}
          onDeleteMapping={dashboard.deleteCategoryMapping}
          onIncomePageChange={dashboard.setIncomePage}
          onIncomePageSizeChange={dashboard.setIncomePageSize}
          onMappingsPageChange={dashboard.setMappingPage}
          onMappingsPageSizeChange={dashboard.setMappingPageSize}
          onPageChange={dashboard.setReviewPage}
          onPageSizeChange={dashboard.setReviewPageSize}
          onSaveMapping={dashboard.saveCategoryMapping}
          onSaveCycleIncomeCategories={dashboard.saveCycleIncomeCategories}
          onUpdateTransactionAmount={dashboard.updateTransactionAmount}
          mappingsPage={dashboard.mappingPage}
          mappingsPageSize={dashboard.mappingPageSize}
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
