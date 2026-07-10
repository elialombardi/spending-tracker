import React, { useState, useMemo } from 'react'
import EmptyState from './shared/EmptyState'
import Pagination from './shared/Pagination'
import { PAGE_SIZE_OPTIONS } from '../lib/constants'
import { formatDate, formatMoney } from '../lib/formatters'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'

function formatSignedMoney(value) {
    return value > 0 ? `+${formatMoney(value)}` : formatMoney(value)
}

export default function CycleItemsPanel({ cycleTransactions }) {
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[3])
    const [selectedCategory, setSelectedCategory] = useState(null)

    const categories = useMemo(() => {
        const set = new Set()
        cycleTransactions.forEach((t) => {
            if (t.category) set.add(t.category)
        })
        return Array.from(set).sort()
    }, [cycleTransactions])

    const filteredTransactions = useMemo(() => {
        if (!selectedCategory) return cycleTransactions
        return cycleTransactions.filter((t) => (t.category || 'Uncategorized') === selectedCategory)
    }, [cycleTransactions, selectedCategory])

    const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / pageSize))
    const visiblePage = Math.min(currentPage, pageCount)
    const start = (visiblePage - 1) * pageSize
    const currentItems = useMemo(() => filteredTransactions.slice(start, start + pageSize), [filteredTransactions, start, pageSize])

    function handlePageSizeChange(size) {
        setPageSize(size)
        setCurrentPage(1)
    }

    if (cycleTransactions.length === 0) {
        return (
            <section className="panel cycle-items-panel">
                <EmptyState message="No transactions in the selected cycle yet." />
            </section>
        )
    }

    return (
        <section className="panel cycle-items-panel">
            <div className="expense-list">
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                    <Autocomplete
                        options={['Uncategorized', ...categories]}
                        value={selectedCategory}
                        onChange={(event, value) => {
                            setSelectedCategory(value)
                            setCurrentPage(1)
                        }}
                        clearOnEscape
                        sx={{ width: 300 }}
                        renderInput={(params) => (
                            <TextField {...params} size="small" label="Filter by category" />
                        )}
                    />
                    <div style={{ color: 'var(--muted, rgba(255,255,255,0.65))' }}>{filteredTransactions.length} items</div>
                </div>
                {currentItems.map((transaction) => (
                    <article key={transaction.transactionId} className="expense-card">
                        <header>
                            <div>
                                <h3>{transaction.description}</h3>
                                <div className="expense-meta">
                                    <span>{formatDate(transaction.bookingDate)}</span>
                                    <span> {transaction.merchantKey}</span>
                                </div>
                            </div>
                            <span className="money-pill">{formatSignedMoney(transaction.amount)}</span>
                        </header>

                        <div className="merchant-meta">
                            <span>{transaction.direction === 'income' ? 'Income' : 'Expense'}</span>
                            <span> {transaction.category || 'Uncategorized'}</span>
                            {transaction.isMonthlyRecurring ? <span>Monthly recurring</span> : null}
                            {transaction.needsReview ? <span>Needs review</span> : null}
                        </div>
                    </article>
                ))}
            </div>

            <Pagination
                currentPage={visiblePage}
                itemCount={cycleTransactions.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
                pageCount={pageCount}
                pageSize={pageSize}
            />
        </section>
    )
}
