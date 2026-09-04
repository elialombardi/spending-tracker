import React, { useRef, useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

interface EntryEditorProps {
  selectedDate: Date;
  content: string;
  onContentChange: (content: string) => void;
  onSave: (content: string) => Promise<void>;
  loading: boolean;
  saving: boolean;
  error: string | null;
  isToday: boolean;
}

export const EntryEditor: React.FC<EntryEditorProps> = ({
  selectedDate,
  content,
  onContentChange,
  onSave,
  loading,
  saving,
  error,
  isToday,
}) => {
  const textFieldRef = useRef<HTMLTextAreaElement>(null);

  // Load preferences from localStorage, default to true
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem('diary-sound-enabled');
    return stored !== null ? stored === 'true' : true;
  });

  const [textVisible, setTextVisible] = useState(() => {
    const stored = localStorage.getItem('diary-text-visible');
    return stored !== null ? stored === 'true' : true;
  });

  // Persist preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('diary-sound-enabled', String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('diary-text-visible', String(textVisible));
  }, [textVisible]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Alt+Q (case-insensitive)
      if (event.key === 'q' && event.altKey) {
        event.preventDefault(); // Prevent browser default (e.g., quick search)
        setTextVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty dependency array – runs once on mount

  // Realistic typewriter sound using white noise with a short envelope
  const playTypewriterSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const bufferSize = audioCtx.sampleRate * 0.02; // 20ms of noise
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.15;
      }

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;

      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1200 + Math.random() * 600;
      filter.Q.value = 1.5;

      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      source.start();
      source.stop(audioCtx.currentTime + 0.04);
    } catch (e) {
      // Silently fail if audio not supported
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onContentChange(e.target.value);
    playTypewriterSound();
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

  const displayValue = textVisible
    ? content
    : content.split('').map(c => (c === '\n' ? '\n' : '•')).join('');

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
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: (theme) => `1px dashed ${theme.palette.divider}`,
              pb: 1.5,
              mb: 2,
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                fontFamily: '"Courier New", monospace',
                fontSize: '0.9rem',
                color: 'text.secondary',
                letterSpacing: '0.05em',
              }}
            >
              {selectedDate.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Typography>

            {isToday ? (
              <Chip
                label="Today"
                size="small"
                sx={{
                  fontFamily: '"Courier New", monospace',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  '& .MuiChip-label': { px: 2 }
                }}
              />
            ) : null}
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title={soundEnabled ? 'Mute typewriter sound' : 'Enable typewriter sound'}>
                <IconButton
                  size="small"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  sx={{ color: 'text.secondary' }}
                >
                  {soundEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title={textVisible ? 'Hide text' : 'Show text'}>
                <IconButton
                  size="small"
                  onClick={() => setTextVisible(!textVisible)}
                  sx={{ color: 'text.secondary' }}
                >
                  {textVisible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <TextField
            multiline
            rows={10}
            fullWidth
            variant="outlined"
            placeholder="Write your diary entry..."
            value={displayValue}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            disabled={saving || !textVisible}
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
                  },
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
                },
              },
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