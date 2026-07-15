import { createTheme } from '@mui/material/styles'

export const appTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#7bb8f5',
            light: '#9ccbf8',
            dark: '#4b90d5',
        },
        secondary: {
            main: '#3f6aa0',
        },
        success: {
            main: '#2f7a73',
        },
        warning: {
            main: '#f4a261',
        },
        error: {
            main: '#c65b5b',
        },
        background: {
            default: '#0f1117',
            paper: '#121217',
        },
        text: {
            primary: 'rgba(255,255,255,0.92)',
            secondary: 'rgba(255,255,255,0.68)',
        },
        divider: 'rgba(255,255,255,0.08)',
    },
    shape: {
        borderRadius: 12,
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundColor: '#0f1117',
                    color: 'rgba(255,255,255,0.92)',
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
    },
})

export const dashboardChartColors = [
    '#e07a5f',
    '#2a9d8f',
    appTheme.palette.warning.main,
    '#8fb86a',
    appTheme.palette.secondary.main,
    '#9b5f6b',
]

export const dashboardSpendingSeriesColors = [
    '#e07a5f',
    appTheme.palette.warning.main,
    appTheme.palette.secondary.main,
]

export const dashboardStatusColors = {
    neutral: appTheme.palette.secondary.main,
    positive: appTheme.palette.success.main,
    negative: appTheme.palette.error.main,
    highlight: appTheme.palette.warning.main,
}