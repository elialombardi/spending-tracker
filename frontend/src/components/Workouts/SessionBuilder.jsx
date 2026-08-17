// components/SessionBuilder.jsx
import React, { useState, useEffect } from 'react';
import { Grid, CircularProgress, Box, Alert } from '@mui/material';
import { workoutsApi } from '../../api';

import WorkoutHeader from './WorkoutHeader';
import WorkoutActions from './WorkoutActions';
import SessionFormModal from './SessionFormModal';
import SessionLibrary from './SessionLibrary';
import WorkoutAssembly from './WorkoutAssembly';

export default function SessionBuilder({ onStartWorkout }) {
  const [sessions, setSessions] = useState([]);
  const [workouts, setWorkouts] = useState([]);

  // Active Workout State
  const [selectedWorkoutId, setSelectedWorkoutId] = useState('');
  const [workoutName, setWorkoutName] = useState('My Custom Workout');
  const [workoutSequence, setWorkoutSequence] = useState([]);

  // Async States
  const [loading, setLoading] = useState(true);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [error, setError] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        const [sessionsRes, workoutsRes] = await Promise.all([
          workoutsApi.listSessions({ page: 1, limit: 50 }),
          workoutsApi.listWorkouts
            ? workoutsApi.listWorkouts()
            : Promise.resolve({ data: [] }),
        ]);

        if (isMounted) {
          setSessions(sessionsRes?.data || []);
          setWorkouts(workoutsRes?.data || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load initial data');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectWorkout = (workoutId) => {
    setSelectedWorkoutId(workoutId);
    if (!workoutId) {
      setWorkoutName('My Custom Workout');
      setWorkoutSequence([]);
      return;
    }

    const found = workouts.find((w) => w.id === workoutId);
    if (found) {
      setWorkoutName(found.name);
      const mappedSequence = (found.sessions || []).map((s, index) => ({
        ...s,
        instanceId: `${s.id}-${Date.now()}-${index}`,
      }));
      setWorkoutSequence(mappedSequence);
    }
  };

  // --- Session Modal Handlers ---
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
        return prev.map((s) => (s.id === savedSession.id ? savedSession : s));
      }
      return [savedSession, ...prev];
    });
    handleCloseModal();
  };

  // --- Workout Sequence Handlers ---
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

  // --- Workout API Handlers ---
  const handleSaveWorkout = async () => {
    if (workoutSequence.length === 0) {
      setError('Please add at least one session to the workout.');
      return;
    }

    const sessionIds = workoutSequence.map((s) => s.id);
    setSavingWorkout(true);
    setError(null);

    try {
      if (selectedWorkoutId) {
        const updated = await workoutsApi.updateWorkout(selectedWorkoutId, {
          name: workoutName,
          sessionIds,
        });
        setWorkouts((prev) =>
          prev.map((w) => (w.id === selectedWorkoutId ? updated : w))
        );
      } else {
        const created = await workoutsApi.createWorkout({
          name: workoutName,
          sessionIds,
        });
        setWorkouts((prev) => [created, ...prev]);
        setSelectedWorkoutId(created.id);
      }
    } catch (err) {
      setError(err.message || 'Failed to save workout');
    } finally {
      setSavingWorkout(false);
    }
  };

  const handleDeleteWorkout = async () => {
    if (!selectedWorkoutId) return;

    try {
      setSavingWorkout(true);
      await workoutsApi.deleteWorkout(selectedWorkoutId);
      setWorkouts((prev) => prev.filter((w) => w.id !== selectedWorkoutId));
      handleSelectWorkout('');
    } catch (err) {
      setError(err.message || 'Failed to delete workout');
    } finally {
      setSavingWorkout(false);
    }
  };

  const handleStart = async () => {
    if (workoutSequence.length === 0) return;

    try {
      setLoading(true);
      const sessionIds = workoutSequence.map((s) => s.id);

      const targetWorkout = selectedWorkoutId
        ? await workoutsApi.updateWorkout(selectedWorkoutId, {
          name: workoutName,
          sessionIds,
        })
        : await workoutsApi.createWorkout({
          name: workoutName,
          sessionIds,
        });

      onStartWorkout(targetWorkout);
    } catch (err) {
      setError(err.message || 'Failed to start workout');
    } finally {
      setLoading(false);
    }
  };

  if (loading && sessions.length === 0) {
    return (
      <Box display="flex" >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <WorkoutHeader
        selectedWorkoutId={selectedWorkoutId}
        workouts={workouts}
        onSelectWorkout={handleSelectWorkout}
        onOpenCreateModal={handleOpenCreateModal}
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container>
        {/* Left Column: Sessions */}
        <Grid xs={12} md={6}>
          <SessionLibrary
            sessions={sessions}
            onAddToWorkout={handleAddToWorkout}
            onDeleteSession={(deletedId) =>
              setSessions((prev) => prev.filter((s) => s.id !== deletedId))
            }
            onEditSession={(editedId) => {
              const localSession = sessions.find((s) => s.id === editedId);
              if (localSession) {
                handleOpenEditModal(localSession);
              } else {
                workoutsApi.getSession(editedId).then(handleOpenEditModal);
              }
            }}
          />
        </Grid>

        {/* Right Column: Workout Workspace */}

        <WorkoutAssembly
          workoutName={workoutName}
          onWorkoutNameChange={setWorkoutName}
          workoutSequence={workoutSequence}
          onRemoveFromWorkout={handleRemoveFromWorkout}
          onStartWorkout={handleStart}
          selectedWorkoutId={selectedWorkoutId}
          workoutSequence={workoutSequence}
          savingWorkout={savingWorkout}
          onSaveWorkout={handleSaveWorkout}
          onDeleteWorkout={handleDeleteWorkout}
        />
      </Grid>

      <SessionFormModal
        open={isModalOpen}
        onClose={handleCloseModal}
        onSaveSession={handleSaveSession}
        initialData={editingSession}
      />
    </Box>
  );
}