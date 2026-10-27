import { useState } from 'react'
import { Box, Paper, Typography, Select, MenuItem, TextField, Button, CircularProgress } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'

interface TagManagerProps {
    tags: string[]
    canWrite: boolean
    loading: boolean
    onRenameTag: (oldName: string, newName: string) => Promise<boolean>
    onDeleteTag: (name: string) => Promise<boolean>
    onCreateTag: (name: string) => Promise<boolean>
    onRefresh: () => void
}

export default function TagManager({ tags, canWrite, loading, onRenameTag, onDeleteTag, onCreateTag, onRefresh }: TagManagerProps) {
    const [selection, setSelection] = useState('')
    const selectedTag = tags.includes(selection) ? selection : tags[0] || ''
    const [newTagName, setNewTagName] = useState('')
    const [createInput, setCreateInput] = useState('')
    const [busy, setBusy] = useState(false)

    async function rename() {
        const name = newTagName.trim()
        if (!selectedTag || !name) return
        setBusy(true)
        try {
            if (await onRenameTag(selectedTag, name)) {
                setSelection(name)
                setNewTagName('')
            }
        } finally {
            setBusy(false)
        }
    }

    async function create() {
        const name = createInput.trim()
        if (!name) return
        setBusy(true)
        try {
            if (await onCreateTag(name)) {
                setSelection(name)
                setCreateInput('')
            }
        } finally {
            setBusy(false)
        }
    }

    async function remove() {
        if (!selectedTag || !window.confirm(`Delete tag "${selectedTag}"?`)) return
        setBusy(true)
        try {
            if (await onDeleteTag(selectedTag)) setSelection('')
        } finally {
            setBusy(false)
        }
    }

    if (loading) return <CircularProgress size={24} />

    return (
        <Box>
            <Typography variant="h5" gutterBottom>Manage Tags</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button variant="outlined" size="small" onClick={onRefresh}>Refresh</Button>
            </Box>
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2">Select tag</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Select value={selectedTag} onChange={event => setSelection(event.target.value)} displayEmpty size="small" sx={{ minWidth: 140 }}>
                        <MenuItem value="">--</MenuItem>
                        {tags.map(tag => <MenuItem key={tag} value={tag}>{tag}</MenuItem>)}
                    </Select>
                    <TextField size="small" placeholder="New name" value={newTagName} onChange={event => setNewTagName(event.target.value)} disabled={!canWrite || busy} />
                    <Button variant="contained" size="small" onClick={rename} disabled={!canWrite || busy || !selectedTag || !newTagName.trim()}>Rename</Button>
                    <Button variant="outlined" color="error" size="small" onClick={remove} startIcon={<DeleteIcon />} disabled={!canWrite || busy || !selectedTag}>Delete</Button>
                </Box>
                <Typography variant="subtitle2" sx={{ mt: 2 }}>Create new tag</Typography>
                <Box component="form" onSubmit={event => { event.preventDefault(); void create() }} sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <TextField size="small" placeholder="Tag name" value={createInput} onChange={event => setCreateInput(event.target.value)} disabled={!canWrite || busy} />
                    <Button type="submit" variant="contained" size="small" disabled={!canWrite || busy || !createInput.trim()}>Add</Button>
                </Box>
            </Paper>
        </Box>
    )
}
