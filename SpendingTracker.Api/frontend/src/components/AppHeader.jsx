import { formatCycleOptionLabel, formatMoney, formatReportRange } from '../lib/formatters'

export default function AppHeader({
    cycleOptions,
    hasNextCycle,
    hasPreviousCycle,
    isBusy,
    monthlyReport,
    onCycleStartChange,
    onExport,
    onNextCycle,
    onPreviousCycle,
    onRefresh,
    selectedCycleStart,
}) {
    return (
        <header className="hero shell">
            <section className="hero-copy panel panel-hero">
                <p className="eyebrow">Poste Italiane spending desk</p>
                <h1>See where the pay cycle is leaking money.</h1>
                <p className="hero-text">
                    Upload the latest workbook, review uncertain merchants, teach the tracker new
                    categories, and export a clean spending-cycle report in one place.
                </p>
            </section>

            <section className="hero-actions panel panel-hero panel-actions">
                <div className="cycle-picker-row">
                    <button
                        className="button button-ghost cycle-nav-button"
                        type="button"
                        onClick={onPreviousCycle}
                        disabled={isBusy || !hasPreviousCycle}
                    >
                        Previous
                    </button>

                    <label className="field field-compact cycle-picker-field">
                        <span>Cycle starts on</span>
                        <select
                            id="cycle-start-picker"
                            value={selectedCycleStart}
                            onChange={(event) => onCycleStartChange(event.target.value)}
                            disabled={isBusy || cycleOptions.length === 0}
                        >
                            {cycleOptions.length === 0 ? (
                                <option value="">No cycles available</option>
                            ) : (
                                cycleOptions.map((cycleOption) => (
                                    <option key={cycleOption.from} value={cycleOption.from}>
                                        {formatCycleOptionLabel(cycleOption)}
                                    </option>
                                ))
                            )}
                        </select>
                    </label>

                    <button
                        className="button button-ghost cycle-nav-button"
                        type="button"
                        onClick={onNextCycle}
                        disabled={isBusy || !hasNextCycle}
                    >
                        Next
                    </button>
                </div>

                {monthlyReport ? (
                    <p className="hero-cycle-summary">
                        {formatReportRange(monthlyReport)}. {monthlyReport.categories.length} categories,{' '}
                        {formatMoney(monthlyReport.uncategorizedSpent)} still uncategorized.
                    </p>
                ) : null}

                <div className="button-row hero-button-row">
                    <button className="button button-ghost" type="button" onClick={onRefresh} disabled={isBusy}>
                        Refresh
                    </button>
                    <button
                        className="button button-primary"
                        type="button"
                        onClick={() => onExport('csv')}
                        disabled={isBusy}
                    >
                        Export CSV
                    </button>
                    <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => onExport('xlsx')}
                        disabled={isBusy}
                    >
                        Export Excel
                    </button>
                </div>
            </section>
        </header>
    )
}