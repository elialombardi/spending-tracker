import { useEffect, useState } from 'react'
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

function renderImportResult(importResult) {
    if (!importResult) {
        return <EmptyState message="No workbook uploaded in this session." />
    }

    return (
        <div className="import-result-grid">
            <article className="import-stat">
                <span className="metric-label">Imported</span>
                <strong className="import-value accent">{importResult.importedTransactions}</strong>
            </article>
            <article className="import-stat">
                <span className="metric-label">Duplicates skipped</span>
                <strong className="import-value">{importResult.skippedDuplicates}</strong>
            </article>
            <article className="import-stat">
                <span className="metric-label">Auto-categorized</span>
                <strong className="import-value secondary">{importResult.autoCategorizedTransactions}</strong>
            </article>
            <article className="import-stat">
                <span className="metric-label">Need review</span>
                <strong className="import-value">{importResult.reviewTransactions}</strong>
            </article>
        </div>
    )
}

export default function ImportTab({
    active,
    categories,
    categorizedExpenses,
    categorizedPage,
    categorizedPageSize,
    cycleIncomeCategories,
    categoryMappings,
    incomePage,
    incomePageSize,
    incomeTransactions,
    importResult,
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
    onUpload,
}) {
    const [selectedFile, setSelectedFile] = useState(null)
    const [inputKey, setInputKey] = useState(0)
    const [activeManagementTab, setActiveManagementTab] = useState('corrections')
    const [draftCycleIncomeCategories, setDraftCycleIncomeCategories] = useState([])
    const [customCycleIncomeCategory, setCustomCycleIncomeCategory] = useState('')
    const correctionsPageCount = Math.max(1, Math.ceil(categorizedExpenses.length / categorizedPageSize))
    const currentCorrectionsPage = Math.min(categorizedPage, correctionsPageCount)
    const correctionsStart = (currentCorrectionsPage - 1) * categorizedPageSize
    const correctionsItems = categorizedExpenses.slice(
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
        ...draftCycleIncomeCategories
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

    useEffect(() => {
        setDraftCycleIncomeCategories(
            cycleIncomeCategories.categories
                .filter((category) => category.definesCycle)
                .map((category) => category.name),
        )
    }, [cycleIncomeCategories])

    async function handleSubmit(event) {
        event.preventDefault()
        const success = await onUpload(selectedFile)

        if (success) {
            setSelectedFile(null)
            setInputKey((currentKey) => currentKey + 1)
        }
    }

    async function handleCycleIncomeCategoriesSave() {
        await onSaveCycleIncomeCategories(draftCycleIncomeCategories)
    }

    function handleCycleIncomeCategoryToggle(categoryName) {
        setDraftCycleIncomeCategories((currentCategories) => {
            if (currentCategories.some((currentCategory) => isSameCycleIncomeCategory(currentCategory, categoryName))) {
                return currentCategories.filter(
                    (currentCategory) => !isSameCycleIncomeCategory(currentCategory, categoryName),
                )
            }

            return [...currentCategories, normalizeCycleIncomeCategoryName(categoryName)].sort((left, right) =>
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
            if (currentCategories.some((currentCategory) => isSameCycleIncomeCategory(currentCategory, normalizedCategoryName))) {
                return currentCategories
            }

            return [...currentCategories, normalizedCategoryName].sort((left, right) => left.localeCompare(right))
        })
        setCustomCycleIncomeCategory('')
    }

    return (
        <section
            id="page-import"
            className={`tab-page${active ? ' is-active' : ''}`}
            role="tabpanel"
            aria-labelledby="tab-import"
            hidden={!active}
        >
            <div className="layout">
                <section className="panel upload-panel">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Import</p>
                            <h2>Bring in the latest workbook</h2>
                        </div>
                        <p className="section-note">
                            Repeated uploads are safe. Existing rows are matched with a synthetic
                            fingerprint and skipped.
                        </p>
                    </div>

                    <form className="upload-form" onSubmit={handleSubmit}>
                        <label className="upload-dropzone" htmlFor="workbook-file">
                            <input
                                key={inputKey}
                                id="workbook-file"
                                name="file"
                                type="file"
                                accept=".xlsx"
                                required
                                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                            />
                            <span className="upload-title">Drop a Poste Italiane `.xlsx` export here</span>
                            <span className="upload-subtitle">
                                {selectedFile?.name || 'or click to choose the workbook you just downloaded'}
                            </span>
                        </label>

                        <button
                            className="button button-primary button-wide"
                            type="submit"
                            disabled={isBusy || !selectedFile}
                        >
                            Import workbook
                        </button>
                    </form>

                    <div className="import-result">{renderImportResult(importResult)}</div>
                </section>

                <section className="panel management-panel">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">Manage imports</p>
                            <h2>Review categories and merchant rules</h2>
                        </div>
                        <p className="section-note">
                            Switch between one-off category corrections, reusable merchant mappings,
                            and cycle-start settings without leaving the import workspace.
                        </p>
                    </div>

                    <div className="panel panel-tabs compact-tabs" role="tablist" aria-label="Import management tabs">
                        {MANAGEMENT_TABS.map((tab) => {
                            const isActive = activeManagementTab === tab.id
                            const count = tab.id === 'corrections'
                                ? categorizedExpenses.length
                                : tab.id === 'mappings'
                                    ? categoryMappings.length
                                    : selectedCycleIncomeCategoryCount

                            return (
                                <button
                                    key={tab.id}
                                    id={`import-tab-${tab.id}`}
                                    className={`tab-button${isActive ? ' is-active' : ''}`}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    aria-controls={`import-panel-${tab.id}`}
                                    onClick={() => setActiveManagementTab(tab.id)}
                                >
                                    <span className="tab-button-title">{tab.title}</span>
                                    <span className="tab-button-note">{tab.note}</span>
                                    <span className="tab-count">{count}</span>
                                </button>
                            )
                        })}
                    </div>

                    <div
                        id="import-panel-corrections"
                        className={`tab-page${activeManagementTab === 'corrections' ? ' is-active' : ''}`}
                        role="tabpanel"
                        aria-labelledby="import-tab-corrections"
                        hidden={activeManagementTab !== 'corrections'}
                    >
                        <div className="management-section-header">
                            <p className="eyebrow">Corrections</p>
                            <h3>Fix an existing category</h3>
                            <p className="section-note">
                                Correct automatic or manual categories here. Use “Only this transaction” for a
                                one-off mistake, or “Remember category for this description” to rewrite the reusable
                                rule.
                            </p>
                        </div>

                        {categorizedExpenses.length === 0 ? (
                            <EmptyState message="No categorized expenses in this cycle yet." />
                        ) : (
                            <>
                                <div className="review-queue">
                                    {correctionsItems.map((transaction) => (
                                        <CategoryAssignmentCard
                                            categories={categories}
                                            key={transaction.transactionId}
                                            context="edit"
                                            isBusy={isBusy}
                                            onSave={onCategorize}
                                            transaction={transaction}
                                        />
                                    ))}
                                </div>

                                <Pagination
                                    currentPage={currentCorrectionsPage}
                                    itemCount={categorizedExpenses.length}
                                    onPageChange={onCategorizedPageChange}
                                    onPageSizeChange={onCategorizedPageSizeChange}
                                    pageCount={correctionsPageCount}
                                    pageSize={categorizedPageSize}
                                />
                            </>
                        )}
                    </div>

                    <div
                        id="import-panel-mappings"
                        className={`tab-page${activeManagementTab === 'mappings' ? ' is-active' : ''}`}
                        role="tabpanel"
                        aria-labelledby="import-tab-mappings"
                        hidden={activeManagementTab !== 'mappings'}
                    >
                        <div className="management-section-header">
                            <p className="eyebrow">Mappings</p>
                            <h3>Manage category mappings</h3>
                            <p className="section-note">
                                Review the reusable merchant rules directly here. Save updates to change the
                                mapping, or delete a mapping to stop auto-applying it on future imports.
                            </p>
                        </div>

                        {categoryMappings.length === 0 ? (
                            <EmptyState message="No reusable merchant mappings saved yet." />
                        ) : (
                            <>
                                <div className="review-queue">
                                    {mappingsItems.map((mapping) => (
                                        <MappingCard
                                            categories={categories}
                                            key={mapping.mappingId}
                                            isBusy={isBusy}
                                            mapping={mapping}
                                            onDelete={onDeleteMapping}
                                            onSave={onSaveMapping}
                                        />
                                    ))}
                                </div>

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
                    </div>

                    <div
                        id="import-panel-cycle-income"
                        className={`tab-page${activeManagementTab === 'cycle-income' ? ' is-active' : ''}`}
                        role="tabpanel"
                        aria-labelledby="import-tab-cycle-income"
                        hidden={activeManagementTab !== 'cycle-income'}
                    >
                        <div className="management-section-header">
                            <p className="eyebrow">Cycle starts</p>
                            <h3>Choose which income categories define a cycle</h3>
                            <p className="section-note">
                                A cycle starts only when an incoming transaction matches one of the
                                categories saved here. Leave the list empty to keep using every income.
                            </p>
                        </div>

                        <div className="cycle-income-settings">
                            <div className="cycle-income-summary">
                                <span className="tag tag-secondary">
                                    {cycleIncomeCategories.usesAllIncomeTransactions
                                        ? 'All income transactions currently define cycles'
                                        : `${selectedCycleIncomeCategoryCount} income categories define cycles`}
                                </span>
                                <p className="section-note">
                                    Incoming payments must be categorized with one of these names before
                                    they can anchor a cycle.
                                </p>
                            </div>

                            <form className="cycle-income-add-form" onSubmit={handleCustomCycleIncomeCategoryAdd}>
                                <input
                                    type="text"
                                    name="cycleIncomeCategory"
                                    placeholder="Salary, Pension, Freelance..."
                                    value={customCycleIncomeCategory}
                                    onChange={(event) => setCustomCycleIncomeCategory(event.target.value)}
                                    disabled={isBusy}
                                />
                                <button className="button button-secondary" type="submit" disabled={isBusy}>
                                    Add category
                                </button>
                            </form>

                            {displayedCycleIncomeCategories.length === 0 ? (
                                <EmptyState message="No income categories are available yet. Add one above, then save it here." />
                            ) : (
                                <div className="cycle-income-category-list">
                                    {displayedCycleIncomeCategories.map((category) => {
                                        const checked = draftCycleIncomeCategories.some((currentCategory) =>
                                            isSameCycleIncomeCategory(currentCategory, category.name),
                                        )

                                        return (
                                            <label key={category.name} className="cycle-income-category-option">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => handleCycleIncomeCategoryToggle(category.name)}
                                                    disabled={isBusy}
                                                />
                                                <span>
                                                    <strong>{category.name}</strong>
                                                    <span className="cycle-income-category-meta">
                                                        <span>
                                                            {category.incomeTransactions} income payment
                                                            {category.incomeTransactions === 1 ? '' : 's'}
                                                        </span>
                                                        {category.isDraftOnly ? <span>Custom</span> : null}
                                                    </span>
                                                </span>
                                            </label>
                                        )
                                    })}
                                </div>
                            )}

                            <div className="button-row">
                                <button
                                    className="button button-primary"
                                    type="button"
                                    onClick={handleCycleIncomeCategoriesSave}
                                    disabled={isBusy}
                                >
                                    Save cycle categories
                                </button>
                            </div>

                            <div className="management-section-header">
                                <p className="eyebrow">Attach categories</p>
                                <h3>Select the incomes that belong to those categories</h3>
                                <p className="section-note">
                                    Assign an income category here. Once a transaction uses a category selected
                                    above, it can become a valid cycle start.
                                </p>
                            </div>

                            {incomeTransactions.length === 0 ? (
                                <EmptyState message="No incoming transactions are available yet." />
                            ) : (
                                <>
                                    <div className="review-queue">
                                        {incomeItems.map((transaction) => (
                                            <CategoryAssignmentCard
                                                categories={categories}
                                                key={transaction.transactionId}
                                                context="edit"
                                                isBusy={isBusy}
                                                onSave={onCategorize}
                                                transaction={transaction}
                                            />
                                        ))}
                                    </div>

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
                        </div>
                    </div>
                </section>
            </div>
        </section>
    )
}