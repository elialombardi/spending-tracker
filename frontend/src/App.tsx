import { lazy, Suspense, useEffect } from 'react';
import NavBar from './components/NavBar';
import LoginScreen from './components/LoginScreen';
import { Routes, Route } from 'react-router-dom';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import { bootstrapDevelopmentSession, canWrite, isSessionExpired, login, logout, useAuthSession, isAdmin } from './auth';
import { isDevelopmentEnv } from './config';

const appVersion = import.meta.env.VITE_APP_VERSION;
const MapPage = lazy(() => import('./pages/MapPage'));
const TagsPage = lazy(() => import('./pages/TagsPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CognitiveTraining = lazy(() => import('./pages/CognitiveTraining'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const WorkoutPage = lazy(() => import('./pages/WorkoutPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));
const DiaryPage = lazy(() => import('./pages/Diary/DiaryPage'));
const YoutubeManager = lazy(() => import('./pages/YoutubeManager').then(module => ({ default: module.YoutubeManager })));
const BoxingEventsPage = lazy(() => import('./pages/BoxingEvents/BoxingEventsPage'));
const FuelManager = lazy(() => import('./pages/FuelManager'));

function App({ themeName, setThemeName }) {
  const { message, session, status } = useAuthSession();
  const canModify = canWrite(session);
  const isAdminUser = isAdmin(session);

  useEffect(() => {
    if (session && isSessionExpired(session)) {
      logout('Your session expired. Please sign in again.', false);
      return;
    }
    if (!session && isDevelopmentEnv) {
      bootstrapDevelopmentSession().catch(error => {
        console.warn('Development auth bootstrap failed', error);
      });
    }
  }, [session]);

  if (!session) {
    return <LoginScreen errorMessage={message} isBusy={status === 'authenticating'} isDevelopment={isDevelopmentEnv} onSubmit={login} />;
  }

  return (
    <>
      <Container maxWidth="lg" sx={{ py: 2 }}>
        <NavBar canWrite={canModify} onLogout={() => logout()} session={session} themeName={themeName} setThemeName={setThemeName} />
        <Suspense fallback={<Box sx={{ p: 3 }}>Loading…</Box>}>
          <Routes>
            <Route path="/" element={<MapPage />} />
            <Route path="/cognitive" element={<CognitiveTraining />} />
            <Route path="/workout" element={<WorkoutPage />} />
            <Route path="/notes" element={<NotesPage canWrite={canModify} />} />
            <Route path="/diary" element={<DiaryPage />} />
            <Route path="/boxing-events" element={<BoxingEventsPage />} />
            <Route path="/youtube-manager" element={<YoutubeManager />} />
            {isAdminUser ? (
              <>
                <Route path="/users" element={<UsersPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/fuel-manager" element={<FuelManager />} />
                <Route path="/admin/tags" element={<TagsPage canWrite={canModify} />} />
              </>
            ) : null}
          </Routes>
        </Suspense>
      </Container>
      <Box sx={{ mt: 2, textAlign: 'right', color: 'text.secondary', fontSize: '0.75rem', px: 2, py: 1 }}>
        Version {appVersion}
      </Box>
    </>
  );
}

export default App;
