import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import EmptyState from '../shared/EmptyState'
import TrendChart from '../TrendChart'

export default function CategoryTrendSection({
    comparisonCategoryOptions,
    comparisonCycleReports,
    comparisonTrendData,
    onSelectedComparisonCategoryChange,
    selectedComparisonCategory,
    selectedCycleStart,
}) {
    return (
        <section className="panel trend-panel">
            <div className="section-heading">
                <div>
                    <p className="eyebrow">Category trend</p>
                    <h2>See one category across nearby cycles</h2>
                </div>

                <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel id="trend-category-label">Category</InputLabel>
                    <Select
                        labelId="trend-category-label"
                        value={selectedComparisonCategory}
                        label="Category"
                        onChange={(event) => onSelectedComparisonCategoryChange(event.target.value)}
                    >
                        {comparisonCategoryOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </div>

            {comparisonCycleReports.length === 0 ? (
                <EmptyState message="No cycle totals are available for the comparison chart yet." />
            ) : (
                <TrendChart comparisonTrendData={comparisonTrendData} selectedCycleStart={selectedCycleStart} />
            )}
        </section>
    )
}
