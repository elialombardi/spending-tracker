import { useState } from 'react'
import { Alert, Paper } from '@mui/material'
import TagManager from '../components/pages/TagManager'
import { useListTagsQuery, useCreateLocationTagMutation, useRenameLocationTagMutation, useDeleteLocationTagMutation } from '../api/locationTagsApi'

export default function TagsPage({ canWrite }: { canWrite: boolean }) {
    const { data: tags = [], isLoading, error: loadError, refetch } = useListTagsQuery()
    const [createTag] = useCreateLocationTagMutation()
    const [renameTag] = useRenameLocationTagMutation()
    const [deleteTag] = useDeleteLocationTagMutation()
    const [error, setError] = useState('')

    async function mutate(action: Promise<unknown>) {
        setError('')
        try {
            await action
            return true
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to update the tag.')
            return false
        }
    }

    return (
        <Paper sx={{ p: 2 }}>
            {(error || loadError) && <Alert severity="error">{error || 'Failed to load tags.'}</Alert>}
            <TagManager
                canWrite={canWrite}
                tags={tags}
                loading={isLoading}
                onRefresh={refetch}
                onRenameTag={(oldName, newName) => mutate(renameTag({ oldName, newName }).unwrap())}
                onDeleteTag={name => mutate(deleteTag(name).unwrap())}
                onCreateTag={name => mutate(createTag(name).unwrap())}
            />
        </Paper>
    )
}
