# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Dependency updates

Keep TypeScript on 6.0.x while `typescript-eslint` requires TypeScript below 6.1.
Check its peer dependency range before upgrading to TypeScript 7.

## Quality and performance checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run benchmark:bundles
```

Tests use Node's test runner and the installed Vite module loader; no additional
test framework is required. They cover location/tag cache invalidation,
account transitions, sync-completion refresh, and dashboard request reuse.
Changing client-side dashboard page sizes no longer reloads the request graph.
Changing cycles or leaving the page aborts the previous load.

The bundle benchmark builds isolated eager/lazy variants in temporary directories
and cleans them up. It sums the HTML entry script and module-preloaded JavaScript,
including gzip sizes, rather than comparing only a single chunk. A representative
run reduced startup JavaScript from 867.6 KB / 271.0 KB gzip to 682.4 KB /
216.4 KB gzip by lazy-loading Diary and YouTube. These numbers exclude CSS and
the protected route loaded after login. The shared localization provider remains
at the root.

Locations and location tags now come directly from RTK Query, not dummy data,
localStorage, or duplicate component copies. Mutations invalidate the relevant
lists and details; account changes and logout reset user-specific query caches.
Location tag endpoint names are distinct from YouTube tag endpoint names.

YouTube status polls every two seconds only while a job is pending/running.
Sync mutations refresh status, and job completion refreshes channels and videos;
starting a job no longer needlessly reloads data before the worker finishes.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Category selection

Category pickers support selecting existing categories by mouse, touch, or
keyboard, as well as typing a new category. Custom option rendering must preserve
MUI's option props, including `data-option-index`, accessibility attributes, and
event handlers, so the selected category matches the clicked or highlighted item.

## Location editing

The update mutation takes `{ id, location: payload }` and sends the location
fields directly as the JSON body of `PUT /api/locations/:id`.

The places page shows saved locations and a map together, without opening a
drawer. Search matches all entered words across names, descriptions, and tags;
tag chips narrow both the list and map. **All places** clears the tag selection
while keeping the search; **Reset filters** clears both. Select a place to focus
its pin, or select a pin to highlight its place. **Show all** fits the map to the
current results. Locations with invalid coordinates remain in the list with a
warning so writable accounts can correct them. On small screens the map appears
above the scrollable list. Reader accounts can explore but cannot add or edit.

Choose **Add location** or the pencil beside a saved place to edit its **Tags**.
Select existing tags, or type a new name and press Enter; use a tag's X to remove
it, then save the location. On mobile, **Location details and tags** starts
expanded. Admins can use **Manage tags** beside **Add location** to create,
rename, or delete tags globally; renaming updates all linked locations.

To check the browser flow, sign in with a writable account and choose the edit
button beside a place. Change the title, description, URL,
coordinates, and tags, then save. Verify that the request has a nonempty JSON
body, the saved values appear in the list and map, and the changes survive a reload.
If saving fails, the dialog should remain open and show the error.

## Date pickers

The app root provides a shared MUI X `LocalizationProvider` with `AdapterDateFns`
for all routes, including lazy-loaded pages and picker dialogs. Render standalone
picker components under the same provider in tests or previews.

The diary calendar derives its selected day from navigation state. Its URL
updater is stable and skips unchanged dates, preserving other query parameters
without repeated history updates. To check the lazy route, open the diary
calendar, select a day, then use Alt+Left/Right; the heading, calendar, URL, and
entry must all follow the selected day.

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
