/* =========================================================
   THE BLUE VALLEY — submission handler
   Posts to a Google Apps Script Web App which creates one
   Drive folder per submission (photo + info.txt) and logs
   a row to a master Google Sheet.
   ========================================================= */

/* ⬇⬇⬇  PASTE YOUR APPS SCRIPT /exec URL HERE  ⬇⬇⬇ */
const ENDPOINT = "https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXX/exec";

const MAX_BYTES   = 2 * 1024 * 1024;              // 2 MB
const ALLOWED     = ["image/jpeg","image/png","image/webp","image/heic","image/heif"];

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

let selectedFile = null;

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

/* ---------- file selection ---------- */
function setFile(file){
  if (!file) return;

  if (!ALLOWED.includes(file.type)){
    showError("file-error", "Format tidak didukung. Gunakan JPG, PNG, atau WEBP.");
    return;
  }
  if (file.size > MAX_BYTES){
    showError("file-error", `Ukuran file ${(file.size/1048576).toFixed(1)}MB — maksimal 2MB.`);
    return;
  }

  showError("file-error", "");
  selectedFile = file;

  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.hidden = false;
  clearBtn.hidden = false;
  dzText.hidden = true;
  dropzone.classList.add("has-file");
}

function clearFile(){
  selectedFile = null;
  fileInput.value = "";
  preview.hidden = true;
  preview.removeAttribute("src");
  clearBtn.hidden = true;
  dzText.hidden = false;
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
  if (!consent.checked){ showError("consent-error", "Kamu harus menyetujui ketentuan penggunaan foto."); ok = false; }
  if (!ok) return;

  submitBtn.disabled = true;
  statusEl.textContent = "Mengunggah…";

  try{
    const payload = {
      name:     nameInput.value.trim(),
      story:    story.value.trim(),
      consent:  true,
      fileName: selectedFile.name,
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

/* ---------- success overlay ---------- */
$("success-close").addEventListener("click", () => {
  successEl.hidden = true;
  window.scrollTo({ top: document.querySelector(".form-wrap").offsetTop, behavior: "smooth" });
});
