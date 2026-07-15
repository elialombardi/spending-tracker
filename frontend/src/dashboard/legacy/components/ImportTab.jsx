import { useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemText from '@mui/material/ListItemText'
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction'
import IconButton from '@mui/material/IconButton'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import BlockIcon from '@mui/icons-material/Block'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import RateReviewIcon from '@mui/icons-material/RateReview'
import EmptyState from './shared/EmptyState'

function renderImportResult(importResult) {
    if (!importResult) {
        return <EmptyState message="No workbook uploaded in this session." />
    }

    const imported = importResult.importedTransactions ?? 0
    const skipped = importResult.skippedDuplicates ?? 0
    const autoCat = importResult.autoCategorizedTransactions ?? 0
    const review = importResult.reviewTransactions ?? 0
    const total = imported + skipped + autoCat + review || 1

    const stats = [
        { key: 'imported', label: 'Imported', value: imported, color: 'primary', icon: <CheckCircleIcon /> },
        { key: 'skipped', label: 'Duplicates skipped', value: skipped, color: 'default', icon: <BlockIcon /> },
        { key: 'auto', label: 'Auto-categorized', value: autoCat, color: 'success', icon: <AutoFixHighIcon /> },
        { key: 'review', label: 'Need review', value: review, color: 'warning', icon: <RateReviewIcon /> },
    ]

    return (
        <Grid container spacing={2} alignItems="stretch">
            {stats.map((stat) => (
                <Grid item xs={12} sm={6} md={3} key={stat.key}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardHeader
                            avatar={<Avatar sx={{ bgcolor: (theme) => theme.palette[stat.color]?.main ?? theme.palette.primary.main }}>{stat.icon}</Avatar>}
                            title={<Typography variant="subtitle2">{stat.label}</Typography>}
                            subheader={<Chip label={`${Math.round((stat.value / total) * 100)}%`} size="small" />}
                        />
                        <Divider />
                        <CardContent>
                            <Typography variant="h4" component="div">{stat.value}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
            ))}

            {Array.isArray(importResult.reviewQueue) && importResult.reviewQueue.length > 0 && (
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle1">Review Queue ({importResult.reviewQueue.length})</Typography>
                            <Box sx={{ flex: 1 }} />
                            <Chip label="Suggestions" variant="outlined" />
                        </AccordionSummary>
                        <AccordionDetails>
                            <List>
                                {importResult.reviewQueue.map((tx) => (
                                    <ListItem key={tx.transactionId} divider>
                                        <ListItemAvatar>
                                            <Avatar>
                                                {tx.suggestedCategory ? tx.suggestedCategory.charAt(0) : '?'}
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={`${tx.bookingDate} — ${tx.description}`}
                                            secondary={`${tx.amount.toLocaleString(undefined, { style: 'currency', currency: 'EUR' })} — ${tx.merchantKey ?? ''}`}
                                        />
                                        <ListItemSecondaryAction>
                                            {tx.suggestedCategory ? (
                                                <Chip label={tx.suggestedCategory} color="primary" />
                                            ) : (
                                                <Chip label="No suggestion" />
                                            )}
                                            {typeof tx.suggestionConfidence === 'number' && (
                                                <Chip label={`${Math.round(tx.suggestionConfidence * 100)}%`} sx={{ ml: 1 }} />
                                            )}
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                ))}
                            </List>
                        </AccordionDetails>
                    </Accordion>
                </Grid>
            )}
        </Grid>
    )
}

export default function ImportTab({
    active,
    canWrite,
    importResult,
    isBusy,
    onUpload,
}) {
    const [selectedFile, setSelectedFile] = useState(null)
    const [inputKey, setInputKey] = useState(0)

    async function handleSubmit(event) {
        event.preventDefault()
        const success = await onUpload(selectedFile)

        if (success) {
            setSelectedFile(null)
            setInputKey((currentKey) => currentKey + 1)
        }
    }

    return (
        <section
            id="page-import"
            className={`tab-page${active ? ' is-active' : ''}`}
            role="tabpanel"
            aria-labelledby="tab-import"
            hidden={!active}
        >
            <Box sx={{ p: 2 }}>
                <Paper sx={{ p: 2 }} elevation={0} className="upload-panel">
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="overline">Import</Typography>
                        <Typography variant="h5">Bring in the latest workbook</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Repeated uploads are safe. Existing rows are matched with a synthetic
                            fingerprint and skipped.
                        </Typography>
                    </Box>

                    {canWrite ? (
                        <Box component="form" onSubmit={handleSubmit}>
                            <Stack spacing={1}>
                                <Button variant="outlined" component="label">
                                    {selectedFile?.name || 'Drop a Poste Italiane .xlsx export here'}
                                    <input
                                        key={inputKey}
                                        id="workbook-file"
                                        name="file"
                                        type="file"
                                        accept=".xlsx"
                                        required
                                        hidden
                                        onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                                    />
                                </Button>

                                <Button variant="contained" type="submit" disabled={isBusy || !selectedFile}>
                                    Import workbook
                                </Button>
                            </Stack>
                        </Box>
                    ) : (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Workbook import is available only to Writer and Admin accounts.
                        </Alert>
                    )}

                    <Box sx={{ mt: 2 }}>{renderImportResult(importResult)}</Box>
                </Paper>
            </Box>
        </section>
    )
}