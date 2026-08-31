import { formatDate } from '../../lib/formatters'
import CategoryBreakdown from '../CategoryBreakdown'

export default function CategoryBreakdownSection({
    monthlyReport,
    previousCycleCategorySpend,
    previousCycleComparison,
}) {
    return (
        <section className="panel categories-panel">
            <div className="section-heading">
                <div>
                    <h2>Where the money is going</h2>
                </div>
                {previousCycleComparison ? (
                    <p className="section-note">
                        Previous cycle values are matched through {formatDate(previousCycleComparison.comparableTo)}.
                    </p>
                ) : null}
            </div>

            <CategoryBreakdown
                monthlyReport={monthlyReport}
                previousCycleComparison={previousCycleComparison}
                previousCycleCategorySpend={previousCycleCategorySpend}
            />
        </section>
    )
}
