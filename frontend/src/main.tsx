/* eslint-disable react-refresh/only-export-components */
import { StrictMode, useMemo, useState } from 'react'
import { Provider } from 'react-redux'
import { store } from './api/store'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { BrowserRouter } from 'react-router-dom'
import SnackbarProvider from './components/SnackbarProvider'

import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { getTheme } from './theme'

// avoid fast-refresh warning for files without exports
export { }

function AppWithTheme() {
  const initial = localStorage.getItem('theme') || 'light'
  const [themeName, setThemeName] = useState(initial)
  const theme = useMemo(() => getTheme(themeName), [themeName])

  const handleSetThemeName = (name: string) => {
    setThemeName(name)
    localStorage.setItem('theme', name)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="app-root">
        <Provider store={store}>
          <BrowserRouter>
            <SnackbarProvider>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <App themeName={themeName} setThemeName={handleSetThemeName} />
              </LocalizationProvider>
            </SnackbarProvider>
          </BrowserRouter>
        </Provider>
      </div>
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithTheme />
  </StrictMode>,
)
