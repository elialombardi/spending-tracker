import Box from '@mui/material/Box'

interface Props {
    canWrite?: boolean
    tags?: string[]
    locations?: any[]
    onRenameTag?: (oldTag: string, newTag: string) => Promise<void>
    onDeleteTag?: (tag: string) => Promise<void>
    onCreateTag?: (tag: string) => Promise<void>
    onToggleLocationTag?: (locId: number, tag: string, present: boolean) => Promise<void>
    onUpdateLocation?: (locId: number, updated: any) => Promise<void>
    onDeleteLocation?: (locId: number) => Promise<void>
}

export default function TagsPage(props: Props) {
    return (
        <Box sx={{ p: 3, minHeight: '60vh' }}>
            <Box sx={{ typography: 'h5', mb: 2 }}>Tags</Box>
            <Box>Tags admin UI (converted to TS)</Box>
        </Box>
    )
}
