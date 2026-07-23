/* eslint-disable react-refresh/only-export-components */
import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { BrowserRouter } from 'react-router-dom'

import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { getTheme } from './theme'

// avoid fast-refresh warning for files without exports
export { }

function AppWithTheme() {
  const initial = localStorage.getItem('theme') || 'light'
  const [themeName, setThemeName] = useState<string>(initial)
  const theme = useMemo(() => getTheme(themeName), [themeName])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="app-root">
        <BrowserRouter>
          <App themeName={themeName} setThemeName={setThemeName} />
        </BrowserRouter>
      </div>
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <AppWithTheme />
  </StrictMode>,
)
