/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'

import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { appTheme } from './theme.js'

// avoid fast-refresh warning for files without exports
export { }

function AppWithTheme() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <div className="app-root">
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </div>
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppWithTheme />
  </StrictMode>,
)
