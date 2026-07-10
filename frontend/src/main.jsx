/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'

import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

function getCssVar(name, fallback = '') {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  } catch {
    return fallback
  }
}

// avoid fast-refresh warning for files without exports
export { }

function AppWithTheme() {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  const mode = prefersDark ? 'dark' : 'light'
  const accent = getCssVar('--accent', '#6b5cff')
  const bg = getCssVar('--bg', mode === 'dark' ? '#16171d' : '#fff')
  const text = getCssVar('--text', mode === 'dark' ? '#9ca3af' : '#6b6375')
  const textH = getCssVar('--text-h', mode === 'dark' ? '#f3f4f6' : '#08060d')
  const border = getCssVar('--border', '#e5e4e7')
  const accentBg = getCssVar('--accent-bg', 'rgba(106,90,255,0.08)')
  const accentBorder = getCssVar('--accent-border', 'rgba(106,90,255,0.35)')

  const theme = createTheme({
    palette: {
      mode,
      primary: { main: accent },
      background: { default: bg, paper: bg },
      text: { primary: textH, secondary: text },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: bg,
            color: text,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: 'transparent',
            color: textH,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: border,
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: accentBorder,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: accent,
            },
            input: {
              color: textH,
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            color: textH,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            backgroundColor: accentBg,
            color: textH,
          },
        },
      },
    },
  })

  return (
    <ThemeProvider theme={theme}>
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
