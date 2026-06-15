import CategoryAssignmentCard from './shared/CategoryAssignmentCard'
import EmptyState from './shared/EmptyState'
import Pagination from './shared/Pagination'

export default function ReviewTab({
    active,
    categories,
    isBusy,
    onCategorize,
    onPageChange,
    onPageSizeChange,
    page,
    pageSize,
    reviewQueue,
}) {
    const pageCount = Math.max(1, Math.ceil(reviewQueue.length / pageSize))
    const currentPage = Math.min(page, pageCount)
    const pageStart = (currentPage - 1) * pageSize
    const pageItems = reviewQueue.slice(pageStart, pageStart + pageSize)

    return (
        <section
            id="page-review"
            className={`tab-page${active ? ' is-active' : ''}`}
            role="tabpanel"
            aria-labelledby="tab-review"
            hidden={!active}
        >
            <div className="layout">
                <section className="panel review-panel review-panel-wide">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Review queue</p>
                            <h2>Teach the tracker the uncertain rows</h2>
                        </div>
                        <p className="section-note">
                            Use reusable rules for stable merchants, and switch volatile merchants like
                            Amazon to “always ask” so every payment stays reviewable.
                        </p>
                    </div>

                    {reviewQueue.length === 0 ? (
                        <EmptyState message="Nothing to review for the selected income cycle. The learned rules covered everything." />
                    ) : (
                        <>
                            <div className="review-queue">
                                {pageItems.map((transaction) => (
                                    <CategoryAssignmentCard
                                        categories={categories}
                                        key={transaction.transactionId}
                                        context="review"
                                        isBusy={isBusy}
                                        onSave={onCategorize}
                                        transaction={transaction}
                                    />
                                ))}
                            </div>

                            <Pagination
                                currentPage={currentPage}
                                itemCount={reviewQueue.length}
                                onPageChange={onPageChange}
                                onPageSizeChange={onPageSizeChange}
                                pageCount={pageCount}
                                pageSize={pageSize}
                            />
                        </>
                    )}
                </section>
            </div>
        </section>
    )
}