// components/WorkoutComplete.jsx
import { Container, Typography, Button } from '@mui/material';

export function WorkoutComplete({ onFinish }) {
  return (
    <Container
      maxWidth="xs"
      sx={{
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
      }}
    >
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Workout Complete! 🎉
      </Typography>
      <Typography variant="body1" sx={{ mb: 3, opacity: 0.9 }}>
        Great job pushing through your session.
      </Typography>
      <Button
        variant="contained"
        size="large"
        onClick={onFinish}
        sx={{
          color: '#000',
          bgcolor: '#fff',
          fontWeight: 'bold',
          px: 4,
          py: 1,
          borderRadius: 4,
        }}
      >
        Back to Setup
      </Button>
    </Container>
  );
}