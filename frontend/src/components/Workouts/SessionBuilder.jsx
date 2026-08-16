// components/SessionBuilder.jsx
import React, { useState, useEffect } from 'react';
import {
  Grid,
  Stack,
  CircularProgress,
  Box,
  Alert,
  Button,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { workoutsApi } from '../../api';
import SessionFormModal from './SessionFormModal';
import SessionLibrary from './SessionLibrary';
import WorkoutAssembly from './WorkoutAssembly';

export default function SessionBuilder({ onStartWorkout }) {
  const [sessions, setSessions] = useState([]);
  const [workoutSequence, setWorkoutSequence] = useState([]);
  const [workoutName, setWorkoutName] = useState('My Custom Workout');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State: null = closed, {} = creating new, { id, ... } = editing existing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSessions() {
      try {
        setLoading(true);
        const res = await workoutsApi.listSessions({ page: 1, limit: 50 });
        if (isMounted) {
          setSessions(res?.data || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load sessions');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadSessions();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenCreateModal = () => {
    setEditingSession(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sessionToEdit) => {
    setEditingSession(sessionToEdit);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSession(null);
  };

  const handleSaveSession = (savedSession) => {
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === savedSession.id);
      if (exists) {
        // Update existing session in state
        return prev.map((s) => (s.id === savedSession.id ? savedSession : s));
      }
      // Prepend new session
      return [savedSession, ...prev];
    });
    handleCloseModal();
  };

  const handleAddToWorkout = (session) => {
    setWorkoutSequence((prev) => [
      ...prev,
      { ...session, instanceId: `${session.id}-${Date.now()}` },
    ]);
  };

  const handleRemoveFromWorkout = (instanceId) => {
    setWorkoutSequence((prev) =>
      prev.filter((s) => s.instanceId !== instanceId)
    );
  };

  const handleStart = async () => {
    if (workoutSequence.length === 0) return;

    try {
      setLoading(true);
      const sessionIds = workoutSequence.map((s) => s.id);
      const createdWorkout = await workoutsApi.createWorkout({
        name: workoutName,
        sessionIds,
      });

      onStartWorkout(createdWorkout);
    } catch (err) {
      setError(err.message || 'Failed to create workout');
    } finally {
      setLoading(false);
    }
  };

  if (loading && sessions.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h5" fontWeight="bold">
          Workout Builder
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreateModal}
        >
          Create New Session
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <SessionLibrary
            sessions={sessions}
            onAddToWorkout={handleAddToWorkout}
            onDeleteSession={(deletedId) =>
              setSessions((prev) => prev.filter((s) => s.id !== deletedId))
            }
            onEditSession={(editedId) => {
              // Find local session object or fetch directly, then open modal
              const localSession = sessions.find((s) => s.id === editedId);
              if (localSession) {
                handleOpenEditModal(localSession);
              } else {
                workoutsApi.getSession(editedId).then(handleOpenEditModal);
              }
            }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <WorkoutAssembly
            workoutName={workoutName}
            onWorkoutNameChange={setWorkoutName}
            workoutSequence={workoutSequence}
            onRemoveFromWorkout={handleRemoveFromWorkout}
            onStartWorkout={handleStart}
          />
        </Grid>
      </Grid>

      {/* Shared Create / Edit Modal */}
      <SessionFormModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSaveSession={handleSaveSession}
        initialData={editingSession}
      />
    </Box>
  );
}