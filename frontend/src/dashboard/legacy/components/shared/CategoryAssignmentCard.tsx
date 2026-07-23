import { useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import SaveIcon from '@mui/icons-material/Save'
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
    const [excludeFromCalculations, setExcludeFromCalculations] = useState(Boolean(transaction.excludeFromCalculations))
    const [isMonthlyRecurring, setIsMonthlyRecurring] = useState(Boolean(transaction.isMonthlyRecurring))

    async function handleSubmit(event) {
        event.preventDefault()
        await onSave({
            transactionId: transaction.transactionId,
            category,
            formContext: context,
            ruleMode,
            excludeFromCalculations,
            isMonthlyRecurring,
        })
    }

    const suggestion = transaction.suggestedCategory ? (
        <Typography variant="caption" color="text.secondary">
            Suggestion: {transaction.suggestedCategory}
            {transaction.suggestionConfidence ? ` (${formatPercent(transaction.suggestionConfidence)})` : ''}
        </Typography>
    ) : (
        <Typography variant="caption">Needs a manual category</Typography>
    )

    const isAlwaysReview = transaction.merchantRuleBehavior === 'AlwaysReview'
    const ruleBadge = isAlwaysReview ? (
        <Typography variant="caption" color="warning.main">
            Always ask for this description
        </Typography>
    ) : (
        <Typography variant="caption" color="text.secondary">
            {context === 'review' ? 'Can use a reusable description rule' : 'Reusable description rule available'}
        </Typography>
    )

    return (
        <Paper elevation={0} sx={{ p: 2, mb: 2 }} component="article" className="review-card">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Box>
                    <Typography variant="subtitle1" component="h3">
                        {transaction.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }} className="review-meta">
                        <Typography variant="caption">{formatDate(transaction.bookingDate)}</Typography>
                        <Typography variant="caption">{transaction.merchantKey}</Typography>
                        {context === 'edit' ? <Typography variant="caption">{transaction.category || 'Uncategorized'}</Typography> : null}
                        {transaction.isMonthlyRecurring ? <Typography variant="caption">Monthly recurring</Typography> : null}
                    </Box>
                </Box>

                <Typography variant="subtitle2">{formatMoney(Math.abs(transaction.amount))}</Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mb: 1 }} className="merchant-meta">
                {context === 'review' ? suggestion : null}
                {ruleBadge}
            </Box>

            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 0', minWidth: 220 }}>
                    <CategoryPicker
                        categories={categories}
                        disabled={isBusy}
                        name="category"
                        placeholder="Groceries, Transport, Salary..."
                        value={category}
                        onChange={setCategory}
                    />
                </Box>

                <FormControl size="small" sx={{ minWidth: 180, flex: '0 0 260px' }}>
                    <InputLabel id={`rulemode-label-${transaction.transactionId}`}>Rule</InputLabel>
                    <Select
                        labelId={`rulemode-label-${transaction.transactionId}`}
                        value={ruleMode}
                        label="Rule"
                        onChange={(event) => setRuleMode(event.target.value)}
                        disabled={isBusy}
                    >
                        <MenuItem value="auto-apply">Remember category for this description</MenuItem>
                        <MenuItem value="always-review">Always ask for this description</MenuItem>
                        <MenuItem value="one-off">Only this transaction</MenuItem>
                    </Select>
                </FormControl>

                <Button
                    variant="contained"
                    type="submit"
                    disabled={isBusy}
                    sx={{ ml: 'auto', flex: '0 0 auto' }}
                    aria-label={context === 'edit' ? 'Update category' : 'Save category'}
                >
                    <SaveIcon />
                </Button>

                <Box sx={{ flex: '1 1 100%', display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={excludeFromCalculations}
                                onChange={(event) => setExcludeFromCalculations(event.target.checked)}
                                disabled={isBusy}
                            />
                        }
                        label="Exclude from calculations"
                    />

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={isMonthlyRecurring}
                                onChange={(event) => setIsMonthlyRecurring(event.target.checked)}
                                disabled={isBusy}
                            />
                        }
                        label="Monthly recurring"
                    />
                </Box>
            </Box>
        </Paper>
    )
}
