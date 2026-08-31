import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
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
            <Box sx={{ p: 2 }}>
                <Paper elevation={0} sx={{ p: 2 }} className="merchants-panel">
                    <Typography variant="overline">Patterns</Typography>
                    <Typography variant="h5">Top merchants in this cycle</Typography>

                    {merchants.length === 0 ? (
                        <EmptyState message="No outgoing merchants in the selected income cycle." />
                    ) : (
                        <Box className="merchant-list">
                            {merchants.map((merchant) => (
                                <Paper key={merchant.merchantKey} elevation={0} sx={{ p: 1, mb: 1 }} className="merchant-card">
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="subtitle1">{merchant.merchantKey}</Typography>
                                        <Typography variant="subtitle2">{formatMoney(merchant.totalSpent)}</Typography>
                                    </Box>
                                    <Box className="merchant-meta">
                                        <Typography variant="caption">{merchant.transactions} transactions</Typography>
                                        <Typography variant="caption">{merchant.category || 'Uncategorized'}</Typography>
                                    </Box>
                                </Paper>
                            ))}
                        </Box>
                    )}
                </Paper>

                <Paper elevation={0} sx={{ p: 2, mt: 2 }} className="expenses-panel">
                    <Typography variant="overline">Largest expenses</Typography>
                    <Typography variant="h5">Biggest outgoing transactions</Typography>

                    {largestExpenses.length === 0 ? (
                        <EmptyState message="No large expenses to show yet." />
                    ) : (
                        <Box className="expense-list">
                            {largestExpenses.map((expense) => (
                                <Paper key={expense.transactionId} elevation={0} sx={{ p: 1, mb: 1 }} className="expense-card">
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography variant="subtitle1">{expense.description}</Typography>
                                        <Typography variant="subtitle2">{formatMoney(Math.abs(expense.amount))}</Typography>
                                    </Box>
                                    <Box className="expense-meta">
                                        <Typography variant="caption">{formatDate(expense.bookingDate)}</Typography>
                                        <Typography variant="caption">{expense.category || 'Uncategorized'}</Typography>
                                        <Typography variant="caption">{expense.merchantKey}</Typography>
                                        {expense.isMonthlyRecurring ? <Typography variant="caption">Monthly recurring</Typography> : null}
                                    </Box>
                                </Paper>
                            ))}
                        </Box>
                    )}
                </Paper>

                <Paper elevation={0} sx={{ p: 2, mt: 2 }} className="rules-panel">
                    <Typography variant="overline">Learned categories</Typography>
                    <Typography variant="h5">What the system already knows</Typography>

                    {categories.length === 0 ? (
                        <EmptyState message="No reusable categories yet. Save a stable merchant with “remember category” to start building memory." />
                    ) : (
                        <Box className="known-categories">
                            {categories.map((category) => (
                                <Paper key={category.name} elevation={0} sx={{ p: 1, mb: 1 }} className="known-category-card">
                                    <Typography variant="subtitle1">{category.name}</Typography>
                                    <Box className="known-category-meta">
                                        <Typography variant="caption">{category.rules} rules</Typography>
                                        <Typography variant="caption">{category.transactions} categorized transactions</Typography>
                                    </Box>
                                </Paper>
                            ))}
                        </Box>
                    )}
                </Paper>
            </Box>
        </section>
    )
}