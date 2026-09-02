import React, { useState, useMemo } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { formatCycleOptionLabel, formatMoney, formatPercent } from '../lib/formatters'
import { dashboardChartColors } from '../../../theme'

const LEGEND_COLORS = dashboardChartColors

export default function ComparisonPieCard({ report, pieSegments, isSelected }) {
    const [showOther, setShowOther] = useState(false)

    const { topCategories, otherCategories, otherColor } = useMemo(() => {
        const visible = (report.categories || []).filter((c) => c.totalSpent > 0)
        const top = visible.slice(0, 5).map((category, index) => ({
            ...category,
            color: LEGEND_COLORS[index % LEGEND_COLORS.length],
        }))
        const others = visible.slice(5).map((category, index) => ({
            ...category,
            color: LEGEND_COLORS[(top.length + index) % LEGEND_COLORS.length],
        }))
        const otherColor = LEGEND_COLORS[top.length % LEGEND_COLORS.length]

        return { topCategories: top, otherCategories: others, otherColor }
    }, [report])

    function handlePieClick(data) {
        if (!data) return
        if (data.name === 'Other') {
            setShowOther((s) => !s)
        }
    }

    return (
        <article key={report.from} className={`comparison-pie-card${isSelected ? ' is-selected' : ''}`}>
            <header className="comparison-card-header">
                <div>
                    <h3>{formatCycleOptionLabel(report)}</h3>
                    <p className="section-note comparison-card-note">
                        {report.categories.length} categories across {report.totalTransactions} transactions
                    </p>
                </div>
                {isSelected ? <span className="tag">Selected</span> : null}
            </header>

            {pieSegments.length === 0 ? (
                <div className="comparison-pie-layout"><div style={{ padding: 16 }}>No outgoing spending in this cycle yet.</div></div>
            ) : (
                <div className="comparison-pie-layout">
                    <div className="comparison-pie-visual">
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie
                                    data={pieSegments.map((s) => ({ name: s.category, value: s.totalSpent, color: s.color }))}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={48}
                                    outerRadius={80}
                                    onClick={(data) => handlePieClick(data)}
                                >
                                    {pieSegments.map((segment) => (
                                        <Cell key={segment.category} fill={segment.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatMoney(value)} />
                            </PieChart>
                        </ResponsiveContainer>

                        <div className="comparison-pie-center">
                            {formatMoney(report.totalSpent)}
                        </div>
                    </div>

                    <div className="comparison-pie-legend">
                        {pieSegments.map((segment) => (
                            <div
                                key={`${report.from}-${segment.category}`}
                                className="comparison-pie-legend-item"
                                style={segment.category === 'Other' ? { cursor: 'pointer' } : undefined}
                                onClick={segment.category === 'Other' ? () => setShowOther((s) => !s) : undefined}
                            >
                                <span
                                    className="comparison-pie-swatch"
                                    style={{ backgroundColor: segment.color }}
                                ></span>
                                <div className="comparison-pie-legend-copy">
                                    <strong>{segment.category}</strong>
                                    <span>
                                        {formatMoney(segment.totalSpent)} ({formatPercent(segment.share)})
                                    </span>
                                </div>
                            </div>
                        ))}

                        {showOther && otherCategories.length > 0 ? (
                            <div style={{ marginTop: 8, paddingLeft: 6 }}>
                                {otherCategories.map((cat) => (
                                    <div key={`${report.from}-other-${cat.category}`} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                                        <span style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: cat.color, display: 'inline-block' }} />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <strong style={{ fontSize: 13 }}>{cat.category}</strong>
                                            <span style={{ fontSize: 13, color: 'var(--mui-palette-text-secondary)' }}>{formatMoney(cat.totalSpent)} ({formatPercent(cat.totalSpent / (otherCategories.reduce((s, c) => s + c.totalSpent, 0) || 1))})</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </article>
    )
}
