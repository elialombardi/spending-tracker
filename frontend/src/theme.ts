import { createTheme } from '@mui/material/styles'

function baseComponents(overrides: any = {}) {
    return {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                colorTransparent: {
                    backgroundImage: 'none',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
            },
        },
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },
            styleOverrides: {
                root: {
                    borderRadius: 10,
                    textTransform: 'none',
                },
            },
        },
        MuiToggleButton: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                    textTransform: 'none',
                },
            },
        },
        ...overrides,
    }
}

export const appTheme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#1976d2',
            light: '#4dabf5',
            dark: '#115293',
        },
        secondary: {
            main: '#556cd6',
        },
        success: {
            main: '#2e7d32',
        },
        warning: {
            main: '#f4a261',
        },
        error: {
            main: '#c62828',
        },
        background: {
            default: '#ffffff',
            paper: '#f6f7fb',
        },
        text: {
            primary: 'rgba(13,17,23,0.92)',
            secondary: 'rgba(13,17,23,0.6)',
        },
        divider: 'rgba(13,17,23,0.08)',
    },
    shape: {
        borderRadius: 12,
    },
    components: {
        ...baseComponents({
            // any theme-specific overrides
        }),
    },
})

export function getTheme(name = 'light') {
    if (name === 'dark') {
        return createTheme({
            palette: {
                mode: 'dark',
                primary: { main: '#7bb8f5', light: '#9ccbf8', dark: '#4b90d5' },
                secondary: { main: '#3f6aa0' },
                success: { main: '#2f7a73' },
                warning: { main: '#f4a261' },
                error: { main: '#c65b5b' },
                background: { default: '#0f1117', paper: '#121217' },
                text: { primary: 'rgba(255,255,255,0.92)', secondary: 'rgba(255,255,255,0.68)' },
                divider: 'rgba(255,255,255,0.08)',
            },
            shape: { borderRadius: 12 },
            components: baseComponents(),
        })
    }

    if (name === 'solarized') {
        // Solarized Dark-ish palette
        return createTheme({
            palette: {
                mode: 'dark',
                primary: { main: '#268bd2', light: '#5aa9e6', dark: '#0b6fa2' },
                secondary: { main: '#2aa198' },
                success: { main: '#859900' },
                warning: { main: '#b58900' },
                error: { main: '#dc322f' },
                background: { default: '#002b36', paper: '#073642' },
                text: { primary: 'rgba(238,232,213,0.95)', secondary: 'rgba(238,232,213,0.7)' },
                divider: 'rgba(238,232,213,0.06)',
            },
            shape: { borderRadius: 12 },
            components: baseComponents(),
        })
    }

    // default: light
    return appTheme
}

export const dashboardChartColors = [
    '#e07a5f',
    '#2a9d8f',
    (appTheme as any).palette.warning.main,
    '#8fb86a',
    (appTheme as any).palette.secondary.main,
    '#9b5f6b',
]

export const dashboardSpendingSeriesColors = [
    '#e07a5f',
    (appTheme as any).palette.warning.main,
    (appTheme as any).palette.secondary.main,
]

export const dashboardStatusColors = {
    neutral: (appTheme as any).palette.secondary.main,
    positive: (appTheme as any).palette.success.main,
    negative: (appTheme as any).palette.error.main,
    highlight: (appTheme as any).palette.warning.main,
}
