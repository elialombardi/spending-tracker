import React from 'react';
import { Stack, IconButton, Button, Chip } from '@mui/material';
import { ChevronLeft, ChevronRight, Today } from '@mui/icons-material';
import CustomDatePickerButton from './CustomDatePickerButton';

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
      spacing={1}
      sx={{
        mb: 3,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
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




      <CustomDatePickerButton selectedDate={selectedDate} onDateChange={onDateChange} />

      <IconButton onClick={goToNextDay} size="small">
        <ChevronRight />
      </IconButton>

      {!isToday && (
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