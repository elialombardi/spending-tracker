import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HomeIcon from '@mui/icons-material/Home';
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
        <Box>
            <Tooltip title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
                <span>
                    <IconButton
                        size="small"
                        onClick={onToggleSidebar}
                    >
                        {isSidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                    </IconButton>
                </span>
            </Tooltip>
            <Tooltip title="Add root folder">
                <span>
                    <IconButton
                        size="small"
                        disabled={!canWrite}
                        onClick={onOpenCreateRootDialog}
                    >
                        <HomeIcon />
                    </IconButton>
                </span>
            </Tooltip>
            <Tooltip title="Add child folder">
                <span>
                    <IconButton
                        size="small"
                        disabled={!canWrite}
                        onClick={onOpenCreateDialog}
                    >
                        <AddIcon />
                    </IconButton>
                </span>
            </Tooltip>
            <Tooltip title="Rename folder">
                <span>
                    <IconButton
                        size="small"
                        disabled={!canWrite || !selectedFolder}
                        onClick={() => onOpenRenameDialog(selectedFolder?.name || '')}
                    >
                        <DriveFileRenameOutlineIcon />
                    </IconButton>
                </span>
            </Tooltip>
            <Tooltip title="Delete folder">
                <span>
                    <IconButton
                        size="small"
                        disabled={!canWrite || !selectedFolder}
                        onClick={onDeleteFolder}
                    >
                        <DeleteOutlineIcon />
                    </IconButton>
                </span>
            </Tooltip>
        </Box>
    );
}