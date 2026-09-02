import Paper from '@mui/material/Paper';
import NotesWorkspace from '../components/Notes/NotesWorkspace';

type Props = {
  canWrite: boolean
}

export default function NotesPage({ canWrite }: Props) {
  return (
    <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }} variant="outlined">
      <NotesWorkspace canWrite={canWrite} />
    </Paper>
  );
}
