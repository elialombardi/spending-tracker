import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      '@mui/x-date-pickers/AdapterDateFns',
      '@mui/x-date-pickers/DateCalendar',
      '@mui/x-date-pickers/DatePicker',
      '@mui/x-date-pickers/LocalizationProvider',
    ],
  },
})
