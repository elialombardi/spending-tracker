// components/WorkoutAssembly.jsx
import { useMemo, useState } from 'react';
import {
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  TextField,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import Delete from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import FitnessCenter from '@mui/icons-material/FitnessCenter';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WorkoutActions from './WorkoutActions';

// Utility function to format duration
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);
  
  return parts.join(' ');
}

// Calculate total duration of a session
function calculateSessionDuration(session) {
  if (!session || !session.timers || session.timers.length === 0) {
    return 0;
  }
  
  const durationPerRound = session.timers.reduce((sum, timer) => sum + (timer.duration || 0), 0);
  const prepareDuration = session.roundPrepareDuration || 0;
  const totalRounds = session.rounds;
  const totalWorkDuration = (prepareDuration + durationPerRound) * totalRounds * session.cycles;
  const cycleRestDuration = session.CycleRestDuration || 0;
  const totalRestDuration = cycleRestDuration * Math.max(0, session.cycles - 1);
  
  return totalWorkDuration + totalRestDuration;
}

export default function WorkoutAssembly({
  workoutName,
  onWorkoutNameChange,
  workoutSequence,
  onRemoveFromWorkout,
  onStartWorkout,
  selectedWorkoutId,
  savingWorkout,
  onSaveWorkout,
  onDeleteWorkout,
  onReorderSessions,
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Calculate total workout duration
  const totalWorkoutDuration = useMemo(() => {
    return workoutSequence.reduce((total, session) => {
      return total + calculateSessionDuration(session);
    }, 0);
  }, [workoutSequence]);

  const formattedDuration = formatDuration(totalWorkoutDuration);

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // For better visual feedback
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    e.currentTarget.style.opacity = '1';
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Reorder the array
    const reordered = [...workoutSequence];
    const [draggedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, draggedItem);

    // Call the reorder callback
    if (onReorderSessions) {
      onReorderSessions(reordered);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <Paper sx={{ p: 3, bgcolor: 'action.hover' }} elevation={2}>
      {/* Header with alignment fix */}
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          mb: 1 
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FitnessCenter sx={{ fontSize: 24 }} />
          <Typography variant="h6" fontWeight="bold">
            Current Workout
          </Typography>
        </Box>
        
        {/* Total Duration Badge */}
        {workoutSequence.length > 0 && (
          <Chip
            icon={<AccessTimeIcon />}
            label={formattedDuration}
            color="primary"
            size="medium"
            sx={{ 
              fontWeight: 700,
              '& .MuiChip-icon': { 
                color: 'inherit' 
              }
            }}
          />
        )}
      </Box>

      <TextField
        label="Workout Title"
        value={workoutName}
        onChange={(e) => onWorkoutNameChange(e.target.value)}
        size="small"
        fullWidth
        sx={{ my: 2, bgcolor: 'background.paper' }}
      />

      {workoutSequence.length === 0 ? (
        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
          Add sessions from the library above to build your workout.
        </Typography>
      ) : (
        <>
          <List size="small">
            {workoutSequence.map((sess, index) => {
              const sessionDuration = calculateSessionDuration(sess);
              const formattedSessionDuration = formatDuration(sessionDuration);
              const isDragOver = dragOverIndex === index;
              
              return (
                <ListItem
                  key={sess.instanceId || index}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  sx={{ 
                    bgcolor: isDragOver ? 'action.selected' : 'background.paper',
                    mb: 1, 
                    borderRadius: 1,
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    cursor: 'grab',
                    border: isDragOver ? '2px dashed' : '2px solid transparent',
                    borderColor: isDragOver ? 'primary.main' : 'transparent',
                    transition: 'all 0.2s ease',
                    '&:active': {
                      cursor: 'grabbing',
                    },
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                    {/* Drag Handle */}
                    <IconButton
                      size="small"
                      sx={{ 
                        cursor: 'grab',
                        color: 'text.secondary',
                        '&:active': {
                          cursor: 'grabbing',
                        },
                      }}
                    >
                      <DragIndicatorIcon />
                    </IconButton>

                  

                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography component="span" variant="body1">
                            {sess.name}
                          </Typography>
                          <Chip
                            label={formattedSessionDuration}
                            size="small"
                            variant="outlined"
                            sx={{ 
                              fontSize: '0.7rem',
                              height: 20,
                              '& .MuiChip-label': { px: 1 }
                            }}
                          />
                        
                        </Box>
                      }
                    />
                    
                    <ListItemSecondaryAction>
                      <IconButton 
                        edge="end" 
                        onClick={() => onRemoveFromWorkout(sess.instanceId)}
                        sx={{ ml: 1 }}
                      >
                        <Delete />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </Box>
                </ListItem>
              );
            })}
          </List>
          
          {/* Summary Footer */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mt: 1,
              pt: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
          </Box>
        </>
      )}

      <WorkoutActions
        selectedWorkoutId={selectedWorkoutId}
        workoutSequence={workoutSequence}
        savingWorkout={savingWorkout}
        onSaveWorkout={onSaveWorkout}
        onDeleteWorkout={onDeleteWorkout}
        onStartWorkout={onStartWorkout}
      />
    </Paper>
  );
}