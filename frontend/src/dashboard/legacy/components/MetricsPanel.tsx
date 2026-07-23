import React from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import EmptyState from './shared/EmptyState'
import { formatMoney } from '../lib/formatters'

function buildRecurringSpend(cycleTransactions) {
    return cycleTransactions.reduce((total, transaction) => {
        if (transaction.direction !== 'expense' || !transaction.isMonthlyRecurring) {
            return total
        }

        return total + Math.abs(transaction.amount)
    }, 0)
}

export default function MetricsPanel({ cycleTransactions, monthlyReport }) {
    const nonRecurringSpend = buildRecurringSpend(cycleTransactions)
    const metricCards = monthlyReport
        ? [
            {
                label: 'Uncategorized',
                value: formatMoney(monthlyReport.uncategorizedSpent),
                tone: 'accent',
            },
            {
                label: 'Recurring spend',
                value: formatMoney(nonRecurringSpend),
                tone: 'secondary',
            }
        ]
        : []

    return (
        <section className="panel metrics-panel">
            {monthlyReport ? (
                <Box className="metric-grid" sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' } }}>
                    {metricCards.map((metric) => (
                        <Paper key={metric.label} sx={{ p: 2 }} elevation={0} className="metric-card">
                            <Typography variant="caption" className="metric-label">{metric.label}</Typography>
                            <Typography variant="h6" className={`metric-value ${metric.tone}`.trim()}>{metric.value}</Typography>
                        </Paper>
                    ))}
                </Box>
            ) : (
                <EmptyState message="No spending-cycle data available yet." />
            )}
        </section>
    )
}
