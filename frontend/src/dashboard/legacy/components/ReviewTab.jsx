import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CategoryAssignmentCard from './shared/CategoryAssignmentCard'
import EmptyState from './shared/EmptyState'
import ImportManagementPanel from './ImportManagementPanel'
import Pagination from './shared/Pagination'

export default function ReviewTab({
    active,
    canWrite,
    categories,
    categorizedExpenses,
    categorizedPage,
    categorizedPageSize,
    cycleIncomeCategories,
    categoryMappings,
    incomePage,
    incomePageSize,
    incomeTransactions,
    isBusy,
    onCategorize,
    onCategorizedPageChange,
    onCategorizedPageSizeChange,
    onDeleteMapping,
    onIncomePageChange,
    onIncomePageSizeChange,
    onMappingsPageChange,
    onMappingsPageSizeChange,
    onPageChange,
    onPageSizeChange,
    onSaveMapping,
    onSaveCycleIncomeCategories,
    onUpdateTransactionAmount,
    mappingsPage,
    mappingsPageSize,
    page,
    pageSize,
    reviewQueue,
}) {
    const sortedReviewQueue = [...reviewQueue].sort(
        (left, right) => Math.abs(right.amount) - Math.abs(left.amount),
    )
    const pageCount = Math.max(1, Math.ceil(sortedReviewQueue.length / pageSize))
    const currentPage = Math.min(page, pageCount)
    const pageStart = (currentPage - 1) * pageSize
    const pageItems = sortedReviewQueue.slice(pageStart, pageStart + pageSize)

    return (
        <section
            id="page-review"
            className={`tab-page${active ? ' is-active' : ''}`}
            role="tabpanel"
            aria-labelledby="tab-review"
            hidden={!active}
        >
            <Box sx={{ p: 2 }}>
                <Paper elevation={0} sx={{ p: 2 }} className="review-panel review-panel-wide">
                    <Box sx={{ mb: 2 }} className="section-heading">
                        <Typography variant="overline">Review queue</Typography>
                        <Typography variant="h5">Teach the tracker the uncertain rows</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Use reusable rules for stable merchants, and switch volatile merchants like
                            Amazon to “always ask” so every payment stays reviewable.
                        </Typography>
                    </Box>

                    {!canWrite ? (
                        <Alert severity="info">
                            Reader accounts can inspect reports, but categorization and mapping updates require a Writer or Admin role.
                        </Alert>
                    ) : null}

                    {canWrite && sortedReviewQueue.length === 0 ? (
                        <EmptyState message="Nothing to review for the selected income cycle. The learned rules covered everything." />
                    ) : canWrite ? (
                        <>
                            <Box className="review-queue">
                                {pageItems.map((transaction) => (
                                    <CategoryAssignmentCard
                                        categories={categories}
                                        key={`${transaction.transactionId}-${transaction.amount}-${transaction.category || ''}-${transaction.suggestedCategory || ''}-${transaction.merchantRuleBehavior || ''}-${transaction.excludeFromCalculations ? '1' : '0'}-${transaction.isMonthlyRecurring ? '1' : '0'}`}
                                        context="review"
                                        isBusy={isBusy}
                                        onSave={onCategorize}
                                        onUpdateAmount={onUpdateTransactionAmount}
                                        transaction={transaction}
                                    />
                                ))}
                            </Box>

                            <Pagination
                                currentPage={currentPage}
                                itemCount={sortedReviewQueue.length}
                                onPageChange={onPageChange}
                                onPageSizeChange={onPageSizeChange}
                                pageCount={pageCount}
                                pageSize={pageSize}
                            />


                        </>
                    ) : null}
                </Paper>

                <Box sx={{ mt: 2 }}>
                    <ImportManagementPanel
                        canWrite={canWrite}
                        categories={categories}
                        categorizedExpenses={categorizedExpenses}
                        categorizedPage={categorizedPage}
                        categorizedPageSize={categorizedPageSize}
                        cycleIncomeCategories={cycleIncomeCategories}
                        categoryMappings={categoryMappings}
                        incomePage={incomePage}
                        incomePageSize={incomePageSize}
                        incomeTransactions={incomeTransactions}
                        isBusy={isBusy}
                        mappingsPage={mappingsPage}
                        mappingsPageSize={mappingsPageSize}
                        onCategorize={onCategorize}
                        onCategorizedPageChange={onCategorizedPageChange}
                        onCategorizedPageSizeChange={onCategorizedPageSizeChange}
                        onDeleteMapping={onDeleteMapping}
                        onIncomePageChange={onIncomePageChange}
                        onIncomePageSizeChange={onIncomePageSizeChange}
                        onMappingsPageChange={onMappingsPageChange}
                        onMappingsPageSizeChange={onMappingsPageSizeChange}
                        onSaveMapping={onSaveMapping}
                        onSaveCycleIncomeCategories={onSaveCycleIncomeCategories}
                        onUpdateTransactionAmount={onUpdateTransactionAmount}
                    />
                </Box>
            </Box>
        </section>
    )
}