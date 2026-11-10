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
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600, mb: 0.5 }}>Notes &amp; lists</Typography>
        <Typography variant="body2" color="text.secondary">
          A little space for your thoughts, plans, and everyday things.
        </Typography>
      </Box>
      <NotesWorkspace canWrite={canWrite} />
    </Box>
  );
}
