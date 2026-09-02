import React, { useRef } from 'react';
import { Box, Paper, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';

interface EntryEditorProps {
  selectedDate: Date;
  content: string;
  onContentChange: (content: string) => void;
  onSave: (content: string) => Promise<void>;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

// Typewriter sound effect
// const playTypewriterSound = () => {
//   try {
//     const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
//     const oscillator = audioCtx.createOscillator();
//     const gainNode = audioCtx.createGain();
//     oscillator.connect(gainNode);
//     gainNode.connect(audioCtx.destination);
//     oscillator.frequency.value = 800 + Math.random() * 400;
//     oscillator.type = 'sine';
//     gainNode.gain.value = 0.03;
//     oscillator.start();
//     oscillator.stop(audioCtx.currentTime + 0.02);
//   } catch (e) {
//     // Silently fail if audio not supported
//   }
// };

export const EntryEditor: React.FC<EntryEditorProps> = ({
  selectedDate,
  content,
  onContentChange,
  onSave,
  loading,
  saving,
  error,
}) => {
  const textFieldRef = useRef<HTMLTextAreaElement>(null);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onContentChange(e.target.value);
    // playTypewriterSound();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSave(content);
    }
  };

  const handleSave = () => {
    onSave(content);
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <Paper
      sx={{
        p: 3,
        mb: 3,
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        boxShadow: (theme) => `inset 0 2px 8px ${theme.palette.action.hover}`,
        position: 'relative',
      }}
    >
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} color="inherit" />
        </Box>
      ) : (
        <>
          <Typography
            variant="subtitle1"
            gutterBottom
            sx={{
              fontFamily: '"Courier New", monospace',
              fontSize: '0.9rem',
              color: 'text.secondary',
              letterSpacing: '0.05em',
              borderBottom: (theme) => `1px dashed ${theme.palette.divider}`,
              pb: 1.5,
              mb: 2,
              display: 'flex',
              justifyContent: 'space-between',
              '& span': {
                color: 'text.disabled',
                fontSize: '0.8rem',
              }
            }}
          >
            {selectedDate.toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
            <span>✎</span>
          </Typography>

          <TextField
            multiline
            rows={10}
            fullWidth
            variant="outlined"
            placeholder="Write your diary entry..."
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            disabled={saving}
            inputRef={textFieldRef}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: '"Courier New", "American Typewriter", monospace',
                fontSize: '1rem',
                lineHeight: 1.8,
                bgcolor: 'transparent',
                borderRadius: 0,
                color: 'text.primary',
                '& textarea': {
                  padding: '8px 4px',
                  '&::placeholder': {
                    color: 'text.disabled',
                    fontStyle: 'italic',
                    opacity: 0.7,
                  }
                },
                '& fieldset': {
                  border: 'none',
                  borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                  borderRadius: 0,
                },
                '&:hover fieldset': {
                  borderBottom: (theme) => `1px solid ${theme.palette.text.secondary}`,
                },
                '&.Mui-focused fieldset': {
                  borderBottom: (theme) => `2px solid ${theme.palette.primary.main}`,
                }
              }
            }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
            <Typography
              sx={{
                fontFamily: '"Courier New", monospace',
                fontSize: '0.75rem',
                color: 'text.disabled',
                letterSpacing: '0.05em',
              }}
            >
              {content.length} characters • {wordCount} words
            </Typography>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!content.trim() || saving}
              sx={{
                fontFamily: '"Courier New", monospace',
                textTransform: 'none',
                letterSpacing: '0.05em',
                px: 4,
                borderRadius: 1,
              }}
            >
              {saving ? <CircularProgress size={20} color="inherit" /> : 'Save'}
            </Button>
          </Box>
          {error && (
            <Alert severity="error" sx={{ mt: 2, fontFamily: '"Courier New", monospace' }}>
              {error}
            </Alert>
          )}
        </>
      )}
    </Paper>
  );
};