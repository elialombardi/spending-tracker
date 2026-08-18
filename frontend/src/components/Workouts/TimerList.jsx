// components/TimerList.jsx
import { useState } from 'react';
import {
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Chip,
} from '@mui/material';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import Edit from '@mui/icons-material/Edit';
import Delete from '@mui/icons-material/Delete';
import TimerEditModal from './TimerEditModal';

export default function TimerList({ timers, onUpdateTimers }) {
  const [editingTimer, setEditingTimer] = useState(null);

  const handleMove = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= timers.length) return;

    const updated = [...timers];
    const [movedItem] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, movedItem);

    onUpdateTimers(updated);
  };

  const handleDelete = (id) => {
    if (timers.length <= 1) return; // Maintain at least 1 timer
    onUpdateTimers(timers.filter((t) => t.id !== id));
  };

  const handleSaveEditedTimer = (updatedTimer) => {
    onUpdateTimers(
      timers.map((t) => (t.id === updatedTimer.id ? updatedTimer : t))
    );
  };

  return (
    <>
      <Paper variant="outlined" sx={{ mb: 2, bgcolor: 'background.default' }}>
        <List size="small" disablePadding>
          {timers.map((timer, idx) => (
            <ListItem
              key={timer.id}
              divider={idx < timers.length - 1}
              sx={{ py: 0.5, px: 2 }}
            >
              <Chip
                label={`${timer.duration}s`}
                size="small"
                sx={{
                  bgcolor: timer.color || '#3b82f6',
                  color: '#fff',
                  fontWeight: 'bold',
                  mr: 2,
                  minWidth: 55,
                }}
              />
              <ListItemText
                primary={timer.name}
              />
              <Stack direction="row" spacing={0.5}>
                <IconButton
                  size="small"
                  disabled={idx === 0}
                  onClick={() => handleMove(idx, -1)}
                >
                  <ArrowUpward fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={idx === timers.length - 1}
                  onClick={() => handleMove(idx, 1)}
                >
                  <ArrowDownward fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => setEditingTimer(timer)}
                >
                  <Edit fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  disabled={timers.length <= 1}
                  onClick={() => handleDelete(timer.id)}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Stack>
            </ListItem>
          ))}
        </List>
      </Paper>

      {editingTimer && (
        <TimerEditModal
          open={Boolean(editingTimer)}
          timer={editingTimer}
          onClose={() => setEditingTimer(null)}
          onSave={handleSaveEditedTimer}
        />
      )}
    </>
  );
}