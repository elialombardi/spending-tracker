import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import DashboardApp from './legacy/App';
import { alpha, ThemeProvider, CssBaseline, GlobalStyles } from '@mui/material';
import { appTheme } from '../theme';

function DashboardRoot() {
    const hostRef = useRef(null);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return undefined;

        const mountNode = document.createElement('div');
        mountNode.className = 'dashboard-page';
        host.appendChild(mountNode);

        const root = createRoot(mountNode);

        root.render(
            <ThemeProvider theme={appTheme}>
                <CssBaseline />
                <GlobalStyles
                    styles={(theme) => ({
                        '.page-glow': { display: 'none' },
                        '.dashboard-page': { padding: '16px', background: 'transparent', color: 'inherit' },
                        '.shell': { maxWidth: '1180px', margin: '0 auto' },
                        '.panel': {
                            borderRadius: theme.shape.borderRadius,
                            background: alpha(theme.palette.common.white, 0.03),
                            boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
                            border: `1px solid ${alpha(theme.palette.common.white, 0.04)}`,
                            padding: '16px',
                        },
                        '.dashboard-page .MuiPaper-root': {
                            background: `${alpha(theme.palette.common.white, 0.03)} !important`,
                            color: 'inherit',
                        },
                        '.dashboard-page .panel, .dashboard-page .paper, .dashboard-page article': {
                            background: `${alpha(theme.palette.common.white, 0.03)} !important`,
                        },
                        '.comparison-panel, .spending-comparison-panel, .current-month-trends-panel': {
                            minHeight: '50vh',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-start',
                        },
                        '.comparison-pie-grid, .spending-comparison-layout': {
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'stretch',
                            height: '100%',
                            width: '100%'
                        },
                        '.spending-comparison-chart-shell': {
                            flex: '2 1 0',
                            minWidth: 220,
                            display: 'flex',
                            alignItems: 'stretch',
                        },
                        '.spending-comparison-chart-frame': {
                            flex: '1 1 0',
                            minHeight: '320px',
                            height: '320px',
                            width: '100%',
                            display: 'flex',
                            alignItems: 'stretch',
                        },
                        '.spending-comparison-chart-frame > div': {
                            height: '100% !important',
                            minHeight: '320px',
                        },
                        '.spending-comparison-series-grid': {
                            flex: '0 0 360px',
                            maxWidth: '420px',
                            overflow: 'auto',
                            padding: '8px',
                            boxSizing: 'border-box',
                        },
                        '.current-month-summary-grid': {
                            display: 'grid',
                            gap: '12px',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                            marginBottom: '16px',
                        },
                        '.current-month-summary-card': {
                            minHeight: '112px',
                        },
                        '.current-month-chart-shell': {
                            display: 'flex',
                            minHeight: '280px',
                        },
                        '.current-month-chart-frame': {
                            flex: '1 1 0',
                            minHeight: '280px',
                            width: '100%',
                        },
                        '.current-month-chart-frame > div': {
                            minHeight: '280px',
                        },
                        '.comparison-pie-card, .spending-series-card': {
                            flex: '1 1 0',
                            minWidth: 0,
                            padding: '14px',
                            marginBottom: '10px',
                            borderRadius: 8,
                            background: `${alpha(theme.palette.common.white, 0.04)} !important`,
                            color: theme.palette.text.primary
                        },
                        '.spending-series-card .spending-series-copy strong': {
                            fontSize: '15px',
                            color: theme.palette.text.primary
                        },
                        '.spending-series-card .spending-series-copy span': {
                            color: theme.palette.text.secondary,
                            fontSize: '13px'
                        },
                        '.spending-series-meta span': {
                            display: 'block',
                            color: theme.palette.text.secondary,
                            marginTop: '8px',
                        },
                        '.comparison-pie-visual': {
                            borderRadius: 8,
                            height: '160px',
                            marginBottom: 8,
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'visible',
                        },
                        '.comparison-pie-visual svg': {
                            width: '160px',
                            height: '160px',
                            display: 'block',
                        },
                        '.comparison-pie-center': {
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            textAlign: 'center',
                            pointerEvents: 'none',
                            width: '72%',
                            maxWidth: '120px',
                            whiteSpace: 'normal',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        },
                        '.comparison-pie-center .metric-label': {
                            color: theme.palette.text.secondary,
                            fontSize: '12px',
                            display: 'block',
                            marginBottom: '4px',
                        },
                        '.comparison-pie-center strong': {
                            color: theme.palette.text.primary,
                            fontSize: '16px',
                            fontWeight: 700,
                            display: 'block',
                            lineHeight: 1.1,
                        },
                        '.comparison-pie-legend .comparison-pie-swatch': {
                            width: 14,
                            height: 14,
                            borderRadius: 3,
                            display: 'inline-block',
                            marginRight: 8,
                        },
                        '.comparison-pie-legend': {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                        },
                        '.comparison-pie-legend-item': {
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'flex-start',
                            marginBottom: 4,
                        },
                        '.comparison-pie-legend-copy': {
                            display: 'flex',
                            flexDirection: 'column',
                            lineHeight: 1.1,
                            minWidth: 0,
                            wordBreak: 'break-word',
                        },
                        '.comparison-pie-legend-copy strong': { color: theme.palette.text.primary, display: 'block', fontSize: '15px', fontWeight: 700 },
                        '.comparison-pie-legend-copy span': { color: theme.palette.text.secondary, display: 'block', marginTop: 2, fontSize: '13px' },
                        '.button': {
                            border: 'none',
                            padding: '8px 14px',
                            borderRadius: 9999,
                            background: theme.palette.primary.main,
                            color: theme.palette.primary.contrastText,
                            cursor: 'pointer',
                        },
                        '.button.button-ghost': {
                            background: 'transparent',
                            color: 'inherit',
                            border: `1px solid ${theme.palette.divider}`,
                        },
                        '.tab-button': {
                            background: 'transparent',
                            borderRadius: 8,
                            padding: '10px 14px',
                            display: 'inline-block',
                            marginRight: 8,
                        },
                        '.tab-button.is-active': {
                            background: alpha(theme.palette.primary.main, 0.12),
                            boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.18)}`,
                        },
                        '.tab-count, .money-pill, .tag': {
                            background: alpha(theme.palette.common.white, 0.04),
                            color: theme.palette.text.primary,
                            padding: '4px 8px',
                            borderRadius: 9999,
                            display: 'inline-block',
                        },
                        '.category-bar-track': {
                            width: '100%',
                            height: 10,
                            borderRadius: 9999,
                            background: alpha(theme.palette.common.white, 0.08),
                            overflow: 'hidden',
                            marginTop: 10,
                        },
                        '.category-bar-fill-bg': {
                            height: '100%',
                            borderRadius: 'inherit',
                            background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.95)} 0%, ${alpha(theme.palette.primary.light, 0.9)} 100%)`,
                        },
                        '.upload-dropzone': {
                            border: `1px dashed ${alpha(theme.palette.common.white, 0.06)}`,
                            borderRadius: 12,
                            padding: '18px',
                            background: 'transparent',
                        },
                        '.toast': {
                            position: 'fixed',
                            right: 16,
                            bottom: 16,
                            background: alpha(theme.palette.common.white, 0.04),
                            color: theme.palette.text.primary,
                            padding: '10px 14px',
                            borderRadius: 8,
                        },
                        'h1, h2, h3': { color: theme.palette.text.primary },
                        '.hero-text, .section-note': { color: theme.palette.text.secondary },
                    })}
                />
                <DashboardApp />
            </ThemeProvider>,
        );

        return () => {
            // Unmount asynchronously to avoid "synchronously unmount a root while React was already rendering" warning
            Promise.resolve().then(() => {
                try {
                    root.unmount();
                } catch {
                    // ignore unmount errors during teardown
                }
                if (mountNode.parentNode === host) {
                    host.removeChild(mountNode);
                }
            });
        };
    }, []);

    return <div ref={hostRef} />;
}

export default DashboardRoot;
