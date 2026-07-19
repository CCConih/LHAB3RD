/* =========================================================
   THE BLUE VALLEY — submission handler
   Posts to a Google Apps Script Web App which creates one
   Drive folder per submission (photo + info.txt) and logs
   a row to a master Google Sheet.
   ========================================================= */

/* ⬇⬇⬇  PASTE YOUR APPS SCRIPT /exec URL HERE  ⬇⬇⬇ */
const ENDPOINT = "https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXX/exec";

const MAX_INPUT   = 15 * 1024 * 1024;             // max file the user may pick
const MAX_EDGE    = 2000;                         // longest side after downscale, px
const TARGET_BYTES= 1.6 * 1024 * 1024;            // aim to land under this
const ALLOWED     = ["image/jpeg","image/png","image/webp"];

const $ = (id) => document.getElementById(id);

const form        = $("submission-form");
const dropzone    = $("dropzone");
const fileInput   = $("file-input");
const dzText      = $("dropzone-text");
const preview     = $("preview");
const clearBtn    = $("clear-file");
const nameInput   = $("name");
const story       = $("story");
const storyCount  = $("story-count");
const consent     = $("consent");
const submitBtn   = $("submit-btn");
const statusEl    = $("form-status");
const successEl   = $("success");

const fileMeta  = $("file-meta");

let selectedFile = null;
let originalName = "";
let previewURL   = null;

/* ---------- helpers ---------- */
function showError(id, msg){
  const el = $(id);
  el.textContent = msg;
  el.hidden = !msg;
}
function clearErrors(){
  ["file-error","name-error","story-error","consent-error"].forEach(id => showError(id, ""));
  statusEl.textContent = "";
}

/* ---------- image downscaling ----------
   Big phone photos are re-encoded in the browser before upload:
   longest edge capped at MAX_EDGE, JPEG quality stepped down until
   the result fits under TARGET_BYTES. Keeps uploads fast on mobile
   data and keeps Drive tidy — no visible loss at livestream scale. */

async function loadBitmap(file){
  // imageOrientation honours EXIF rotation from phone cameras
  if (window.createImageBitmap){
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch(e){ /* fall through */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gagal membaca gambar.")); };
    img.src = url;
  });
}

function canvasToBlob(canvas, quality){
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

async function downscale(file){
  const bmp = await loadBitmap(file);
  const w0 = bmp.width, h0 = bmp.height;
  const scale = Math.min(1, MAX_EDGE / Math.max(w0, h0));
  const w = Math.round(w0 * scale), h = Math.round(h0 * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";          // PNG transparency -> white, not black
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();

  let quality = 0.85;
  let blob = await canvasToBlob(canvas, quality);
  while (blob && blob.size > TARGET_BYTES && quality > 0.5){
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }
  if (!blob) throw new Error("Gagal memproses gambar.");
  return { blob, w, h, w0, h0 };
}

/* ---------- file selection ---------- */
async function setFile(file){
  if (!file) return;

  if (!ALLOWED.includes(file.type)){
    showError("file-error", "Format tidak didukung. Gunakan JPG, PNG, atau WEBP.");
    return;
  }
  if (file.size > MAX_INPUT){
    showError("file-error", `Ukuran file ${(file.size/1048576).toFixed(1)}MB — maksimal 15MB.`);
    return;
  }

  showError("file-error", "");
  dzText.textContent = "Menyiapkan foto\u2026";
  submitBtn.disabled = true;

  try{
    const { blob, w, h, w0, h0 } = await downscale(file);

    selectedFile = new File([blob], "photo.jpg", { type: "image/jpeg" });
    originalName = file.name;

    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(blob);
    preview.src = previewURL;
    preview.hidden = false;
    clearBtn.hidden = false;
    dzText.hidden = true;
    dropzone.classList.add("has-file");

    const resized = (w !== w0 || h !== h0);
    fileMeta.textContent =
      `${w}\u00d7${h}px \u00b7 ${(blob.size/1024).toFixed(0)}KB` +
      (resized ? ` (dari ${w0}\u00d7${h0}px)` : "");
    fileMeta.hidden = false;

  }catch(err){
    console.error(err);
    showError("file-error", "Foto tidak bisa diproses. Coba foto lain.");
    clearFile();
  }finally{
    dzText.textContent = "Klik atau seret foto ke sini";
    submitBtn.disabled = false;
  }
}

function clearFile(){
  selectedFile = null;
  originalName = "";
  fileInput.value = "";
  if (previewURL){ URL.revokeObjectURL(previewURL); previewURL = null; }
  preview.hidden = true;
  preview.removeAttribute("src");
  clearBtn.hidden = true;
  dzText.hidden = false;
  fileMeta.hidden = true;
  fileMeta.textContent = "";
  dropzone.classList.remove("has-file");
}

dropzone.addEventListener("click", (e) => {
  if (e.target === clearBtn) return;
  fileInput.click();
});
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " "){ e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener("change", () => setFile(fileInput.files[0]));
clearBtn.addEventListener("click", (e) => { e.stopPropagation(); clearFile(); });

["dragenter","dragover"].forEach(ev =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("is-dragover"); })
);
["dragleave","drop"].forEach(ev =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("is-dragover"); })
);
dropzone.addEventListener("drop", (e) => {
  const f = e.dataTransfer?.files?.[0];
  if (f) setFile(f);
});

/* ---------- character counter ---------- */
story.addEventListener("input", () => { storyCount.textContent = story.value.length; });

/* ---------- base64 ---------- */
function toBase64(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(new Error("Gagal membaca file."));
    r.readAsDataURL(file);
  });
}

/* ---------- submit ---------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();

  let ok = true;
  if (!selectedFile){ showError("file-error", "Pilih satu foto dulu ya."); ok = false; }
  if (!nameInput.value.trim()){ showError("name-error", "Nama wajib diisi."); ok = false; }
  if (!story.value.trim()){ showError("story-error", "Ceritakan sedikit tentang fotomu."); ok = false; }
  if (!consent.checked){ showError("consent-error", consent.disabled ? "Baca ketentuan & consent dulu ya." : "Kamu harus menyetujui ketentuan penggunaan foto."); ok = false; }
  if (!ok) return;

  submitBtn.disabled = true;
  statusEl.textContent = "Mengunggah…";

  try{
    const payload = {
      name:     nameInput.value.trim(),
      story:    story.value.trim(),
      consent:  true,
      fileName: originalName || selectedFile.name,
      mimeType: selectedFile.type,
      fileSize: selectedFile.size,
      fileData: await toBase64(selectedFile),
      userAgent: navigator.userAgent,
      submittedAt: new Date().toISOString()
    };

    // text/plain keeps this a "simple request" → no CORS preflight
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Gagal mengirim.");

    form.reset();
    clearFile();
    storyCount.textContent = "0";
    statusEl.textContent = "";
    successEl.hidden = false;

  }catch(err){
    console.error(err);
    statusEl.textContent = "Maaf, terjadi kesalahan. Coba lagi sebentar lagi.";
  }finally{
    submitBtn.disabled = false;
  }
});

/* =========================================================
   TERMS LIGHTBOX — must be read before consent can be ticked
   ========================================================= */
const termsModal = $("terms");
const termsBody  = $("terms-body");
const termsAgree = $("terms-agree");
const termsNudge = $("terms-nudge");
let lastFocused = null;

function openTerms(){
  lastFocused = document.activeElement;
  termsModal.hidden = false;
  document.body.style.overflow = "hidden";
  termsBody.scrollTop = 0;
  checkScrolled();
  termsBody.focus();
}

function closeTerms(){
  termsModal.hidden = true;
  document.body.style.overflow = "";
  if (lastFocused) lastFocused.focus();
}

/* enable "Saya Setuju" only once the text has been scrolled through
   (or if it fits without scrolling at all) */
function checkScrolled(){
  const atBottom = termsBody.scrollTop + termsBody.clientHeight >= termsBody.scrollHeight - 8;
  if (atBottom){
    termsAgree.disabled = false;
    termsNudge.classList.add("is-done");
  }
}

$("open-terms").addEventListener("click", (e) => { e.preventDefault(); openTerms(); });
termsBody.addEventListener("scroll", checkScrolled);
$("terms-close").addEventListener("click", closeTerms);

termsAgree.addEventListener("click", () => {
  consent.disabled = false;
  consent.checked  = true;
  showError("consent-error", "");
  closeTerms();
});

/* backdrop click + Esc */
termsModal.addEventListener("click", (e) => { if (e.target === termsModal) closeTerms(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !termsModal.hidden) closeTerms();
});

/* if they click the disabled checkbox, open the terms instead */
document.querySelector(".consent").addEventListener("click", (e) => {
  if (consent.disabled && e.target.id !== "open-terms"){
    e.preventDefault();
    openTerms();
  }
});

/* ---------- success overlay ---------- */
$("success-close").addEventListener("click", () => {
  successEl.hidden = true;
  window.scrollTo({ top: document.querySelector(".form-wrap").offsetTop, behavior: "smooth" });
});
