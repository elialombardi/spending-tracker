import { useState } from 'react';
import {
  Paper,
  Stack,
  Typography,
  List,
  Checkbox,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
} from '@mui/material';
import TaskLine from './TaskLine';
import type { Task, AssignProjectPayload, Project } from '../../types/tasks';

type HistorySectionProps = {
  historyTasks: Task[];
  openEditTask: (task: Task) => void;
  handleAssignProjectToTasks: (payload: AssignProjectPayload) => Promise<void>;
  projects?: Project[];
};

export default function HistorySection({
  historyTasks,
  openEditTask,
  handleAssignProjectToTasks,
  projects = [],
}: HistorySectionProps) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleSelect = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTaskIds.length === historyTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(historyTasks.map((task) => task.id));
    }
  };

  const handleOpenDialog = () => {
    if (selectedTaskIds.length === 0) return;
    setSelectedProjectId('');
    setError(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedProjectId('');
    setError(null);
  };

  const handleConfirmAssign = async () => {
    if (!selectedProjectId) {
      setError('Please select a project');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await handleAssignProjectToTasks({
        taskIds: selectedTaskIds,
        projectId: selectedProjectId,
      });
      setSelectedTaskIds([]);
      handleCloseDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign tasks');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAllSelected =
    historyTasks.length > 0 && selectedTaskIds.length === historyTasks.length;

  return (
    <>
      <Paper sx={{ borderRadius: 3, p: 2.5 }} variant="outlined">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          sx={{
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', md: 'center' },
            mb: 2,
          }}
          spacing={2}
        >
          <Stack direction="row"
            sx={{ alignItems: 'center' }} spacing={1}>
            <Typography sx={{ fontWeight: 700 }} variant="h6">
              Full history
            </Typography>
            {selectedTaskIds.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                ({selectedTaskIds.length} selected)
              </Typography>
            )}
          </Stack>

          <Stack direction="row" spacing={1}>
            {historyTasks.length > 0 && (
              <Button size="small" onClick={handleSelectAll}>
                {isAllSelected ? 'Deselect All' : 'Select All'}
              </Button>
            )}
            {selectedTaskIds.length > 0 && (
              <Button
                variant="contained"
                size="small"
                onClick={handleOpenDialog}
                disabled={selectedTaskIds.length === 0}
              >
                Assign to Project
              </Button>
            )}
          </Stack>
        </Stack>

        <List disablePadding>
          {historyTasks.map((task) => {
            const isSelected = selectedTaskIds.includes(task.id);
            return (
              <Box
                key={task.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                  },
                  bgcolor: isSelected ? 'action.selected' : 'transparent',
                  borderRadius: 1,
                }}
              >
                <Checkbox
                  checked={isSelected}
                  onChange={() => handleToggleSelect(task.id)}
                  size="small"
                  sx={{ ml: -0.5 }}
                />
                <Box sx={{ flex: 1 }}>
                  <TaskLine
                    task={task}
                    showProject
                    showSentOn
                    onEdit={openEditTask}
                  />
                </Box>
              </Box>
            );
          })}
        </List>

        {historyTasks.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No history tasks found
          </Typography>
        )}
      </Paper>

      {/* Assign to Project Dialog */}
      <Dialog open={isDialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Tasks to Project</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {selectedTaskIds.length} task{selectedTaskIds.length > 1 ? 's' : ''} will
              be assigned to the selected project.
            </Typography>

            <FormControl fullWidth error={!!error}>
              <InputLabel>Select Project</InputLabel>
              <Select
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setError(null);
                }}
                label="Select Project"
              >
                {projects.length === 0 ? (
                  <MenuItem disabled>No projects available</MenuItem>
                ) : (
                  projects.map((project) => (
                    <MenuItem key={project.id} value={project.id}>
                      {project.name}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleConfirmAssign}
            variant="contained"
            disabled={isSubmitting || !selectedProjectId || projects.length === 0}
          >
            {isSubmitting ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}