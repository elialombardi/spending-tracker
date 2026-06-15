import { useEffect, useState } from 'react'
import { formatDate, formatMoney, formatPercent } from '../../lib/formatters'
import CategoryPicker from './CategoryPicker'

function getDefaultCategory(transaction, context) {
    return context === 'review' ? transaction.suggestedCategory || '' : transaction.category || ''
}

function getDefaultRuleMode(transaction, context) {
    if (context === 'review') {
        return transaction.merchantRuleBehavior === 'AlwaysReview' ? 'always-review' : 'auto-apply'
    }

    return transaction.merchantRuleBehavior === 'AlwaysReview' ? 'always-review' : 'one-off'
}

export default function CategoryAssignmentCard({ categories, context, isBusy, onSave, transaction }) {
    const [category, setCategory] = useState(getDefaultCategory(transaction, context))
    const [ruleMode, setRuleMode] = useState(getDefaultRuleMode(transaction, context))

    useEffect(() => {
        setCategory(getDefaultCategory(transaction, context))
        setRuleMode(getDefaultRuleMode(transaction, context))
    }, [context, transaction])

    async function handleSubmit(event) {
        event.preventDefault()
        await onSave({
            transactionId: transaction.transactionId,
            category,
            formContext: context,
            ruleMode,
        })
    }

    const suggestion = transaction.suggestedCategory ? (
        <span className="tag tag-secondary">
            Suggestion: {transaction.suggestedCategory}
            {transaction.suggestionConfidence ? ` (${formatPercent(transaction.suggestionConfidence)})` : ''}
        </span>
    ) : (
        <span className="tag">Needs a manual category</span>
    )

    const isAlwaysReview = transaction.merchantRuleBehavior === 'AlwaysReview'
    const ruleBadge = isAlwaysReview ? (
        <span className="tag tag-secondary">Always ask for this description</span>
    ) : (
        <span className="tag">
            {context === 'review'
                ? 'Can use a reusable description rule'
                : 'Reusable description rule available'}
        </span>
    )

    return (
        <article className="review-card">
            <header>
                <div>
                    <h3>{transaction.description}</h3>
                    <div className="review-meta">
                        <span>{formatDate(transaction.bookingDate)}</span>
                        <span>{transaction.merchantKey}</span>
                        {context === 'edit' ? <span>{transaction.category || 'Uncategorized'}</span> : null}
                    </div>
                </div>
                <span className="money-pill">{formatMoney(Math.abs(transaction.amount))}</span>
            </header>

            <div className="merchant-meta">
                {context === 'review' ? suggestion : null}
                {ruleBadge}
            </div>

            <form className="review-form" onSubmit={handleSubmit}>
                <CategoryPicker
                    categories={categories}
                    disabled={isBusy}
                    name="category"
                    placeholder="Groceries, Transport, Salary..."
                    value={category}
                    onChange={setCategory}
                />

                <select
                    name="ruleMode"
                    aria-label="Merchant rule behavior"
                    value={ruleMode}
                    onChange={(event) => setRuleMode(event.target.value)}
                    disabled={isBusy}
                >
                    <option value="auto-apply">Remember category for this description</option>
                    <option value="always-review">Always ask for this description</option>
                    <option value="one-off">Only this transaction</option>
                </select>

                <button className="button button-secondary" type="submit" disabled={isBusy}>
                    {context === 'edit' ? 'Update category' : 'Save category'}
                </button>
            </form>
        </article>
    )
}