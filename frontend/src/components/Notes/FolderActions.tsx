import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined';
import FolderCopyOutlinedIcon from '@mui/icons-material/FolderCopyOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/Delete';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import { NoteFolderTree } from '../../types/notes';

type FolderActionsProps = {
    canWrite: boolean;
    selectedFolder: NoteFolderTree | null;
    onOpenCreateDialog: () => void;
    onOpenCreateRootDialog: () => void;
    isSidebarOpen?: boolean;
    onToggleSidebar?: () => void;
    onOpenRenameDialog: (folderName: string) => void;
    onDeleteFolder: () => void;
};

export function FolderActions({
    canWrite,
    selectedFolder,
    onOpenCreateDialog,
    onOpenCreateRootDialog,
    isSidebarOpen = true,
    onToggleSidebar,
    onOpenRenameDialog,
    onDeleteFolder,
}: FolderActionsProps) {
    return (
        <Stack spacing={2} sx={{ p: 2.5, pb: 1.5 }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', color: 'text.secondary', mb: 0.5 }}>
                        YOUR WORKSPACE
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>Folders</Typography>
                </Box>
                <Tooltip title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
                    <IconButton
                        aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                        size="small"
                        onClick={onToggleSidebar}
                        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px' }}
                    >
                        {isSidebarOpen ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                    </IconButton>
                </Tooltip>
            </Stack>
            <Button
                fullWidth
                variant="contained"
                aria-label="Add root folder"
                startIcon={<CreateNewFolderOutlinedIcon />}
                disabled={!canWrite}
                onClick={onOpenCreateRootDialog}
                sx={{ py: 1.2, borderRadius: '12px', fontWeight: 700 }}
            >
                New folder
            </Button>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Button
                    size="small"
                    aria-label="Add child folder"
                    startIcon={<FolderCopyOutlinedIcon sx={{ fontSize: '18px !important' }} />}
                    disabled={!canWrite || !selectedFolder}
                    onClick={onOpenCreateDialog}
                    sx={{ color: 'text.secondary', fontSize: '0.75rem', borderRadius: '8px' }}
                >
                    Subfolder
                </Button>
                <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Edit folder">
                        <span>
                            <IconButton
                                aria-label="Edit folder"
                                size="small"
                                disabled={!canWrite || !selectedFolder}
                                onClick={() => onOpenRenameDialog(selectedFolder?.name || '')}
                                sx={{ borderRadius: '8px', '&:hover': { color: 'primary.main' } }}
                            >
                                <DriveFileRenameOutlineIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Delete folder">
                        <span>
                            <IconButton
                                aria-label="Delete folder"
                                size="small"
                                disabled={!canWrite || !selectedFolder}
                                onClick={onDeleteFolder}
                                sx={{ borderRadius: '8px', '&:hover': { color: 'error.main' } }}
                            >
                                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
            </Stack>
        </Stack>
    );
}