import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CategoryAssignmentCard from './shared/CategoryAssignmentCard'
import EmptyState from './shared/EmptyState'
import MappingCard from './shared/MappingCard'
import Pagination from './shared/Pagination'

const MANAGEMENT_TABS = [
    {
        id: 'corrections',
        title: 'Fix an existing category',
        note: 'Correct automatic or manual expense categories.',
    },
    {
        id: 'mappings',
        title: 'Manage category mappings',
        note: 'Adjust reusable merchant rules and their behavior.',
    },
    {
        id: 'cycle-income',
        title: 'Cycle-defining incomes',
        note: 'Choose which income categories start a cycle.',
    },
]

function normalizeCycleIncomeCategoryName(categoryName) {
    return categoryName.trim().replace(/\s+/g, ' ')
}

function isSameCycleIncomeCategory(left, right) {
    return normalizeCycleIncomeCategoryName(left).toLowerCase() === normalizeCycleIncomeCategoryName(right).toLowerCase()
}

function sortCycleIncomeCategories(categories) {
    return [...categories].sort((left, right) => {
        if (left.definesCycle !== right.definesCycle) {
            return left.definesCycle ? -1 : 1
        }

        return left.name.localeCompare(right.name)
    })
}

export default function ImportManagementPanel({
    canWrite,
    categories,
    categorizedExpenses,
    categorizedPage,
    categorizedPageSize,
    cycleIncomeCategories,
    categoryMappings,
    incomePage,
    incomePageSize,
    incomeTransactions,
    isBusy,
    mappingsPage,
    mappingsPageSize,
    onCategorize,
    onCategorizedPageChange,
    onCategorizedPageSizeChange,
    onDeleteMapping,
    onIncomePageChange,
    onIncomePageSizeChange,
    onMappingsPageChange,
    onMappingsPageSizeChange,
    onSaveMapping,
    onSaveCycleIncomeCategories,
}) {
    const [activeManagementTab, setActiveManagementTab] = useState('corrections')
    const [draftCycleIncomeCategories, setDraftCycleIncomeCategories] = useState(null)
    const [customCycleIncomeCategory, setCustomCycleIncomeCategory] = useState('')
    const persistedCycleIncomeCategories = cycleIncomeCategories.categories
        .filter((category) => category.definesCycle)
        .map((category) => category.name)
    const activeDraftCycleIncomeCategories = draftCycleIncomeCategories ?? persistedCycleIncomeCategories
    const sortedCategorizedExpenses = [...categorizedExpenses].sort(
        (left, right) => Math.abs(right.amount) - Math.abs(left.amount),
    )
    const correctionsPageCount = Math.max(1, Math.ceil(sortedCategorizedExpenses.length / categorizedPageSize))
    const currentCorrectionsPage = Math.min(categorizedPage, correctionsPageCount)
    const correctionsStart = (currentCorrectionsPage - 1) * categorizedPageSize
    const correctionsItems = sortedCategorizedExpenses.slice(
        correctionsStart,
        correctionsStart + categorizedPageSize,
    )
    const mappingsPageCount = Math.max(1, Math.ceil(categoryMappings.length / mappingsPageSize))
    const currentMappingsPage = Math.min(mappingsPage, mappingsPageCount)
    const mappingsStart = (currentMappingsPage - 1) * mappingsPageSize
    const mappingsItems = categoryMappings.slice(mappingsStart, mappingsStart + mappingsPageSize)
    const incomePageCount = Math.max(1, Math.ceil(incomeTransactions.length / incomePageSize))
    const currentIncomePage = Math.min(incomePage, incomePageCount)
    const incomeStart = (currentIncomePage - 1) * incomePageSize
    const incomeItems = incomeTransactions.slice(incomeStart, incomeStart + incomePageSize)
    const selectedCycleIncomeCategoryCount = cycleIncomeCategories.categories.filter(
        (category) => category.definesCycle,
    ).length
    const displayedCycleIncomeCategories = sortCycleIncomeCategories([
        ...cycleIncomeCategories.categories,
        ...activeDraftCycleIncomeCategories
            .filter(
                (categoryName) =>
                    !cycleIncomeCategories.categories.some((category) =>
                        isSameCycleIncomeCategory(category.name, categoryName),
                    ),
            )
            .map((categoryName) => ({
                name: categoryName,
                incomeTransactions: 0,
                definesCycle: true,
                isDraftOnly: true,
            })),
    ])

    async function handleCycleIncomeCategoriesSave() {
        const saved = await onSaveCycleIncomeCategories(activeDraftCycleIncomeCategories)
        if (saved) {
            setDraftCycleIncomeCategories(null)
        }
    }

    function handleCycleIncomeCategoryToggle(categoryName) {
        setDraftCycleIncomeCategories((currentCategories) => {
            const nextCategories = currentCategories ?? activeDraftCycleIncomeCategories

            if (nextCategories.some((currentCategory) => isSameCycleIncomeCategory(currentCategory, categoryName))) {
                return nextCategories.filter(
                    (currentCategory) => !isSameCycleIncomeCategory(currentCategory, categoryName),
                )
            }

            return [...nextCategories, normalizeCycleIncomeCategoryName(categoryName)].sort((left, right) =>
                left.localeCompare(right),
            )
        })
    }

    function handleCustomCycleIncomeCategoryAdd(event) {
        event.preventDefault()

        const normalizedCategoryName = normalizeCycleIncomeCategoryName(customCycleIncomeCategory)
        if (!normalizedCategoryName) {
            return
        }

        setDraftCycleIncomeCategories((currentCategories) => {
            const nextCategories = currentCategories ?? activeDraftCycleIncomeCategories

            if (nextCategories.some((currentCategory) => isSameCycleIncomeCategory(currentCategory, normalizedCategoryName))) {
                return nextCategories
            }

            return [...nextCategories, normalizedCategoryName].sort((left, right) => left.localeCompare(right))
        })
        setCustomCycleIncomeCategory('')
    }

    return (
        <Paper sx={{ p: 2 }} elevation={0} className="management-panel">
            <Box sx={{ mb: 2 }}>
                <Typography variant="overline">Manage imports</Typography>
                <Typography variant="h5">Review categories and merchant rules</Typography>
                <Typography variant="body2" color="text.secondary">
                    Switch between one-off category corrections, reusable merchant mappings,
                    and cycle-start settings without leaving the import workspace.
                </Typography>
            </Box>

            {!canWrite ? (
                <Alert severity="info">
                    This workspace is read-only for your current role. Category corrections, mappings, and cycle-income settings are hidden until you sign in as Writer or Admin.
                </Alert>
            ) : null}

            {canWrite ? <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 2 }} role="tablist" aria-label="Import management tabs">
                {MANAGEMENT_TABS.map((tab) => {
                    const isActive = activeManagementTab === tab.id
                    const count = tab.id === 'corrections'
                        ? sortedCategorizedExpenses.length
                        : tab.id === 'mappings'
                            ? categoryMappings.length
                            : selectedCycleIncomeCategoryCount

                    return (
                        <Button
                            key={tab.id}
                            variant={isActive ? 'contained' : 'outlined'}
                            onClick={() => setActiveManagementTab(tab.id)}
                            aria-controls={`import-panel-${tab.id}`}
                        >
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{tab.title}</Typography>
                                <Typography variant="caption" color="text.secondary">{tab.note}</Typography>
                            </Box>
                            <Box sx={{ ml: 1 }}>{count}</Box>
                        </Button>
                    )
                })}
            </Stack> : null}

            <Box
                id="import-panel-corrections"
                role="tabpanel"
                aria-labelledby="import-tab-corrections"
                hidden={!canWrite || activeManagementTab !== 'corrections'}
            >
                <Box sx={{ mb: 1 }}>
                    <Typography variant="overline">Corrections</Typography>
                    <Typography variant="h6">Fix an existing category</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Correct automatic or manual categories here. Use “Only this transaction” for a
                        one-off mistake, or “Remember category for this description” to rewrite the reusable
                        rule.
                    </Typography>
                </Box>

                {sortedCategorizedExpenses.length === 0 ? (
                    <EmptyState message="No categorized expenses in this cycle yet." />
                ) : (
                    <>
                        <Box className="review-queue">
                            {correctionsItems.map((transaction) => (
                                <CategoryAssignmentCard
                                    categories={categories}
                                    key={`${transaction.transactionId}-${transaction.category || ''}-${transaction.suggestedCategory || ''}-${transaction.merchantRuleBehavior || ''}-${transaction.excludeFromCalculations ? '1' : '0'}-${transaction.isMonthlyRecurring ? '1' : '0'}`}
                                    context="edit"
                                    isBusy={isBusy}
                                    onSave={onCategorize}
                                    transaction={transaction}
                                />
                            ))}
                        </Box>

                        <Pagination
                            currentPage={currentCorrectionsPage}
                            itemCount={sortedCategorizedExpenses.length}
                            onPageChange={onCategorizedPageChange}
                            onPageSizeChange={onCategorizedPageSizeChange}
                            pageCount={correctionsPageCount}
                            pageSize={categorizedPageSize}
                        />
                    </>
                )}
            </Box>

            <Box
                id="import-panel-mappings"
                role="tabpanel"
                aria-labelledby="import-tab-mappings"
                hidden={!canWrite || activeManagementTab !== 'mappings'}
            >
                <Box sx={{ mb: 1 }}>
                    <Typography variant="overline">Mappings</Typography>
                    <Typography variant="h6">Manage category mappings</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Review the reusable merchant rules directly here. Save updates to change the
                        mapping, or delete a mapping to stop auto-applying it on future imports.
                    </Typography>
                </Box>

                {categoryMappings.length === 0 ? (
                    <EmptyState message="No reusable merchant mappings saved yet." />
                ) : (
                    <>
                        <Box className="review-queue">
                            {mappingsItems.map((mapping) => (
                                <MappingCard
                                    categories={categories}
                                    key={`${mapping.mappingId}-${mapping.category || ''}-${mapping.behavior || ''}`}
                                    isBusy={isBusy}
                                    mapping={mapping}
                                    onDelete={onDeleteMapping}
                                    onSave={onSaveMapping}
                                />
                            ))}
                        </Box>

                        <Pagination
                            currentPage={currentMappingsPage}
                            itemCount={categoryMappings.length}
                            onPageChange={onMappingsPageChange}
                            onPageSizeChange={onMappingsPageSizeChange}
                            pageCount={mappingsPageCount}
                            pageSize={mappingsPageSize}
                        />
                    </>
                )}
            </Box>

            <Box
                id="import-panel-cycle-income"
                role="tabpanel"
                aria-labelledby="import-tab-cycle-income"
                hidden={!canWrite || activeManagementTab !== 'cycle-income'}
            >
                <Box sx={{ mb: 1 }}>
                    <Typography variant="overline">Cycle starts</Typography>
                    <Typography variant="h6">Choose which income categories define a cycle</Typography>
                    <Typography variant="body2" color="text.secondary">
                        A cycle starts only when an incoming transaction matches one of the
                        categories saved here. Leave the list empty to keep using every income.
                    </Typography>
                </Box>

                <Box sx={{ mb: 2 }} className="cycle-income-settings">
                    <Box sx={{ mb: 1 }} className="cycle-income-summary">
                        <Typography variant="caption" color="text.secondary">
                            {cycleIncomeCategories.usesAllIncomeTransactions
                                ? 'All income transactions currently define cycles'
                                : `${selectedCycleIncomeCategoryCount} income categories define cycles`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Incoming payments must be categorized with one of these names before
                            they can anchor a cycle.
                        </Typography>
                    </Box>

                    <Box component="form" onSubmit={handleCustomCycleIncomeCategoryAdd} sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <TextField
                            name="cycleIncomeCategory"
                            placeholder="Salary, Pension, Freelance..."
                            value={customCycleIncomeCategory}
                            onChange={(event) => setCustomCycleIncomeCategory(event.target.value)}
                            disabled={isBusy}
                            size="small"
                        />
                        <Button variant="outlined" type="submit" disabled={isBusy}>
                            Add category
                        </Button>
                    </Box>

                    {displayedCycleIncomeCategories.length === 0 ? (
                        <EmptyState message="No income categories are available yet. Add one above, then save it here." />
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} className="cycle-income-category-list">
                            {displayedCycleIncomeCategories.map((category) => {
                                const checked = activeDraftCycleIncomeCategories.some((currentCategory) =>
                                    isSameCycleIncomeCategory(currentCategory, category.name),
                                )

                                return (
                                    <FormControlLabel
                                        key={category.name}
                                        control={<Checkbox checked={checked} onChange={() => handleCycleIncomeCategoryToggle(category.name)} disabled={isBusy} />}
                                        label={
                                            <Box>
                                                <strong>{category.name}</strong>
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                    {category.incomeTransactions} income payment{category.incomeTransactions === 1 ? '' : 's'} {category.isDraftOnly ? ' • Custom' : ''}
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                )
                            })}
                        </Box>
                    )}

                    <Box sx={{ mt: 1 }} className="button-row">
                        <Button variant="contained" onClick={handleCycleIncomeCategoriesSave} disabled={isBusy}>
                            Save cycle categories
                        </Button>
                    </Box>

                    <Box sx={{ mt: 2 }}>
                        <Typography variant="overline">Attach categories</Typography>
                        <Typography variant="h6">Select the incomes that belong to those categories</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Assign an income category here. Once a transaction uses a category selected
                            above, it can become a valid cycle start.
                        </Typography>
                    </Box>

                    {incomeTransactions.length === 0 ? (
                        <EmptyState message="No incoming transactions are available yet." />
                    ) : (
                        <>
                            <Box className="review-queue">
                                {incomeItems.map((transaction) => (
                                    <CategoryAssignmentCard
                                        categories={categories}
                                        key={`${transaction.transactionId}-${transaction.category || ''}-${transaction.suggestedCategory || ''}-${transaction.merchantRuleBehavior || ''}-${transaction.excludeFromCalculations ? '1' : '0'}-${transaction.isMonthlyRecurring ? '1' : '0'}`}
                                        context="edit"
                                        isBusy={isBusy}
                                        onSave={onCategorize}
                                        transaction={transaction}
                                    />
                                ))}
                            </Box>

                            <Pagination
                                currentPage={currentIncomePage}
                                itemCount={incomeTransactions.length}
                                onPageChange={onIncomePageChange}
                                onPageSizeChange={onIncomePageSizeChange}
                                pageCount={incomePageCount}
                                pageSize={incomePageSize}
                            />
                        </>
                    )}
                </Box>
            </Box>
        </Paper>
    )
}