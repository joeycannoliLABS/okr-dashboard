# Ava Labs OKR dashboard

A company-wide OKR dashboard: one page per year with a roll-up across all departments, and a page per department. It reads each department's OKR sheet live, so edits in the sheets show up on the dashboard without a redeploy.

- `index.html` — the dashboard (sidebar, company overview, department pages)
- `api/okrs.js` — Vercel function that fetches and parses the sheets
- `lib/parse.js` — turns sheet rows into dashboard JSON
- `apps-script/Code.gs` — the script that lives in a Google Sheet and reads every department
- `vercel.json` — raises the function timeout, since 13 workbooks are read per request

## Upgrading from the single-department version

The Vercel environment variables (`APPS_SCRIPT_URL`, `APPS_SCRIPT_TOKEN`) and the `TOKEN` script property stay as they are. Two things change:

1. **Replace `Code.gs`** in the Apps Script project with the new version, then **Deploy > Manage deployments > pencil icon > Version: New version > Deploy**. The `/exec` URL stays the same.
2. **Re-authorize.** The new script reads 13 workbooks instead of one and calls the Sheets API directly, so Google asks for permission again the first time it runs. Open the `/exec` URL with `?token=...` in your browser once and accept the prompt.
3. Push the new files to the Vercel project and let it redeploy.

## First-time setup

1. In any one of the OKR workbooks, open Extensions > Apps Script and paste in `apps-script/Code.gs`.
2. Project Settings (gear icon) > Script Properties > add `TOKEN` with a long random value.
3. Deploy > New deployment > Web app, Execute as **Me**, Who has access **Anyone**. Authorize, then copy the `/exec` URL.
4. In Vercel, add `APPS_SCRIPT_URL` (the `/exec` URL) and `APPS_SCRIPT_TOKEN` (the same token, as a secret), then deploy.
5. Turn on Deployment Protection so only the Vercel team can open it.

Whoever deploys the script must have at least view access to every department workbook, because the script runs as that person.

## Adding or changing departments

Edit the `DEPARTMENTS` list at the top of `Code.gs`: slug, display name, group, and the workbook ID (the long string in the sheet URL). Then publish a new version of the deployment. No change to the Vercel project is needed.

## How tabs are found

The dashboard looks for a tab named after the year: `2026`, `2027`, and so on. All 13 departments have a `2026` tab. Departments whose tab is named something else need an entry in `TAB_OVERRIDES` in `Code.gs` — BD/EG's 2027 tab is currently "2027 Proposed" and is already listed there.

A department with no tab for that year shows as "No 2026 tab yet" on the overview and keeps its place in the sidebar. As soon as the tab is created, it appears with no code change.

## What the dashboard reads

Columns A to P of each year tab, found by structure rather than fixed row numbers:

- A row with `Objective:` in column A starts an objective. The rows beneath it supply the objective's progress (column M) and its Committed/Aspirational label (column P or K).
- A row with text in column C and a value in column I is a key result. Column I (Metric) drives formatting but is never displayed.
- Progress comes from each sheet's own Progress column, so the dashboard always matches the sheet. A `??` or `-` shows as a dash.
- Overall progress, the department name, and the cycle dates come from the labeled cells near the top.
- A key result with the Yes/No metric shows Yes/No only when it runs 0 to 1. Departments that use Yes/No for counts (such as "9 of 12") keep their numbers.

Keep the `Objective:` label in column A and the `Business Unit/Team:`, `Overall Progress:`, `Start Date:` and `End Date:` labels where they are, and any number of objectives and key results will be picked up.

## Speed

Reading 13 workbooks takes a few seconds. The script fetches them in parallel, the Vercel response is cached at the edge for 60 seconds, and the browser refreshes every two minutes and whenever you return to the tab. The first request after a cold start is the slowest.
