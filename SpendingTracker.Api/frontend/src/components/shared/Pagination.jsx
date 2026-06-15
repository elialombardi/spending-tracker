import { PAGE_SIZE_OPTIONS } from '../../lib/constants'

export default function Pagination({
    currentPage,
    itemCount,
    onPageChange,
    onPageSizeChange,
    pageCount,
    pageSize,
}) {
    if (itemCount === 0) {
        return null
    }

    const previousPage = Math.max(1, currentPage - 1)
    const nextPage = Math.min(pageCount, currentPage + 1)
    const firstItem = Math.min((currentPage - 1) * pageSize + 1, itemCount)
    const lastItem = Math.min(currentPage * pageSize, itemCount)

    return (
        <div className="review-pagination">
            <span className="pagination-summary">
                Showing {firstItem}-{lastItem} of {itemCount}
            </span>

            <label className="pagination-page-size">
                <span>Page size</span>
                <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
                    {PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            </label>

            {pageCount > 1 ? (
                <>
                    <button
                        className="button button-ghost pager-button"
                        type="button"
                        onClick={() => onPageChange(previousPage)}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </button>
                    <button
                        className="button button-ghost pager-button"
                        type="button"
                        onClick={() => onPageChange(nextPage)}
                        disabled={currentPage === pageCount}
                    >
                        Next
                    </button>
                </>
            ) : null}
        </div>
    )
}