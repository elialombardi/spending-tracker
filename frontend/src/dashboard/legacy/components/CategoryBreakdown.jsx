import React from 'react'
import { formatPercent, formatMoney, formatDate } from '../lib/formatters'

function getPreviousCycleComparisonTone(currentAmount, previousAmount) {
    if (previousAmount > currentAmount) {
        return 'is-higher'
    }

    if (previousAmount < currentAmount) {
        return 'is-lower'
    }

    return ''
}

export default function CategoryBreakdown({ monthlyReport, previousCycleComparison, previousCycleCategorySpend }) {
    return (
        <>
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
                                <div className="category-bar" style={{ width: `${width}%` }}></div>
                                <div>
                                    <span className={`money-pill ${currentCostTone}`.trim()} style={{ marginLeft: 8 }}>
                                        {formatMoney(category.totalSpent)}
                                    </span>
                                    <strong>{category.category}</strong>
                                    {
                                        previousCycleComparison ? (
                                            <span> (prev. {formatMoney(previousCycleAmount)})</span>
                                        ) : null
                                    }
                                </div>

                                <div>
                                </div>
                                <div className="merchant-meta" style={{ fontSize: "0.875rem" }}>
                                    <span>{formatPercent(category.shareOfSpent)} of spending</span>
                                    <span> - {category.transactions} transactions</span>
                                </div>
                            </article>
                        )
                    })}
                </div >
            ) : (
                <div style={{ padding: 16 }}>No expenses in the selected income cycle yet.</div>
            )
            }
        </>
    )
}
