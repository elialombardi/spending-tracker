# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Category selection

Category pickers support selecting existing categories by mouse, touch, or
keyboard, as well as typing a new category. Custom option rendering must preserve
MUI's option props, including `data-option-index`, accessibility attributes, and
event handlers, so the selected category matches the clicked or highlighted item.

## Date pickers

The app root provides a shared MUI X `LocalizationProvider` with `AdapterDateFns`
for all routes, including lazy-loaded pages and picker dialogs. Render standalone
picker components under the same provider in tests or previews.

After changing frontend code or dependencies, rebuild and redeploy the Docker
image; restarting an existing container does not update its bundled JavaScript.

For Vite development, the picker entry points are prebundled together to share
one localization context. If the context error persists after dependency changes,
stop the development server and restart it with `npm run dev -- --force`, then
reload the page. Avoid running multiple Vite servers with different configurations
against the same dependency cache.

## Mobile navigation

Tap a section heading in the mobile navigation drawer to expand or collapse its
links without closing the drawer. Selecting a link closes the drawer and navigates
to that page. Tapping the backdrop or pressing Escape also dismisses the drawer;
Tab moves focus without dismissing it.

## Search configuration

Place search supports these providers through environment configuration:

- `VITE_PLACE_SEARCH_PROVIDER=nominatim`
- `VITE_PLACE_SEARCH_PROVIDER=geoapify`
- `VITE_GEOAPIFY_API_KEY=your-geoapify-key`

When `VITE_PLACE_SEARCH_PROVIDER` is set to `geoapify`, the frontend calls Geoapify's forward geocoding API and requires `VITE_GEOAPIFY_API_KEY` to be present.
