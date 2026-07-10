import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import { PAGE_SIZE_OPTIONS } from '../../lib/constants'

export default function Pagination({
    currentPage,
    itemCount,
    onPageChange,
    onPageSizeChange,
    pageCount,
    pageSize,
}) {
    if (itemCount === 0) {
        return null
    }

    const previousPage = Math.max(1, currentPage - 1)
    const nextPage = Math.min(pageCount, currentPage + 1)
    const firstItem = Math.min((currentPage - 1) * pageSize + 1, itemCount)
    const lastItem = Math.min(currentPage * pageSize, itemCount)

    return (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 2 }} className="review-pagination">
            <Typography variant="caption" className="pagination-summary">
                Showing {firstItem}-{lastItem} of {itemCount}
            </Typography>

            <FormControl size="small" sx={{ minWidth: 120 }} className="pagination-page-size">
                <Select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
                    {PAGE_SIZE_OPTIONS.map((option) => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                    ))}
                </Select>
            </FormControl>

            {pageCount > 1 ? (
                <>
                    <Button variant="outlined" onClick={() => onPageChange(previousPage)} disabled={currentPage === 1}>
                        Previous
                    </Button>
                    <Button variant="outlined" onClick={() => onPageChange(nextPage)} disabled={currentPage === pageCount}>
                        Next
                    </Button>
                </>
            ) : null}
        </Box>
    )
}