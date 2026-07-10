import { useState } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'

export default function MappingCard({ categories, isBusy, mapping, onDelete, onSave }) {
    const [category, setCategory] = useState(mapping.category || '')
    const [behavior, setBehavior] = useState(
        mapping.behavior === 'AlwaysReview' ? 'always-review' : 'auto-apply',
    )

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
        <Paper
            elevation={0}
            component="article"
            className="review-card"
            sx={{ p: 2, mb: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2 }}
        >
            <Grid container spacing={2} sx={{ mb: 1, alignItems: 'center' }}>
                <Grid sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" component="h3">
                        {mapping.merchantKey}
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                            {mapping.matchingTransactions} matching expense transactions
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {mapping.appliedCount} rule uses
                        </Typography>
                        <Chip label={mapping.category || 'No fixed category'} size="small" color="default" variant="outlined" />
                    </Stack>
                </Grid>

                <Grid>
                    <Typography variant="caption" color={isAlwaysReview ? 'warning.main' : 'text.secondary'}>
                        {isAlwaysReview ? 'Always ask for this merchant' : 'Auto-apply mapping'}
                    </Typography>
                </Grid>
            </Grid>

            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
                <Box sx={{ flex: 1 }}>
                    <Autocomplete
                        freeSolo
                        disabled={isBusy || isAlwaysReview}
                        options={categories.map((c) => c.name)}
                        value={category}
                        onChange={(event, newValue) => setCategory(newValue || '')}
                        onInputChange={(event, newInput) => setCategory(newInput || '')}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                size="small"
                                variant="outlined"
                                placeholder={isAlwaysReview ? 'No fixed category in always-ask mode' : 'Groceries, Transport, Salary...'}
                            />
                        )}
                    />
                </Box>

                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel id={`behavior-label-${mapping.mappingId}`}>Behavior</InputLabel>
                    <Select
                        labelId={`behavior-label-${mapping.mappingId}`}
                        value={behavior}
                        label="Behavior"
                        onChange={(event) => setBehavior(event.target.value)}
                        disabled={isBusy}
                    >
                        <MenuItem value="auto-apply">Remember category for merchant</MenuItem>
                        <MenuItem value="always-review">Always ask for this merchant</MenuItem>
                    </Select>
                </FormControl>

                <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
                    <Button
                        variant="contained"
                        color="primary"
                        type="submit"
                        disabled={isBusy}
                        sx={{ boxShadow: 'none', textTransform: 'none' }}
                    >
                        Save
                    </Button>

                    <Button
                        variant="outlined"
                        color="inherit"
                        type="button"
                        onClick={() => onDelete({ mappingId: mapping.mappingId, merchantKey: mapping.merchantKey })}
                        disabled={isBusy}
                        sx={{ textTransform: 'none' }}
                    >
                        Delete
                    </Button>
                </Stack>
            </Box>
        </Paper>
    )
}