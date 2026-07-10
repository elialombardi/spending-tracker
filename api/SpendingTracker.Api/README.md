# SpendingTracker API

ASP.NET Core app for importing Poste Italiane workbook exports, deduplicating repeated uploads, learning category rules from the descriptions you classify, and reviewing everything from a built-in browser dashboard.

## What it does

- Imports the Poste Italiane `.xlsx` export format in this repository.
- Generates a synthetic fingerprint for each transaction so overlapping uploads do not create duplicates.
- Normalizes the raw description into a reusable merchant key.
- Auto-categorizes transactions when an exact merchant rule already exists.
- Treats `Accrediti` as incoming money, not spending, so they do not appear in the categorization review flow.
- Returns a review queue when a transaction still needs a manual category or only has a weak suggestion.
- Lets you correct already-categorized transactions later, whether the category came from auto-apply or from a manual decision.
- Exposes the saved merchant-to-category mappings so they can be edited or deleted directly.
- Lets you decide which income categories are allowed to open a new spending cycle.
- Persists transactions and rules in SQLite so the learning survives between runs.
- Serves a dashboard at `/` for uploads, review, monthly summaries, and exports.
- Exposes monthly CSV and Excel exports for offline analysis.
- Supports volatile merchants such as Amazon in `always ask` mode, so each payment can be categorized separately.
- Uses the latest matching cycle-defining income as the start of the spending cycle, so if `Salary` arrives on 2026-05-27 the next spending period starts on that date while refunds or transfers can be ignored.

## Run it

```powershell
dotnet run --project .\SpendingTracker.Api
```

The browser dashboard is now a React + Vite app under `frontend/`.

```powershell
Set-Location .\SpendingTracker.Api\frontend
npm install
npm run build
```

`npm run build` writes the production frontend into `wwwroot`, which is what ASP.NET Core serves.

For frontend development with hot reload:

```powershell
Set-Location .\SpendingTracker.Api\frontend
npm run dev
```

The Vite dev server runs on `http://localhost:5173` and proxies `/api` calls to the API on `http://localhost:5188`.

The SQLite database is created automatically at `App_Data/spending-tracker.db`.

API authentication is now required for every endpoint except `POST /api/auth/token` and the development OpenAPI document. In development, bootstrap a bearer token with the default credentials from `appsettings.Development.json`, then send `Authorization: Bearer <token>` on subsequent requests. In production, override the `Auth` section with a strong signing key and your own users.

Frontend implementation details are documented in [docs/frontend-auth.md](docs/frontend-auth.md).

Open the root URL shown by ASP.NET Core in the terminal to use the dashboard.

## Main endpoints

- `POST /api/auth/token` returns a JWT bearer token for a configured API user.
- `POST /api/imports/poste-italiane` uploads a workbook and imports new transactions.
- `GET /api/transactions?needsReview=true` lists transactions that still need a category.
- `POST /api/transactions/{transactionId}/categorize` assigns a category and optionally stores a reusable rule.
- The same categorize endpoint also accepts `ruleBehavior: "AlwaysReview"` for merchants that should never auto-apply a single category.
- `GET /api/transactions/summary?from=2026-05-01&to=2026-06-30` returns spend grouped by category.
- `GET /api/categories` lists known categories, rule counts, and categorized transaction counts.
- `GET /api/categories/cycle-income` lists the income categories that can define a cycle and whether the app is still falling back to all income transactions.
- `PUT /api/categories/cycle-income` replaces the saved set of income categories that are allowed to start a cycle.
- `GET /api/categories/mappings` lists the saved merchant mappings.
- `PUT /api/categories/mappings/{mappingId}` updates a saved mapping.
- `DELETE /api/categories/mappings/{mappingId}` removes a saved mapping.
- `GET /api/reports/cycles` lists the available income cycles, keyed by their exact start date.
- `GET /api/reports/cycle?cycleStart=2026-05-27` returns the selected income cycle, including the breakdown, top merchants, and largest expenses.
- `GET /api/reports/cycle/export?cycleStart=2026-05-27&format=csv` downloads the selected cycle as CSV.
- `GET /api/reports/cycle/export?cycleStart=2026-05-27&format=xlsx` downloads the selected cycle as Excel.
- `GET /api/reports/monthly?year=2026&month=6` still resolves the income-anchored cycle for a reference month when you need month-based lookup.

## Dashboard workflow

1. Open `/` in the browser.
2. Upload the latest workbook from the import panel.
3. Review the uncertain transactions in the review queue.
4. Use `Remember category for merchant` for stable merchants like recurring subscriptions or supermarkets.
5. Use `Always ask for this merchant` for volatile merchants like Amazon where each payment may mean something different.
6. Use the nested tabs inside `Import` for `Fix an existing category`, `Manage category mappings`, and `Cycle-defining incomes`.
7. Choose the exact cycle start from the header selector instead of browsing by reference month.
8. Export the selected cycle to CSV or Excel from the header buttons.

## Typical workflow

1. Upload the latest Excel export.
2. Read the `reviewQueue` returned by the import response.
3. Categorize stable merchants with `saveRule=true` and `ruleBehavior="AutoApply"`.
4. Categorize variable merchants with `saveRule=true` and `ruleBehavior="AlwaysReview"`.
5. Upload the next export later in the month. Stable merchants auto-categorize, while always-review merchants stay in the queue.
