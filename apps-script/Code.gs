/**
 * THE BLUE VALLEY — 3rd Anniversary Livestream
 * Google Apps Script backend for lhab3rd.hindia1024.com
 *
 * Creates one Drive folder per submission:
 *   PARENT_FOLDER / 2026-07-19_14-03-22__Sonny /
 *        ├── photo.jpg
 *        └── info.txt
 * …and appends a row to a master tracking Sheet.
 */

// ====== CONFIG — fill these in ======
const PARENT_FOLDER_ID = 'PASTE_DRIVE_FOLDER_ID_HERE';
const SHEET_ID         = 'PASTE_SPREADSHEET_ID_HERE';
const SHEET_NAME       = 'Submissions';
const TIMEZONE         = 'Asia/Jakarta';
const MAX_BYTES        = 2 * 1024 * 1024;
const ALLOWED_MIME     = ['image/jpeg','image/png','image/webp','image/heic','image/heif'];
// ====================================


function doGet() {
  return json({ ok: true, service: 'blue-valley-uploader' });
}


function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const d = JSON.parse(e.postData.contents);

    // --- validation ---
    if (!d.name || !String(d.name).trim())   return json({ ok:false, error:'Nama kosong.' });
    if (!d.story || !String(d.story).trim()) return json({ ok:false, error:'Cerita kosong.' });
    if (d.consent !== true)                  return json({ ok:false, error:'Consent belum disetujui.' });
    if (!d.fileData)                         return json({ ok:false, error:'Foto tidak ditemukan.' });
    if (ALLOWED_MIME.indexOf(d.mimeType) === -1) return json({ ok:false, error:'Format tidak didukung.' });

    const bytes = Utilities.base64Decode(d.fileData);
    if (bytes.length > MAX_BYTES) return json({ ok:false, error:'File melebihi 2MB.' });

    // --- build folder ---
    const now   = new Date();
    const stamp = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd_HH-mm-ss');
    const name  = String(d.name).trim().slice(0, 60);
    const folderName = stamp + '__' + sanitize(name);

    const parent = DriveApp.getFolderById(PARENT_FOLDER_ID);
    const folder = parent.createFolder(folderName);

    // --- photo ---
    const ext  = extFor(d.mimeType);
    const blob = Utilities.newBlob(bytes, d.mimeType, sanitize(name) + ext);
    const file = folder.createFile(blob);

    // --- info.txt ---
    const info =
      'THE BLUE VALLEY — 3rd Anniversary Livestream\n' +
      '============================================\n\n' +
      'Nama      : ' + name + '\n' +
      'Dikirim   : ' + Utilities.formatDate(now, TIMEZONE, 'dd/MM/yyyy HH:mm:ss') + ' WIB\n' +
      'File      : ' + file.getName() + '\n' +
      'Ukuran    : ' + (bytes.length / 1024).toFixed(0) + ' KB\n' +
      'Consent   : YA\n\n' +
      'Cerita:\n' +
      '--------\n' +
      String(d.story).trim() + '\n';
    folder.createFile('info.txt', info, MimeType.PLAIN_TEXT);

    // --- master sheet log ---
    logToSheet([
      now,
      name,
      String(d.story).trim(),
      file.getUrl(),
      folder.getUrl(),
      file.getName(),
      (bytes.length / 1024).toFixed(0) + ' KB',
      'YA',
      d.userAgent || ''
    ]);

    return json({ ok:true, folder: folder.getUrl(), file: file.getUrl() });

  } catch (err) {
    return json({ ok:false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}


/* ---------- helpers ---------- */

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitize(s) {
  return String(s)
    .replace(/[\\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'anonim';
}

function extFor(mime) {
  switch (mime) {
    case 'image/png':  return '.png';
    case 'image/webp': return '.webp';
    case 'image/heic':
    case 'image/heif': return '.heic';
    default:           return '.jpg';
  }
}

function logToSheet(row) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['Timestamp','Nama','Cerita','Link Foto','Link Folder','Nama File','Ukuran','Consent','User Agent']);
    sh.getRange(1,1,1,9).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  sh.appendRow(row);
}
