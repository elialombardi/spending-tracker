# Spending Tracker Frontend

React + Vite frontend for the Spending Tracker dashboard.

## Commands

```powershell
npm install
npm run dev
npm run build
```

## Development

- `npm run dev` starts the Vite dev server on `http://localhost:5173`.
- `/api` requests are proxied to `http://localhost:5188`.
- Keep the ASP.NET Core API running while using the Vite dev server.

## Production build

- `npm run build` emits the compiled dashboard into `../wwwroot`.
- ASP.NET Core serves those built files through its existing static-file pipeline.
