import { formatDate, formatMoney } from '../lib/formatters'
import EmptyState from './shared/EmptyState'

export default function InsightsTab({ active, categories, monthlyReport }) {
    const merchants = monthlyReport?.topMerchants ?? []
    const largestExpenses = monthlyReport?.largestExpenses ?? []

    return (
        <section
            id="page-insights"
            className={`tab-page${active ? ' is-active' : ''}`}
            role="tabpanel"
            aria-labelledby="tab-insights"
            hidden={!active}
        >
            <div className="layout">
                <section className="panel merchants-panel">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Patterns</p>
                            <h2>Top merchants in this cycle</h2>
                        </div>
                    </div>

                    {merchants.length === 0 ? (
                        <EmptyState message="No outgoing merchants in the selected income cycle." />
                    ) : (
                        <div className="merchant-list">
                            {merchants.map((merchant) => (
                                <article key={merchant.merchantKey} className="merchant-card">
                                    <header>
                                        <h3>{merchant.merchantKey}</h3>
                                        <span className="money-pill">{formatMoney(merchant.totalSpent)}</span>
                                    </header>
                                    <div className="merchant-meta">
                                        <span>{merchant.transactions} transactions</span>
                                        <span>{merchant.category || 'Uncategorized'}</span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section className="panel expenses-panel">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Largest expenses</p>
                            <h2>Biggest outgoing transactions</h2>
                        </div>
                    </div>

                    {largestExpenses.length === 0 ? (
                        <EmptyState message="No large expenses to show yet." />
                    ) : (
                        <div className="expense-list">
                            {largestExpenses.map((expense) => (
                                <article key={expense.transactionId} className="expense-card">
                                    <header>
                                        <h3>{expense.description}</h3>
                                        <span className="money-pill">{formatMoney(Math.abs(expense.amount))}</span>
                                    </header>
                                    <div className="expense-meta">
                                        <span>{formatDate(expense.bookingDate)}</span>
                                        <span>{expense.category || 'Uncategorized'}</span>
                                        <span>{expense.merchantKey}</span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section className="panel rules-panel">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Learned categories</p>
                            <h2>What the system already knows</h2>
                        </div>
                    </div>

                    {categories.length === 0 ? (
                        <EmptyState message="No reusable categories yet. Save a stable merchant with “remember category” to start building memory." />
                    ) : (
                        <div className="known-categories">
                            {categories.map((category) => (
                                <article key={category.name} className="known-category-card">
                                    <h3>{category.name}</h3>
                                    <div className="known-category-meta">
                                        <span>{category.rules} rules</span>
                                        <span>{category.transactions} categorized transactions</span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </section>
    )
}