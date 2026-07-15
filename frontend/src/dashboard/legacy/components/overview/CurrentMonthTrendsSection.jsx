import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import { ResponsiveContainer, ComposedChart, Bar, CartesianGrid, Cell, Line, Pie, PieChart, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyState from '../shared/EmptyState'
import { formatDate, formatMoney, formatPercent } from '../../lib/formatters'
import { buildCurrentCycleTrendData, buildPieSegments } from './data'
import { dashboardStatusColors } from '../../../../theme'

function formatSignedMoney(value) {
    return value > 0 ? `+${formatMoney(value)}` : formatMoney(value)
}

function getTransactionTitle(transaction) {
    return transaction.merchantKey || transaction.description || 'Transaction'
}

function getWeeklySpendBarColor(week) {
    return week.totalSpent <= week.availableBudget ? dashboardStatusColors.positive : dashboardStatusColors.negative
}

export default function CurrentMonthTrendsSection({
    canWrite,
    cycleReport,
    cycleTransactions,
    isBusy,
    onSetCycleIncomeTransactionRelation,
}) {
    const theme = useTheme()
    const {
        currentWeekLabel,
        cycleBudget,
        isCurrentCycle,
        cycleRemaining,
        cycleSpent,
        weekAvailable,
        weekChartData,
        weekRemaining,
    } = buildCurrentCycleTrendData({
        currentCycleReport: cycleReport,
        currentCycleTransactions: cycleTransactions,
    })
    const [selectedWeekKey, setSelectedWeekKey] = useState(null)
    const [isIncomeDrawerOpen, setIsIncomeDrawerOpen] = useState(false)
    const hasCycleData = Boolean(cycleReport) || cycleTransactions.length > 0
    const cycleIncomeTransactions = cycleTransactions
        .filter((transaction) => transaction.direction === 'income')
        .sort((left, right) => right.bookingDate.localeCompare(left.bookingDate))
    const visibleSelectedWeekKey = weekChartData.some((week) => week.weekKey === selectedWeekKey)
        ? selectedWeekKey
        : null
    const selectedWeek = weekChartData.find((week) => week.weekKey === visibleSelectedWeekKey) ?? null
    const selectedWeekTransactions = selectedWeek
        ? [...selectedWeek.transactions].sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount))
        : []
    const selectedWeekPieSegments = buildPieSegments(
        selectedWeekTransactions.reduce((categories, transaction) => {
            const categoryName = transaction.category || 'Uncategorized'
            const existingCategory = categories.find((category) => category.category === categoryName)

            if (existingCategory) {
                existingCategory.totalSpent += Math.abs(transaction.amount)
                existingCategory.transactions += 1
                return categories
            }

            categories.push({
                category: categoryName,
                totalSpent: Math.abs(transaction.amount),
                transactions: 1,
            })

            return categories
        }, []),
    )
    const summaryCards = [
        ...(isCurrentCycle ? [{
            label: 'Remaining this week',
            tone: weekRemaining < 0 ? 'accent' : '',
            value: formatMoney(weekRemaining),
            note: `Week ${currentWeekLabel} · of ${formatMoney(weekAvailable)}`,
        }] : []),
        {
            label: 'Budget left this cycle',
            note: `Budget: ${formatMoney(cycleBudget)} · Spent: ${formatMoney(cycleSpent)}`,
            tone: cycleRemaining < 0 ? 'accent' : 'secondary',
            value: formatMoney(cycleRemaining),
        },
    ]

    if (!hasCycleData) {
        return (
            <section className="panel current-month-trends-panel">
                <EmptyState message="No current-cycle transactions are available yet." />
            </section>
        )
    }

    return (
        <section className="panel current-month-trends-panel">
            <Box className="current-month-summary-grid">
                {summaryCards.map((metric) => (
                    <Paper key={metric.label} sx={{ p: 2 }} elevation={0} className="metric-card current-month-summary-card">
                        <Typography variant="caption" className="metric-label">{metric.label}</Typography>
                        <Typography variant="h6" className={`metric-value ${metric.tone}`.trim()}>{metric.value}</Typography>
                        <Typography variant="body2" className="section-note">{metric.note}</Typography>
                        {metric.label === 'Budget left this cycle' ? (
                            <Button
                                variant="text"
                                size="small"
                                sx={{ mt: 1, px: 0, minWidth: 0, justifyContent: 'flex-start' }}
                                onClick={() => setIsIncomeDrawerOpen(true)}
                            >
                                Show cycle incomes
                            </Button>
                        ) : null}
                    </Paper>
                ))}
            </Box>

            <div className="current-month-chart-shell">
                <div className="current-month-chart-frame">
                    <ResponsiveContainer width="100%" height={280}>
                        <ComposedChart data={weekChartData} margin={{ top: 16, right: 16, left: 24, bottom: 24 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" />
                            <YAxis tickFormatter={(value) => formatMoney(value)} />
                            <Tooltip
                                formatter={(value, _name, entry) => [
                                    formatMoney(value),
                                    entry?.dataKey === 'availableBudget' ? 'Weekly available budget' : 'Spent',
                                ]}
                                labelFormatter={(label, payload) => {
                                    const point = payload?.[0]?.payload

                                    return point ? `Week ${label} (${point.from} to ${point.to})` : label
                                }}
                            />
                            <Bar dataKey="totalSpent" radius={[6, 6, 0, 0]}>
                                {weekChartData.map((week) => (
                                    <Cell
                                        key={week.weekKey}
                                        fill={getWeeklySpendBarColor(week)}
                                        cursor="pointer"
                                        opacity={visibleSelectedWeekKey && visibleSelectedWeekKey !== week.weekKey ? 0.55 : 1}
                                        stroke={visibleSelectedWeekKey === week.weekKey ? dashboardStatusColors.highlight : undefined}
                                        strokeWidth={visibleSelectedWeekKey === week.weekKey ? 2 : 0}
                                        onClick={() => setSelectedWeekKey((currentKey) => currentKey === week.weekKey ? null : week.weekKey)}
                                    />
                                ))}
                            </Bar>
                            <Line
                                type="monotone"
                                dataKey="availableBudget"
                                name="Weekly available budget"
                                stroke={dashboardStatusColors.highlight}
                                strokeWidth={3}
                                dot={{ fill: dashboardStatusColors.highlight, r: 4, strokeWidth: 0 }}
                                activeDot={{ r: 6 }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <Typography variant="body2" className="section-note" sx={{ mt: 1.5 }}>
                Click a spending column to open the transactions included in that weekly total.
            </Typography>
            <Drawer
                anchor="bottom"
                open={Boolean(selectedWeek)}
                onClose={() => setSelectedWeekKey(null)}
                PaperProps={{
                    sx: {
                        borderTopLeftRadius: 12,
                        borderTopRightRadius: 12,
                        maxHeight: '75vh',
                        boxShadow: '0 -24px 80px rgba(0,0,0,0.45)',
                    },
                }}
            >
                {selectedWeek ? (
                    <Box sx={{ p: { xs: 2, sm: 3 }, overflow: 'auto' }}>
                        <Box
                            sx={{
                                width: 56,
                                height: 5,
                                borderRadius: 999,
                                backgroundColor: alpha(theme.palette.common.white, 0.12),
                                mx: 'auto',
                                mb: 2,
                            }}
                        />
                        <Stack
                            direction="row"
                            alignItems="flex-start"
                            justifyContent="space-between"
                            spacing={2}
                            sx={{ mb: 2 }}
                        >
                            <Box>
                                <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
                                    Weekly Spend Breakdown
                                </Typography>
                                <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
                                    Week {selectedWeek.label}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
                                    {selectedWeek.from} to {selectedWeek.to}
                                </Typography>
                            </Box>
                            <IconButton
                                aria-label="Close weekly transactions"
                                onClick={() => setSelectedWeekKey(null)}
                                size="small"
                                sx={{
                                    color: 'text.primary',
                                    width: 36,
                                    height: 36,
                                    border: `1px solid ${theme.palette.divider}`,
                                    backgroundColor: alpha(theme.palette.common.white, 0.03),
                                    '&:hover': {
                                        backgroundColor: alpha(theme.palette.common.white, 0.08),
                                        borderColor: alpha(theme.palette.common.white, 0.14),
                                    },
                                }}
                            >
                                <CloseIcon />
                            </IconButton>
                        </Stack>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2.5 }}>
                            <Chip label={`${selectedWeekTransactions.length} transactions`} size="small" variant="outlined" />
                            <Chip label={`Spent ${formatMoney(selectedWeek.totalSpent)}`} size="small" variant="outlined" />
                            <Chip label={`Budget ${formatMoney(selectedWeek.availableBudget)}`} size="small" variant="outlined" />
                        </Stack>
                        {selectedWeekPieSegments.length > 0 ? (
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', md: '220px 1fr' },
                                    gap: 2,
                                    alignItems: 'center',
                                    mb: 2.5,
                                }}
                            >
                                <Box sx={{ position: 'relative', height: 200 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={selectedWeekPieSegments.map((segment) => ({
                                                    name: segment.category,
                                                    value: segment.totalSpent,
                                                    color: segment.color,
                                                }))}
                                                dataKey="value"
                                                nameKey="name"
                                                innerRadius={44}
                                                outerRadius={74}
                                                paddingAngle={2}
                                            >
                                                {selectedWeekPieSegments.map((segment) => (
                                                    <Cell key={`week-category-${segment.category}`} fill={segment.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(value) => formatMoney(value)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            inset: 0,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            pointerEvents: 'none',
                                        }}
                                    >
                                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                            Total spent
                                        </Typography>
                                        <Typography variant="subtitle1">{formatMoney(selectedWeek.totalSpent)}</Typography>
                                    </Box>
                                </Box>
                                <Box sx={{ display: 'grid', gap: 1 }}>
                                    {selectedWeekPieSegments.map((segment) => (
                                        <Stack key={`week-legend-${segment.category}`} direction="row" spacing={1.25} alignItems="center">
                                            <Box
                                                sx={{
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: '999px',
                                                    flexShrink: 0,
                                                    backgroundColor: segment.color,
                                                }}
                                            />
                                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                                <Typography variant="body2" sx={{ lineHeight: 1.2 }}>
                                                    {segment.category}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                    {formatMoney(segment.totalSpent)} · {formatPercent(segment.share)}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    ))}
                                </Box>
                            </Box>
                        ) : null}
                        <Divider sx={{ borderColor: 'divider', mb: 2.5 }} />
                        {selectedWeekTransactions.length === 0 ? (
                            <EmptyState message="No non-recurring expense transactions were included in this weekly total." />
                        ) : (
                            <Box sx={{ display: 'grid', gap: 1.25 }}>
                                {selectedWeekTransactions.map((transaction) => (
                                    <Paper
                                        key={transaction.transactionId}
                                        elevation={0}
                                        sx={{
                                            p: 1.5,
                                            borderRadius: 3,
                                            background: alpha(theme.palette.common.white, 0.035),
                                            border: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                                        }}
                                    >
                                        <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography variant="subtitle2" sx={{ fontSize: '0.98rem', lineHeight: 1.3 }}>
                                                    {getTransactionTitle(transaction)}
                                                </Typography>
                                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                                                    {formatDate(transaction.bookingDate)}
                                                </Typography>
                                            </Box>
                                            <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap', color: 'text.primary' }}>
                                                {formatSignedMoney(transaction.amount)}
                                            </Typography>
                                        </Stack>
                                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.25 }}>
                                            <Chip label={transaction.category || 'Uncategorized'} size="small" variant="outlined" />
                                            {transaction.needsReview ? <Chip label="Needs review" size="small" variant="outlined" /> : null}
                                        </Stack>
                                        {transaction.description && transaction.description !== getTransactionTitle(transaction) ? (
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    mt: 1.25,
                                                    color: alpha(theme.palette.text.primary, 0.46),
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                            >
                                                {transaction.description}
                                            </Typography>
                                        ) : null}
                                    </Paper>
                                ))}
                            </Box>
                        )}
                    </Box>
                ) : null}
            </Drawer>
            <Drawer
                anchor="right"
                open={isIncomeDrawerOpen}
                onClose={() => setIsIncomeDrawerOpen(false)}
                PaperProps={{
                    sx: {
                        width: { xs: '100%', sm: 460 },
                        backgroundColor: 'background.paper',
                        color: 'text.primary',
                        borderLeft: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                        boxShadow: '-24px 0 80px rgba(0,0,0,0.45)',
                    },
                }}
            >
                <Box sx={{ p: { xs: 2, sm: 3 }, overflow: 'auto', height: '100%' }}>
                    <Stack
                        direction="row"
                        alignItems="flex-start"
                        justifyContent="space-between"
                        spacing={2}
                        sx={{ mb: 2 }}
                    >
                        <Box>
                            <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.08em' }}>
                                Cycle Incomes
                            </Typography>
                            <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
                                Budget sources for this cycle
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
                                Exclude any income that should not count toward the cycle budget.
                            </Typography>
                        </Box>
                        <IconButton
                            aria-label="Close cycle incomes"
                            onClick={() => setIsIncomeDrawerOpen(false)}
                            size="small"
                            sx={{
                                color: 'text.primary',
                                width: 36,
                                height: 36,
                                border: `1px solid ${theme.palette.divider}`,
                                backgroundColor: alpha(theme.palette.common.white, 0.03),
                                '&:hover': {
                                    backgroundColor: alpha(theme.palette.common.white, 0.08),
                                    borderColor: alpha(theme.palette.common.white, 0.14),
                                },
                            }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2.5 }}>
                        <Chip label={`${cycleIncomeTransactions.length} incomes`} size="small" variant="outlined" />
                        <Chip label={`Budget ${formatMoney(cycleBudget)}`} size="small" variant="outlined" />
                    </Stack>
                    <Divider sx={{ borderColor: 'divider', mb: 2.5 }} />
                    {cycleIncomeTransactions.length === 0 ? (
                        <EmptyState message="No income transactions were recorded in this cycle." />
                    ) : (
                        <Box sx={{ display: 'grid', gap: 1.25 }}>
                            {cycleIncomeTransactions.map((transaction) => {
                                const isRelatedToCycle = !transaction.excludeFromCalculations

                                return (
                                    <Paper
                                        key={transaction.transactionId}
                                        elevation={0}
                                        sx={{
                                            p: 1.5,
                                            borderRadius: 3,
                                            background: alpha(theme.palette.common.white, 0.035),
                                            border: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
                                        }}
                                    >
                                        <Stack direction="row" justifyContent="space-between" spacing={2} alignItems="flex-start">
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography variant="subtitle2" sx={{ fontSize: '0.98rem', lineHeight: 1.3 }}>
                                                    {getTransactionTitle(transaction)}
                                                </Typography>
                                                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                                                    {formatDate(transaction.bookingDate)}
                                                </Typography>
                                            </Box>
                                            <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap', color: 'text.primary' }}>
                                                {formatSignedMoney(transaction.amount)}
                                            </Typography>
                                        </Stack>
                                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.25 }}>
                                            <Chip
                                                label={isRelatedToCycle ? 'Included in cycle' : 'Excluded from cycle'}
                                                size="small"
                                                variant="outlined"
                                                color={isRelatedToCycle ? 'success' : 'default'}
                                            />
                                            {transaction.category ? <Chip label={transaction.category} size="small" variant="outlined" /> : null}
                                        </Stack>
                                        {transaction.description && transaction.description !== getTransactionTitle(transaction) ? (
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    mt: 1.25,
                                                    color: alpha(theme.palette.text.primary, 0.46),
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                            >
                                                {transaction.description}
                                            </Typography>
                                        ) : null}
                                        <Button
                                            variant={isRelatedToCycle ? 'outlined' : 'contained'}
                                            size="small"
                                            disabled={!canWrite || isBusy || !transaction.category}
                                            sx={{ mt: 1.5, alignSelf: 'flex-start' }}
                                            onClick={() => onSetCycleIncomeTransactionRelation(transaction, !isRelatedToCycle)}
                                        >
                                            {isRelatedToCycle ? 'Mark as not related to cycle' : 'Count in cycle budget'}
                                        </Button>
                                        {!canWrite ? (
                                            <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: alpha(theme.palette.text.primary, 0.5) }}>
                                                Updating cycle-income relations requires a Writer or Admin role.
                                            </Typography>
                                        ) : null}
                                        {!transaction.category ? (
                                            <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: alpha(theme.palette.text.primary, 0.5) }}>
                                                This income needs a category before it can be included or excluded.
                                            </Typography>
                                        ) : null}
                                    </Paper>
                                )
                            })}
                        </Box>
                    )}
                </Box>
            </Drawer>
        </section>
    )
}
