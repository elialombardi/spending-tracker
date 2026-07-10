import { useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import EmptyState from './shared/EmptyState'

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