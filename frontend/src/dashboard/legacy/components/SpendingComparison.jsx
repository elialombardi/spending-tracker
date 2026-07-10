import React from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { formatMoney } from '../lib/formatters'
import { formatCycleOptionLabel, formatDate } from '../lib/formatters'
import Chip from '@mui/material/Chip'

export default function SpendingComparison({ comparisonChartData, comparisonChartYTicks, comparisonChartScale, comparisonChartSeries, spendingGranularity }) {
    return (
        <div className="spending-comparison-layout">
            <div className="spending-comparison-chart-shell">
                <div className="spending-comparison-chart-frame">
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart
                            data={comparisonChartData}
                            margin={{
                                top: 16,
                                right: 28,
                                left: 96,
                                bottom: 48,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis ticks={comparisonChartYTicks} domain={[0, comparisonChartScale.axisMax]} tickFormatter={(v) => formatMoney(v)} />
                            <Tooltip formatter={(value) => formatMoney(value)} />
                            {comparisonChartSeries.map((series, idx) => (
                                <Line
                                    key={series.report.from}
                                    name={formatCycleOptionLabel(series.report)}
                                    type="monotone"
                                    dataKey={`s${idx}`}
                                    stroke={series.color}
                                    strokeWidth={series.isSelectedCycle ? 3 : 2}
                                    dot={{ r: series.isSelectedCycle ? 5 : 4 }}
                                    activeDot={{ r: series.isSelectedCycle ? 6 : 5 }}
                                />
                            ))}
                            <Legend />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="spending-comparison-series-grid">
                {comparisonChartSeries.map((series) => (
                    <article
                        key={`summary-${series.report.from}`}
                        className={`spending-series-card${series.isSelectedCycle ? ' is-selected' : ''}`}
                    >
                        <header className="spending-series-header">
                            <div className="spending-series-title">
                                <span
                                    className="spending-series-swatch"
                                    style={{ backgroundColor: series.color }}
                                ></span>
                                <div className="spending-series-copy">
                                    <strong>{formatCycleOptionLabel(series.report)}</strong><br />
                                    <span>
                                        {series.isSelectedCycle && series.through !== series.report.to
                                            ? `Selected cycle through ${formatDate(series.through)}`
                                            : `Cycle ends ${formatDate(series.report.to)}`}
                                    </span>
                                </div>
                            </div>
                            {series.isSelectedCycle ? <Chip className="tag tag-secondary" label="Selected" /> : null}
                        </header>

                        <div className="spending-series-meta">
                            <span>
                                {formatMoney(series.totalSpent)}{' '}
                                {series.isSelectedCycle && series.through !== series.report.to
                                    ? 'spent so far'
                                    : 'spent in cycle'}
                            </span>
                            <span>
                                {series.groupedSpend.length}{' '}
                                {spendingGranularity === 'day'
                                    ? 'days'
                                    : spendingGranularity === 'week'
                                        ? 'weeks'
                                        : 'months'}{' '}
                                in cycle
                            </span>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    )
}
