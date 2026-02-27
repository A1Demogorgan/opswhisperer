# COO Ops Cockpit (Next.js 16)

Demo-grade COO operations dashboard for quarterly revenue attainment via BPM conversion.

## Stack
- Next.js 16 App Router + TypeScript
- Tailwind CSS
- Recharts
- In-app deterministic mock API (route handlers)

## Run
```bash
npm install
npm run dev
```

## Azure OpenAI (Leadership Chat)
Leadership chat can use Azure OpenAI when these env vars are set:

- `AZURE_OPENAI_ENDPOINT` (example `https://<resource>.openai.azure.com`)
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT` (your chat model deployment name)
- `AZURE_OPENAI_API_VERSION` (optional, default `2024-10-21`)

Behavior:
- If Azure OpenAI env vars are present, `/api/leadership-chat` calls Azure OpenAI.
- If not configured (or Azure call fails), it falls back to local rule-based responses.

## Routes
- `/` Executive Overview
- `/diagnostics` Why / Why Not diagnostic decomposition
- `/planning` Next quarter forecast with scenario multipliers
- `/actions` Action Center + what-if simulator
- `/slices` Sector x Service Line matrix drilldown
- `/accounts` Leaderboard and top/bottom lists
- `/accounts/[id]` Account narrative and demand details

## Core calculations
- `QTD` = quarter-to-date as of system date (or `todayOverride` in config).
- `Forecast Revenue` = `QTD Actual Revenue / elapsed_quarter_ratio`.
- `Sold BPM` = `Sold Revenue / blended_rate_usd_per_bpm` (dominant service line for filtered slice).
- `Actual BPM (Net)` = `RU BPM QTD - RD BPM QTD`.
- `RU` = billed starts in quarter.
- `RD` = prior-period billed resources ending/reducing in quarter.
- `Forecast BPM` = `Forecast Revenue / blended rate`.
- `Demand Open BPM` = open demand quantity prorated by remaining billable days (30-day BPM month).
- `TTF` = `demand_start_date -> billable_start_date` (or `TTF_so_far` if not billed).
- `TTF breach` = `TTF > historical_avg_service_line + ttf_threshold_days`.

## Config
Edit [`config.ts`](./config.ts):
- `sectors`
- `serviceLines`
- `blendedRateByServiceLine`
- `ttfThresholdDays` (default 7)
- `pipelineConversionRates` (global + by service line)
- `todayOverride`
- `revenueTargetUsdByQuarter`

## Data model
Typed models are in [`lib/models.ts`](./lib/models.ts).
Deterministic seeded generator is in [`lib/data.ts`](./lib/data.ts).
Metrics engine is in [`lib/metrics.ts`](./lib/metrics.ts).
Assistant engine is in [`lib/assistant.ts`](./lib/assistant.ts).

## Assistant behavior
The right-side COO Assistant is rule-based:
- fuzzy intent matching (target, diagnostics, planning, actions, TTF)
- returns short answer, driver bullets, deep links, and recommended actions
- no external LLM dependency

## Operational drillability
All major gap views are connected to contributors through:
- account leaderboard links
- diagnostics sections
- action deep links
- matrix and account drilldowns

## Mock API endpoints
- `GET /api/dashboard`
- `POST /api/assistant`
- `GET /api/account/[id]`
