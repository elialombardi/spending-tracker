import React from 'react'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { formatMoney, formatDate } from '../lib/formatters'

export default function TrendChart({ comparisonTrendData, selectedCycleStart }) {
    return (
        <div className="trend-chart-grid">
            <ResponsiveContainer width="100%" height={180}>
                <BarChart
                    data={comparisonTrendData.map((item) => ({
                        name: formatDate(item.report.from),
                        totalSpent: item.totalSpent,
                        isSelected: item.report.from === selectedCycleStart,
                        ends: item.report.to,
                    }))}
                    margin={{ top: 16, right: 16, left: 24, bottom: 24 }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => formatMoney(v)} />
                    <Tooltip formatter={(v) => formatMoney(v)} />
                    <Bar dataKey="totalSpent">
                        {comparisonTrendData.map((entry, idx) => (
                            <Cell
                                key={`cell-${idx}`}
                                fill={entry.report.from === selectedCycleStart ? '#2f7a73' : '#3f6aa0'}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
