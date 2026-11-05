# Ava Labs 2027 OKR dashboard

A static page (`index.html`) plus one serverless function (`api/okrs.js`). The function fetches the 2027 tab from a small Google Apps Script attached to the OKR workbook, so no Google Cloud project is needed. The page refreshes every 60 seconds and whenever the browser tab regains focus, so sheet edits show up without a redeploy.

## One-time setup

### 1. Add the script to the sheet (needs edit access to the workbook)
1. Open the OKR workbook, then Extensions > Apps Script.
2. Replace the contents of `Code.gs` with the file in `apps-script/Code.gs`.
3. Project Settings (gear icon) > Script properties > Add script property. Name it `TOKEN` and set the value to a long random string. Save it, you will need it again in step 3.
4. Deploy > New deployment > type Web app.
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Authorize when prompted, then copy the web app URL (it ends in `/exec`).

"Anyone" only means the URL can be called without a Google login. Every request is rejected unless it carries the `TOKEN`, and only the Vercel function knows it.

### 2. If "Anyone" is not available
Some Google Workspace admins disable it. If the option is missing or the dashboard reports "did not return JSON", ask your Google admin to allow Apps Script web apps with Anyone access for this script, or tell me and I will look at another route.

### 3. Deploy on Vercel
1. Add two environment variables (Project > Settings > Environment Variables):
   - `APPS_SCRIPT_URL`: the `/exec` URL from step 1
   - `APPS_SCRIPT_TOKEN`: the same value you set as `TOKEN`
2. Run `vercel` in this folder, or import the folder as a Vercel project. No build step is needed.
3. Turn on Deployment Protection (Project > Settings > Deployment Protection) before sharing the URL. The dashboard shows internal OKRs.

### Later changes to the script
After editing `Code.gs`, use Deploy > Manage deployments > Edit > New version so the `/exec` URL keeps working.

## Local preview

`vercel dev` runs the page and the API together, using a `.env.local` file with the two variables. Opening `index.html` directly will not work because it needs `/api/okrs`.

## What the page reads

Columns A to P of the tab, found by structure rather than fixed row numbers:

- A row with `Objective:` in column A starts an objective. The row beneath it supplies that objective's progress from column M.
- A row with text in column C and a value in column I is a key result. Column I (Metric) is used to show Yes/No values as Yes/No but is never displayed.
- Progress comes from the sheet's own column M, so the dashboard always matches the sheet. `??` shows as TBD.
- Overall progress, start date and end date come from the labeled cells in columns I and K near the top.

Adding or removing key results or objectives on the tab needs no code change. Keep the `Objective:` label in column A and the `Start Date:` / `End Date:` / `Overall Progress:` labels where they are. To point at a different tab, change `GID` at the top of `Code.gs`.
