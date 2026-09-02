import React from 'react';
import { Stack, IconButton, Button, Chip, TextField } from '@mui/material';
import { ChevronLeft, ChevronRight, Today } from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

interface DateNavigatorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  isToday: boolean;
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({
  selectedDate,
  onDateChange,
  isToday,
}) => {
  const goToPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    onDateChange(d);
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    onDateChange(d);
  };

  const goToToday = () => onDateChange(new Date());

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        mb: 3,
        flexWrap: 'wrap',
        gap: 1,
        '& .MuiIconButton-root': {
          border: (theme) => `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          color: 'text.primary',
          '&:hover': {
            bgcolor: 'action.hover',
          }
        }
      }}
    >
      <IconButton onClick={goToPrevDay} size="small">
        <ChevronLeft />
      </IconButton>

      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker
          label="Select date"
          value={selectedDate}
          onChange={(newValue) => {
            if (newValue) {
              onDateChange(newValue);
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              sx={{
                width: '200px',
                '& .MuiInputBase-root': {
                  fontFamily: '"Courier New", monospace',
                  fontSize: '0.9rem',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                },
                '& .MuiInputLabel-root': {
                  fontFamily: '"Courier New", monospace',
                  color: 'text.secondary',
                }
              }}
            />
          )}
        />
      </LocalizationProvider>

      <IconButton onClick={goToNextDay} size="small">
        <ChevronRight />
      </IconButton>

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
      ) : (
        <Button
          variant="outlined"
          startIcon={<Today />}
          onClick={goToToday}
          size="small"
          sx={{
            fontFamily: '"Courier New", monospace',
            textTransform: 'none',
            borderColor: 'divider',
            color: 'text.primary',
            '&:hover': {
              borderColor: 'text.primary',
              bgcolor: 'action.hover',
            }
          }}
        >
          Today
        </Button>
      )}
    </Stack>
  );
};