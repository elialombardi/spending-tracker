import React from 'react';
import { Box, TextField, InputAdornment, Paper, List, ListItem, ListItemText, Typography, CircularProgress, Alert } from '@mui/material';
import { Search } from '@mui/icons-material';
import { DiaryEntry } from '../../api/diary';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResults: DiaryEntry[];
  searchLoading: boolean;
  searchError: string | null;
  onResultClick: (date: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  onSearchChange,
  searchResults,
  searchLoading,
  searchError,
  onResultClick,
}) => {
  return (
    <Box sx={{ mb: 2 }}>
      <TextField
        fullWidth
        placeholder="Search across all entries..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{
          '& .MuiOutlinedInput-root': {
            fontFamily: '"Courier New", monospace',
            fontSize: '0.9rem',
            bgcolor: 'background.paper',
            borderRadius: 1,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            color: 'text.primary',
            '& fieldset': {
              border: 'none',
            },
            '&:hover': {
              borderColor: 'text.secondary',
            },
            '&.Mui-focused': {
              borderColor: 'primary.main',
            }
          },
          '& .MuiInputAdornment-root .MuiSvgIcon-root': {
            color: 'text.disabled',
          }
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search />
            </InputAdornment>
          ),
        }}
      />
      {searchLoading && <CircularProgress size={20} sx={{ mt: 1, color: 'text.disabled' }} />}
      {searchError && (
        <Alert severity="error" sx={{ mt: 1, fontFamily: '"Courier New", monospace' }}>
          {searchError}
        </Alert>
      )}
      {searchResults.length > 0 && (
        <Paper
          sx={{
            mt: 2,
            maxHeight: 300,
            overflow: 'auto',
            borderRadius: 1,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            bgcolor: 'background.paper',
            '&::-webkit-scrollbar': {
              width: 6,
            },
            '&::-webkit-scrollbar-track': {
              bgcolor: 'background.default',
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'divider',
              borderRadius: 3,
            },
          }}
        >
          <List sx={{ p: 0 }}>
            {searchResults.map((result) => (
              <ListItem
                key={result.id}
                button
                onClick={() => onResultClick(result.date)}
                sx={{
                  borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                  '& .MuiListItemText-primary': {
                    fontFamily: '"Courier New", monospace',
                    fontSize: '0.8rem',
                    color: 'text.secondary',
                    letterSpacing: '0.03em',
                  },
                  '& .MuiListItemText-secondary': {
                    fontFamily: '"Courier New", monospace',
                    fontSize: '0.85rem',
                    color: 'text.primary',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }
                }}
              >
                <ListItemText
                  primary={new Date(result.date).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                  secondary={result.content.substring(0, 120) + (result.content.length > 120 ? '...' : '')}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
      {searchQuery && !searchLoading && searchResults.length === 0 && (
        <Typography
          sx={{
            mt: 1,
            fontFamily: '"Courier New", monospace',
            color: 'text.disabled',
            fontStyle: 'italic',
            fontSize: '0.9rem',
          }}
        >
          No entries found.
        </Typography>
      )}
    </Box>
  );
};