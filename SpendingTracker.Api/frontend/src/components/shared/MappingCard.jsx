import { useEffect, useState } from 'react'
import CategoryPicker from './CategoryPicker'

export default function MappingCard({ categories, isBusy, mapping, onDelete, onSave }) {
    const [category, setCategory] = useState(mapping.category || '')
    const [behavior, setBehavior] = useState(
        mapping.behavior === 'AlwaysReview' ? 'always-review' : 'auto-apply',
    )

    useEffect(() => {
        setCategory(mapping.category || '')
        setBehavior(mapping.behavior === 'AlwaysReview' ? 'always-review' : 'auto-apply')
    }, [mapping])

    async function handleSubmit(event) {
        event.preventDefault()
        await onSave({
            behavior,
            category,
            mappingId: mapping.mappingId,
            merchantKey: mapping.merchantKey,
        })
    }

    const isAlwaysReview = behavior === 'always-review'

    return (
        <article className="review-card">
            <header>
                <div>
                    <h3>{mapping.merchantKey}</h3>
                    <div className="review-meta">
                        <span>{mapping.matchingTransactions} matching expense transactions</span>
                        <span>{mapping.appliedCount} rule uses</span>
                        <span>{mapping.category || 'No fixed category'}</span>
                    </div>
                </div>
                {isAlwaysReview ? (
                    <span className="tag tag-secondary">Always ask for this merchant</span>
                ) : (
                    <span className="tag">Auto-apply mapping</span>
                )}
            </header>

            <form className="review-form mapping-form" onSubmit={handleSubmit}>
                <CategoryPicker
                    categories={categories}
                    disabled={isBusy || isAlwaysReview}
                    name="category"
                    placeholder={
                        isAlwaysReview ? 'No fixed category in always-ask mode' : 'Groceries, Transport, Salary...'
                    }
                    value={category}
                    onChange={setCategory}
                />

                <select
                    name="behavior"
                    aria-label="Mapping behavior"
                    value={behavior}
                    onChange={(event) => setBehavior(event.target.value)}
                    disabled={isBusy}
                >
                    <option value="auto-apply">Remember category for merchant</option>
                    <option value="always-review">Always ask for this merchant</option>
                </select>

                <button className="button button-secondary" type="submit" disabled={isBusy}>
                    Save mapping
                </button>
                <button
                    className="button button-ghost"
                    type="button"
                    onClick={() => onDelete({ mappingId: mapping.mappingId, merchantKey: mapping.merchantKey })}
                    disabled={isBusy}
                >
                    Delete mapping
                </button>
            </form>
        </article>
    )
}