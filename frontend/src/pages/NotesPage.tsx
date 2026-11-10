import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import NotesWorkspace from '../components/Notes/NotesWorkspace';

type Props = {
  canWrite: boolean
}

export default function NotesPage({ canWrite }: Props) {
  return (
    <Box>
      <Box sx={{ mb: 3, mt: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.04em', mb: 0.5 }}>Notes &amp; lists</Typography>
        <Typography color="text.secondary" sx={{ fontSize: '0.95rem' }}>
          A little space for your thoughts, plans, and everyday things.
        </Typography>
      </Box>
      <NotesWorkspace canWrite={canWrite} />
    </Box>
  );
}
