# The Blue Valley — 3rd Anniversary Livestream
Static site for `lhab3rd.hindia1024.com`

## Structure
```
/index.html
/css/style.css
/js/main.js
/ASSETS/            all design assets (bg, logos, svg headings, polaroids)
/apps-script/Code.gs  Google Apps Script backend (deploy separately)
/CNAME              lhab3rd.hindia1024.com
/.nojekyll
```

## Setup (3 steps)

### 1. Google Drive + Sheet
- Create a Drive folder, e.g. `LHAB 3RD — Submissions`. Copy the ID from the URL
  (`drive.google.com/drive/folders/<THIS_PART>`).
- Create a blank Google Sheet. Copy the ID from its URL.

### 2. Apps Script
- script.google.com → New project → paste `apps-script/Code.gs`.
- Fill in `PARENT_FOLDER_ID` and `SHEET_ID`.
- Deploy → New deployment → **Web app**
  - Execute as: **Me**
  - Who has access: **Anyone**
- Copy the `/exec` URL → paste into `ENDPOINT` at the top of `js/main.js`.

> Re-deploy as a **New version** every time you edit `Code.gs`, or the live URL keeps the old code.

### 3. GitHub Pages
- Push this repo, Settings → Pages → deploy from `main` / root.
- Custom domain: `lhab3rd.hindia1024.com`, enforce HTTPS.
- On Squarespace DNS add a CNAME:
  `lhab3rd` → `<github-username>.github.io`

## Notes
- Max upload 2MB, enforced client-side and again in Apps Script.
- Each submission creates `YYYY-MM-DD_HH-mm-ss__Nama/` containing the photo + `info.txt`.
- Add `terms.html` and `privacy.html` (linked from the form and footer).
- Add `ASSETS/OG.jpg` (1200×630) for social sharing previews.
