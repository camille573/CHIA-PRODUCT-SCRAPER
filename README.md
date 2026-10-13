# CHIA FirstEnroll product updates

Updates the existing workbook's product cells only. No new worksheets, product columns, or layout changes. A check mark records a displayed product, not authorization to sell.

## Current verification

On October 13, 2026, a real Python scan of Tiffany Wilson's public agent page completed all 52 dropdown entries, with zero failures. Her workbook contains 51 state rows; Puerto Rico is not added. A native Google Sheets TEST COPY received 120 check marks across the approved product families. Readback found exactly those 120 content changes, with no changes to Tiffany's license/status/FE STS fields, cell formats, validation, notes or hyperlinks, Master Agent List, or Calc_Data's stored cells and formulas. Calc_Data's calculated outputs may naturally change when source products change.

The original spreadsheet has not been edited. The Google Apps Script runtime has not yet been authorized or tested inside the user's account. Python HTTP parsing and the Apps Script parser have separate tests; the live Sheets menu still needs installation and authorization. Full-roster execution remains gated until that runtime test passes.

## One setup action at a time

First: open the TEST COPY and click **Extensions > Apps Script**. Return to the chat for the next step.

For an administrator completing setup:

1. In the TEST COPY's Apps Script editor, replace Code.gs with this repository's Code.gs.
2. Add an HTML file named Sidebar; paste Sidebar.html.
3. In Project Settings, enable showing appsscript.json. Replace its contents with appsscript.json from this repository. This enables the Sheets v4 advanced service.
4. Save and reload the TEST COPY. Open Tiffany Wilson, then use **FirstEnroll Updates > Refresh Selected State** on Florida's row. Google asks you to authorize spreadsheet, external request, and sidebar access. The user must complete authorization. Do not bypass any organization restrictions.
5. Inspect the result, then Refresh Current Agent. Keep the sidebar open; each state is a separate short invocation. Closing it pauses the pending job; Show Last Scan Result resumes it.
6. After confirming this runtime test, set `testOnly` to false and use Refresh All Agents on the TEST COPY. It discovers representative tabs without renaming or reordering them.
7. Only after reviewing the full test results, install the same bound script in the original workbook. Production rollout is not performed by this repository automatically.

No Python server, API key, public web app, service account, or shared secret is required. Apps Script submits the same public state-search POST form observed in FirstEnroll, then uses the authorized Google Sheets advanced service for atomic value-only writes. The advanced Sheets service requires the Google Sheets OAuth scope (Google's consent screen allows access to spreadsheets); the code always targets only its bound workbook. The user must review and grant this authorization. This is website HTML, not a documented FirstEnroll API; markup changes or access restrictions cause scans to fail and preserve cells. Google reference: https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/batchUpdate

## Matching and protection

The owner approved these product families: SUMMIT, SUMMIT LITE, SIGMA, MED 1st, TRUE HEALTH, TDK, ADV WELL, HCS, GOOD HEALTH, STM. Exact variants observed on Tiffany's page are allowlisted by regex in Code.gs. New variants are reported for review rather than guessed.

STBL GUARD, MED VALUE, ZURICH, BWA and PREMIER have no confirmed mapping, so their cells are preserved. Pax Health, Paramount and Complete Care products are reported as unmatched; no new columns are added. Formulas, validated cells and values other than blank or check mark are preserved and reported. Incomplete responses, failed HTTP requests, duplicate state rows, unknown states, and state confirmation failures never generate cell writes. Successful empty state results clear only confirmed family columns. Red no-sale formatting is never touched.

The run result displays agents/states checked, successful/failed scans, unchecked states, added/removed marks, unmatched products, unmapped columns, warnings, and last successful state scan time. Summaries retain up to 100 unmatched names and 20 warnings. Test mode's Refresh All Agents checks Tiffany only and explicitly remains gated by `FE.testOnly`.

## Windows read-only scanner

With Python 3.10+ installed from python.org, open PowerShell in the downloaded repository:

```powershell
py -m unittest test_scraper -v
py scraper.py --url 'https://manage.firstenroll.com/index.cfm?id=982021' --states FL NY --output scan-result.json
```

Omit `--states FL NY` to enumerate every dropdown state. The Python script uses only standard-library modules and does not modify a workbook. Scan files contain public product listings and remain local. Never commit private workbooks, licenses, credentials or tokens to this public repository.

Scheduled refresh is not enabled. The requested menu is the initial control; unattended scheduling should be added only if requested after deployment has been verified.
