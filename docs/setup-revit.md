# ARE Revit Add-in Setup Runbook

Anderson Rohr Engineering · Revit ↔ Web Calculator Integration · Phase 3

This document is Nick's step-by-step guide for installing and configuring the
pyRevit "Send to Calculator" ribbon button. Follow every step in order the first
time. Subsequent Revit projects only need §4 (set ARE_* params on new elements).

---

## Prerequisites

| Item | Version / notes |
|------|----------------|
| Autodesk Revit | 2021 – 2026 |
| pyRevit | 4.8.x or later (free, from pyrevitlabs.io) |
| Internet access | Required to reach calcs.andersonrohr.com |
| ARE_API_KEY | Obtain from Nick / the server's .env.local |

---

## Step 1 – Install pyRevit

1. Download the latest `.exe` installer from https://pyrevitlabs.io.
2. Run the installer (no admin rights required for user-mode install).
3. Launch Revit. You should see the **pyRevit** tab in the ribbon.
4. Verify: pyRevit tab → About → version is 4.8+.

---

## Step 2 – Register the ARE Extension

pyRevit loads extensions from folders that contain an `extension.json` file.

**Option A – Copy extension folder (simplest)**

1. Locate the repo on this machine:
   `C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ARE Web Calcs\anderson-rohr-calcs\revit\ARE.extension`
2. Copy (or move) the entire `ARE.extension` folder to pyRevit's custom extensions directory.
   The default path is:
   `%APPDATA%\pyRevit\Extensions\`
   so the result should be:
   `%APPDATA%\pyRevit\Extensions\ARE.extension\`

**Option B – Point pyRevit to the repo path (best for development)**

1. In Revit: pyRevit tab → Settings → Custom Extension Directories.
2. Add the path:
   `C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ARE Web Calcs\anderson-rohr-calcs\revit`
3. Click Save, then pyRevit tab → Reload.

After either option, a new **ARE** tab should appear in the Revit ribbon with a
**Calculators** panel containing the **Send to Calculator** button.

---

## Step 3 – Bind Shared Parameters to Revit

### 3a – Load the shared-parameter file

1. In Revit: **Manage** tab → **Shared Parameters** (Settings group).
2. Click **Browse…** and navigate to:
   `…\anderson-rohr-calcs\revit\ARE_StructCalc.txt`
3. Click **Open**. The file defines two parameter groups:
   - **ARE Calc Inputs** – seven input parameters (ARE_Mu, ARE_Vu, ARE_Pu,
     ARE_Span, ARE_Lb, ARE_Section, ARE_CalcType).
   - **ARE Calc Writeback** – four output parameters (ARE_DCR, ARE_Status,
     ARE_CalcURL, ARE_CalcDate).
4. Close the Shared Parameters dialog.

### 3b – Add parameters as Project Parameters

Repeat for each parameter you want on each category:

1. Manage tab → **Project Parameters** → **Add…**
2. Choose **Shared parameter** → **Select…** → pick the group and parameter.
3. Set **Instance** (not Type).
4. Under **Categories**, check the boxes for:
   - **Structural Framing** (beams, braces)
   - **Structural Columns**
   - **Walls** (if checking shear wall connections)
5. Under **Parameter group** (the grouping in the Properties palette), pick
   **ARE Calc Inputs** for inputs and **ARE Calc Writeback** for writeback params.
6. Click **OK**.

Repeat for all 11 parameters. After adding them, each structural element's
Properties palette should show an "ARE Calc Inputs" section.

**Tip:** Use a Dynamo script or pyRevit macro to batch-add all 11 parameters at
once if you have many projects.

---

## Step 4 – Fill in ARE_* Parameters on Elements

For each structural element you want to submit to the calculator:

| Parameter | What to enter | Example |
|-----------|---------------|---------|
| ARE_CalcType | One of: `w-to-hss-column`, `base-plate`, `hss-to-hss-branch` | `w-to-hss-column` |
| ARE_Section | AISC_Manual_Label, UPPERCASE | `W16X57` |
| ARE_Mu | Factored moment in **kip-ft** (always kip-ft regardless of calc type) | `60` |
| ARE_Vu | Factored shear in **kips** | `25` |
| ARE_Pu | Factored axial in **kips** (compression positive) | `0` |
| ARE_Span | Member span/length in **inches** | `240` |
| ARE_Lb | Unbraced length in **inches** | `120` |

Leave blank any demand that is zero or not applicable; the script will pass null.

**Section name format:**
- W-shapes: `W18X50`, `W16X57`, `W14X90` (no spaces, uppercase X).
- Square/rect HSS: `HSS10X10X1/2`, `HSS6X6X3/8` (fraction wall, uppercase).
- Round HSS: `HSS10.000X0.500` or `HSS6.625X3/8`.
- If the Revit type name does not match exactly, add a row to
  `revit/section-map.csv` (format: `RevitTypeName,AISC_Manual_Label`).

---

## Step 5 – Create the Config File

1. Open File Explorer; navigate to `%APPDATA%\ARE\` (create the folder if absent).
2. Copy the example file from the repo:
   `…\anderson-rohr-calcs\revit\calc_config.example.json`
   → `%APPDATA%\ARE\calc_config.json`
3. Open `calc_config.json` in Notepad and update:

```json
{
  "base_url": "https://calcs.andersonrohr.com",
  "api_key":  "paste-your-ARE_API_KEY-value-here"
}
```

**Where to find ARE_API_KEY:**
The key is defined in the server's `.env.local` (or the Vercel project environment
variables). Look for `ARE_API_KEY=...`. The value must match exactly — no extra
spaces or quotes.

4. Save the file. **Do not commit `calc_config.json` to git** — it contains a
   secret credential.

---

## Step 6 – End-to-End Test on One Beam

1. In a Revit project, select a structural beam (e.g. W16X57 connected to an HSS column).
2. In Properties, set:
   - `ARE_CalcType` = `w-to-hss-column`
   - `ARE_Section`  = `W16X57`
   - `ARE_Mu`       = `60`    (kip-ft)
3. Click the **ARE** tab → **Calculators** panel → **Send to Calculator**.
4. A dialog asks for the **HSS Column section**. Type `HSS10X10X1/2`. Click OK.
5. The script POSTs to the API. On success you should see a results summary:
   - Status: PENDING (v1 store-only; no engine runs yet)
   - URL: `https://calcs.andersonrohr.com/calcs/w-to-hss-column?id=<uuid>`
6. Check the beam's Properties palette:
   - `ARE_CalcURL` should contain the URL from step 5.
   - `ARE_CalcDate` should contain today's ISO-8601 timestamp.
   - `ARE_Status` should read `PENDING`.
7. Open the URL in a browser — you should see the saved calc pre-loaded.

---

## Step 7 – Multi-select Workflow

- Select multiple beams/columns at once before clicking the button.
- For each element with a different `ARE_CalcType`, the script prompts for the
  required secondary-member details (HSS column, base plate data, HSS chord)
  **once per element** in sequence.
- A summary table shows success/failure for all selected elements at the end.

---

## Troubleshooting

### TLS / "The request was aborted: Could not create SSL/TLS secure channel"

The script explicitly sets TLS 1.2 via `ServicePointManager.SecurityProtocol`.
If you still see this error:

1. Verify Revit is running on .NET 4.5+ (all 2021+ versions are).
2. Open `regedit` and check:
   `HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\.NETFramework\v4.0.30319`
   Set `SchUseStrongCrypto` = `1` (DWORD). Reboot Revit.
3. If behind a corporate proxy/firewall, ask IT to whitelist `calcs.andersonrohr.com`.

### 401 Unauthorized

- Confirm `api_key` in `calc_config.json` exactly matches `ARE_API_KEY` on the server.
- Check for leading/trailing whitespace in either location.
- Rotate `ARE_API_KEY` on the server if the key may have been compromised, then update
  `calc_config.json` to match.

### Section-name mismatches / "ARE_Section is blank"

- Open the element's Properties and confirm `ARE_Section` is set.
- If the Revit type name differs from AISC format (e.g. "W14 COLUMN"), add a mapping
  row to `revit/section-map.csv`:
  ```
  W14 COLUMN,W14X90
  ```
- Reload pyRevit (pyRevit tab → Reload) after editing the CSV — the map is loaded
  fresh on each button click, so a Revit restart is not needed.

### "ARE_CalcType is not valid"

- `ARE_CalcType` must be exactly one of:
  `w-to-hss-column`, `base-plate`, `hss-to-hss-branch`
- All lowercase, hyphens, no trailing spaces.

### Button does not appear in ribbon

- Verify the `ARE.extension` folder is in `%APPDATA%\pyRevit\Extensions\` or in a
  custom directory registered under pyRevit Settings.
- The folder must be named exactly `ARE.extension` (pyRevit recognises `.extension`
  as the magic suffix).
- Click pyRevit tab → Reload and wait for Revit to restart the ribbon.

### Server returns 400 Bad Request

- The Calc State failed server-side JSON Schema validation.
- The error body (shown in the summary dialog) lists the failing field.
- Common causes: `ARE_Section` contains a label not in the AISC v16.0 database;
  a numeric param contains a non-numeric string; `calcType` slug typo.

### ARE_CalcURL / ARE_Status not written back after a successful POST

- Check that the writeback parameters (ARE_DCR, ARE_Status, ARE_CalcURL,
  ARE_CalcDate) are bound to the element's category as **instance** parameters
  (not type parameters). See Step 3b above.
- Read-only parameters cannot be written. Ensure the parameter is not marked
  read-only in Manage → Project Parameters.

---

## Reference: ARE_* Parameter Summary

| Parameter | Type | Group | Direction | Unit / format |
|-----------|------|-------|-----------|---------------|
| ARE_Mu | NUMBER | ARE Calc Inputs | User input | kip-ft |
| ARE_Vu | NUMBER | ARE Calc Inputs | User input | kips |
| ARE_Pu | NUMBER | ARE Calc Inputs | User input | kips (compression +) |
| ARE_Span | NUMBER | ARE Calc Inputs | User input | inches |
| ARE_Lb | NUMBER | ARE Calc Inputs | User input | inches |
| ARE_Section | TEXT | ARE Calc Inputs | User input | AISC_Manual_Label UPPERCASE |
| ARE_CalcType | TEXT | ARE Calc Inputs | User input | calc slug (see above) |
| ARE_DCR | NUMBER | ARE Calc Writeback | Written by button | dimensionless ratio |
| ARE_Status | TEXT | ARE Calc Writeback | Written by button | PASS / FAIL / PENDING |
| ARE_CalcURL | URL | ARE Calc Writeback | Written by button | https://... |
| ARE_CalcDate | TEXT | ARE Calc Writeback | Written by button | ISO-8601 UTC |

---

*For API setup (server-side ARE_API_KEY, database, middleware), see `docs/setup-api.md`.*
