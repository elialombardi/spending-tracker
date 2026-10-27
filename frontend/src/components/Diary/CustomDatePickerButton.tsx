import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { IconButton, Popover, Box } from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { useState } from 'react';

export default function CustomDatePickerButton({ selectedDate, onDateChange }) {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleChange = (newValue) => {
    if (newValue) {
      onDateChange(newValue);
    }
    handleClose();
  };

  return (
    <>
      <IconButton
        aria-label="Choose diary date"
        onClick={handleClick}
        color="primary"
        sx={{
          fontFamily: '"Courier New", monospace',
          fontSize: '0.9rem',
          borderRadius: 1,
          bgcolor: 'background.paper',
          border: (theme) => `1px solid ${theme.palette.divider}`,
          padding: '8px',
          '&:hover': {
            bgcolor: 'action.hover',
          }
        }}
      >
        <CalendarTodayIcon />
      </IconButton>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 1 }}>
          <DateCalendar
            value={selectedDate || new Date()}
            onChange={handleChange}
            sx={{
              // Remove the default toolbar if you want cleaner look
              '& .MuiPickersCalendarHeader-root': {
                paddingLeft: '8px',
                paddingRight: '8px',
              },
              '& .MuiPickersDay-root': {
                fontSize: '0.9rem',
              }
            }}
          />
        </Box>
      </Popover>
    </>
  );
}