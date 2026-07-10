import EmptyState from '../shared/EmptyState'
import ComparisonPieCard from '../ComparisonPieCard'
import { buildPieSegments } from './data'

export default function ComparisonCyclesSection({ comparisonCycleReports, selectedCycleStart }) {
    return (
        <section className="panel comparison-panel">
            {comparisonCycleReports.length === 0 ? (
                <EmptyState message="Not enough cycle data is available to compare recent spending yet." />
            ) : (
                <div className="comparison-pie-grid">
                    {comparisonCycleReports.map((report) => (
                        <ComparisonPieCard
                            key={report.from}
                            report={report}
                            pieSegments={buildPieSegments(report.categories)}
                            isSelected={report.from === selectedCycleStart}
                        />
                    ))}
                </div>
            )}
        </section>
    )
}
