// ============================================================
// Valor Wave CMS 2.0 — Admin Script (PAGE-LEVEL HTML VERSION)
// - Single-page HTML editing (index.html by default)
// - Uses /api/page/get and /api/page/save
// - Keeps themes, dark mode, uploads, toasts
// ============================================================

// ------------------------------------------------------------
// DOM HOOKS
// ------------------------------------------------------------

const loginBtn = document.getElementById("login-btn");
const userDisplay = document.getElementById("user-display");

const editorTextarea = document.getElementById("editor");
const previewEl = document.getElementById("preview");
const resizeHandle = document.getElementById("resize-handle");

const statusMessageEl = document.getElementById("status-message");
const statusAutosaveEl = document.getElementById("status-autosave");

const insertImageBtn = document.getElementById("insert-image-btn");
const imageModal = document.getElementById("image-modal");
const imageUrlInput = document.getElementById("image-url-input");
const insertImageConfirmBtn = document.getElementById("insert-image-confirm");
const insertImageCancelBtn = document.getElementById("insert-image-cancel");

const uploadGalleryModal = document.getElementById("upload-gallery-modal");
const uploadGalleryEl = document.getElementById("upload-gallery");
const insertSelectedBtn = document.getElementById("insert-selected-btn");
const closeGalleryBtn = document.getElementById("close-gallery-btn");

const modeToggleBtn = document.getElementById("mode-toggle");
const toolbarMoreBtn = document.getElementById("toolbar-more-btn");
const toolbarMoreMenu = document.getElementById("toolbar-more-menu");

const themePanel = document.getElementById("theme-panel");

// CMS theme selector
const cmsThemeSelect = document.getElementById("theme-select");

// Website theme selector (reusing same select for now)
const siteThemeSelect = document.getElementById("theme-select");

// Dark mode toggle
const darkModeToggle = document.getElementById("dark-mode-toggle");

// Theme panel toggle button
const themeBtn = document.getElementById("theme-btn");

const logoutBtn = document.getElementById("logout-btn");

const toastContainer = document.getElementById("toast-container");

// ------------------------------------------------------------
// STATE
// ------------------------------------------------------------

let currentPagePath = "index.html";
let lastContent = "";
let isSaving = false;
let autosaveTimer = null;

let uploadedImages = [];
let isResizing = false;
let resizeStartX = 0;
let resizeStartY = 0;
let editorStartWidth = 0;
let editorStartHeight = 0;

// ------------------------------------------------------------
// API HELPER
// ------------------------------------------------------------

const API_BASE = "/api/";

async function api(endpoint, options = {}) {
  const url = API_BASE + endpoint;
  const opts = {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  };

  const method = (opts.method || "GET").toUpperCase();
  if (method === "GET") {
    delete opts.headers["Content-Type"];
  }

  const res = await fetch(url, opts);
  if (!res.ok) {
    let err = {};
    try {
      err = await res.json();
    } catch {
      err = { error: `HTTP ${res.status}` };
    }
    return err;
  }
  try {
    return await res.json();
  } catch {
    return {};
  }
}

// ------------------------------------------------------------
// STATUS + TOAST
// ------------------------------------------------------------

function setStatus(msg, isError = false) {
  if (statusMessageEl) {
    statusMessageEl.textContent = msg;
    statusMessageEl.style.color = isError ? "#f66" : "inherit";
  }
}

function setAutosaveStatus(msg) {
  if (statusAutosaveEl) {
    statusAutosaveEl.textContent = `Autosave: ${msg}`;
  }
}

function showToast(message, type = "success") {
  if (!toastContainer) return;
  const div = document.createElement("div");
  div.className = `toast ${type === "error" ? "error" : "success"}`;
  div.textContent = message;
  toastContainer.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// ------------------------------------------------------------
// PREVIEW RENDERING
// ------------------------------------------------------------

function updatePreview(html) {
  if (!previewEl) return;
  previewEl.innerHTML = html || "";
}

// ============================================================
// THEME SYSTEM (CMS + Website, separate-ish)
// ============================================================

function applyCmsTheme(theme) {
  document.body.classList.remove("theme-original", "theme-multicam", "theme-patriotic");
  document.body.classList.add(`theme-${theme}`);
  localStorage.setItem("cms-theme", theme);
}

function applySiteTheme(theme) {
  localStorage.setItem("website-theme", theme);
}

function applyDarkMode(isDark) {
  if (isDark) {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
  localStorage.setItem("cms-dark", isDark ? "1" : "0");
}

// ============================================================
// PAGE LOAD / SAVE (Visual CMS backend)
// ============================================================

async function loadPage() {
  setStatus("Loading page…");
  setAutosaveStatus("idle");

  const res = await api("page/get", { method: "GET" });

  if (!res || res.error || !res.content) {
    setStatus("Failed to load page", true);
    showToast("Failed to load page", "error");
    return;
  }

  currentPagePath = res.pagePath || "index.html";
  const content = res.content || "";

  lastContent = content;
  if (editorTextarea) editorTextarea.value = content;
  updatePreview(content);

  setStatus(`Loaded ${currentPagePath}`);
}

async function savePage(isAutosave = false) {
  if (!editorTextarea) return;

  const content = editorTextarea.value;

  if (isAutosave && content === lastContent) {
    setAutosaveStatus("idle");
    return;
  }

  isSaving = true;
  setStatus(isAutosave ? "Autosaving…" : "Saving…");
  setAutosaveStatus("saving…");

  const res = await api("page/save", {
    method: "POST",
    body: JSON.stringify({
      pagePath: currentPagePath,
      content,
      message: `${isAutosave ? "Autosave" : "Update"} ${currentPagePath} via Visual CMS`
    })
  });

  isSaving = false;

  if (!res || res.error) {
    showToast("Save failed", "error");
    setStatus("Save failed", true);
    setAutosaveStatus("error");
    return;
  }

  lastContent = content;

  setStatus(isAutosave ? "Autosaved" : "Saved");
  setAutosaveStatus("idle");
  showToast(isAutosave ? "Autosaved" : "Saved", "success");
}

// ============================================================
// IMAGE MODAL + INSERT (HTML <img>)
// ============================================================

function openImageModal() {
  if (!imageModal) return;
  imageUrlInput.value = "";
  imageModal.classList.remove("hidden");
  imageUrlInput.focus();
}

function closeImageModal() {
  if (!imageModal) return;
  imageModal.classList.add("hidden");
}

function insertAtCursor(target, text) {
  if (!target) return;

  const el = target;
  const start = el.selectionStart || 0;
  const end = el.selectionEnd || 0;
  const before = el.value.substring(0, start);
  const after = el.value.substring(end);
  el.value = before + text + after;
  const pos = start + text.length;
  el.selectionStart = el.selectionEnd = pos;
  el.focus();
  updatePreview(el.value);
  debounceAutosave();
}

function insertImageAtCursor(url) {
  const target = editorTextarea;
  insertAtCursor(target, `<img src="${url}" alt="">`);
}

function confirmInsertImage() {
  const url = imageUrlInput.value.trim();
  if (!url) {
    showToast("Image URL required", "error");
    return;
  }
  insertImageAtCursor(url);
  closeImageModal();
}

// ============================================================
// UPLOAD SYSTEM (multi-image)
// ============================================================

function updateInsertButton() {
  if (!insertSelectedBtn) return;
  insertSelectedBtn.disabled = uploadedImages.length === 0;
}

function addThumbnail(thumbUrl, originalUrl, webpUrl, optimizedUrl) {
  if (!uploadGalleryEl) return;

  const div = document.createElement("div");
  div.className = "thumb";

  div.innerHTML = `
    <img src="${thumbUrl}">
    <button class="delete-btn">X</button>
  `;

  div.querySelector(".delete-btn").addEventListener("click", () => {
    div.remove();
    uploadedImages = uploadedImages.filter(
      (i) => i.originalUrl !== originalUrl
    );
    updateInsertButton();
  });

  uploadGalleryEl.appendChild(div);

  uploadedImages.push({
    thumbUrl,
    originalUrl,
    webpUrl,
    optimizedUrl
  });

  updateInsertButton();
}

async function uploadFile(file, progressBar, progressContainer) {
  if (!progressBar || !progressContainer) return;

  progressContainer.style.display = "block";
  progressBar.style.width = "0%";

  const formData = new FormData();
  formData.append("file", file);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload-image");

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percent = (e.loaded / e.total) * 100;
      progressBar.style.width = percent + "%";
    }
  };

  xhr.onload = () => {
    progressBar.style.width = "100%";
    setTimeout(() => {
      progressContainer.style.display = "none";
    }, 500);

    try {
      const res = JSON.parse(xhr.responseText);
      addThumbnail(
        res.thumb || res.original,
        res.original,
        res.webp,
        res.optimized
      );
    } catch {
      showToast("Upload failed (invalid response)", "error");
    }
  };

  xhr.onerror = () => {
    progressContainer.style.display = "none";
    showToast("Upload failed", "error");
  };

  xhr.send(formData);
}

function handleFiles(files, progressBar, progressContainer) {
  [...files].forEach((file) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      showToast("Only PNG, JPG, and WEBP images are allowed.", "error");
      return;
    }
    uploadFile(file, progressBar, progressContainer);
  });
}

// ============================================================
// AUTH / USER
// ============================================================

async function loadUser() {
  const me = await api("me");
  if (me && !me.error && me.login) {
    userDisplay.textContent = `Logged in as ${me.login}`;
    document.body.classList.remove("logged-out");
    document.body.classList.add("logged-in");
  } else {
    userDisplay.textContent = "";
    document.body.classList.remove("logged-in");
    document.body.classList.add("logged-out");
  }
}

// ============================================================
// SIMPLE TOOLBAR COMMANDS (HTML-oriented)
// ============================================================

function applyToolbarCommand(cmd) {
  const target = editorTextarea;
  if (!target) return;

  switch (cmd) {
    case "bold":
      wrapSelection(target, "<strong>", "</strong>");
      break;
    case "italic":
      wrapSelection(target, "<em>", "</em>");
      break;
    case "underline":
      wrapSelection(target, "<u>", "</u>");
      break;
    case "strike":
      wrapSelection(target, "<s>", "</s>");
      break;
    case "h1":
      wrapSelection(target, "<h1>", "</h1>");
      break;
    case "h2":
      wrapSelection(target, "<h2>", "</h2>");
      break;
    case "h3":
      wrapSelection(target, "<h3>", "</h3>");
      break;
    case "ul":
      wrapSelection(target, "<ul>\n<li>", "</li>\n</ul>");
      break;
    case "ol":
      wrapSelection(target, "<ol>\n<li>", "</li>\n</ol>");
      break;
    case "quote":
      wrapSelection(target, "<blockquote>", "</blockquote>");
      break;
    case "code":
      wrapSelection(target, "<code>", "</code>");
      break;
    case "hr":
      insertAtCursor(target, "<hr>");
      break;
    default:
      break;
  }

  updatePreview(target.value);
  debounceAutosave();
}

// ============================================================
// TEXT MANIPULATION HELPERS
// ============================================================

function wrapSelection(textarea, before, after) {
  if (!textarea) return;

  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const value = textarea.value;

  const selected = value.substring(start, end);
  const newText = before + selected + after;

  textarea.value =
    value.substring(0, start) +
    newText +
    value.substring(end);

  textarea.selectionStart = start + before.length;
  textarea.selectionEnd = start + before.length + selected.length;
}

// ============================================================
// RESIZABLE SPLIT VIEW (Editor / Preview)
// ============================================================

function isMobileLayout() {
  return window.innerWidth <= 900;
}

function startResize(e) {
  e.preventDefault();
  isResizing = true;
  resizeStartX = e.clientX;
  resizeStartY = e.clientY;

  if (editorTextarea) {
    const rect = editorTextarea.getBoundingClientRect();
    editorStartWidth = rect.width;
    editorStartHeight = rect.height;
  }

  document.addEventListener("mousemove", doResize);
  document.addEventListener("mouseup", stopResize);
  document.addEventListener("touchmove", doResizeTouch, { passive: false });
  document.addEventListener("touchend", stopResizeTouch);
}

function doResize(e) {
  if (!isResizing || !editorTextarea || !previewEl) return;

  if (isMobileLayout()) {
    const dy = e.clientY - resizeStartY;
    const newHeight = editorStartHeight + dy;
    const totalHeight = editorTextarea.parentElement.clientHeight;
    const min = 80;
    const max = totalHeight - 80;
    const clamped = Math.max(min, Math.min(max, newHeight));

    editorTextarea.style.height = clamped + "px";
    previewEl.style.height =
      totalHeight - clamped - resizeHandle.offsetHeight + "px";
  } else {
    const dx = e.clientX - resizeStartX;
    const newWidth = editorStartWidth + dx;
    const totalWidth = editorTextarea.parentElement.clientWidth;
    const min = 150;
    const max = totalWidth - 150;
    const clamped = Math.max(min, Math.min(max, newWidth));

    editorTextarea.style.flex = "0 0 " + clamped + "px";
    previewEl.style.flex = "1 1 auto";
  }
}

function stopResize() {
  isResizing = false;
  document.removeEventListener("mousemove", doResize);
  document.removeEventListener("mouseup", stopResize);
}

function doResizeTouch(e) {
  if (!isResizing || !editorTextarea || !previewEl) return;
  e.preventDefault();

  const touch = e.touches[0];
  if (!touch) return;

  if (isMobileLayout()) {
    const dy = touch.clientY - resizeStartY;
    const newHeight = editorStartHeight + dy;
    const totalHeight = editorTextarea.parentElement.clientHeight;
    const min = 80;
    const max = totalHeight - 80;
    const clamped = Math.max(min, Math.min(max, newHeight));

    editorTextarea.style.height = clamped + "px";
    previewEl.style.height =
      totalHeight - clamped - resizeHandle.offsetHeight + "px";
  } else {
    const dx = touch.clientX - resizeStartX;
    const newWidth = editorStartWidth + dx;
    const totalWidth = editorTextarea.parentElement.clientWidth;
    const min = 150;
    const max = totalWidth - 150;
    const clamped = Math.max(min, Math.min(max, newWidth));

    editorTextarea.style.flex = "0 0 " + clamped + "px";
    previewEl.style.flex = "1 1 auto";
  }
}

function stopResizeTouch() {
  isResizing = false;
  document.removeEventListener("touchmove", doResizeTouch);
  document.removeEventListener("touchend", stopResizeTouch);
}

// ============================================================
// AUTOSAVE (debounced)
// ============================================================

function debounceAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => savePage(true), 1500);
}

// ============================================================
// EVENT WIRING
// ============================================================

function wireEvents() {
  // AUTH
  if (loginBtn) {
    loginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "https://cms.valorwaveentertainment.com/login";
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await api("logout", { method: "POST" });
      window.location.href = "https://cms.valorwaveentertainment.com/login";
    });
  }

  // THEME PANEL
  if (themeBtn && themePanel) {
    themeBtn.addEventListener("click", () => {
      themePanel.classList.toggle("visible");
    });
  }

  // CMS theme
  if (cmsThemeSelect) {
    cmsThemeSelect.addEventListener("change", () => {
      applyCmsTheme(cmsThemeSelect.value);
    });
  }

  // Website theme
  if (siteThemeSelect) {
    siteThemeSelect.addEventListener("change", () => {
      applySiteTheme(siteThemeSelect.value);
      showToast("Website theme saved", "success");
    });
  }

  // Dark mode
  if (darkModeToggle) {
    darkModeToggle.addEventListener("click", () => {
      const isDark = !document.body.classList.contains("dark");
      applyDarkMode(isDark);
    });
  }

  // TOOLBAR MORE MENU
  if (toolbarMoreBtn && toolbarMoreMenu) {
    toolbarMoreBtn.addEventListener("click", () => {
      toolbarMoreMenu.classList.toggle("visible");
    });
  }

  // TOOLBAR COMMANDS
  document.querySelectorAll("#toolbar button[data-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cmd = btn.getAttribute("data-cmd");
      applyToolbarCommand(cmd);
    });
  });

  // IMAGE MODAL
  if (insertImageBtn) insertImageBtn.addEventListener("click", openImageModal);
  if (insertImageConfirmBtn) insertImageConfirmBtn.addEventListener("click", confirmInsertImage);
  if (insertImageCancelBtn) insertImageCancelBtn.addEventListener("click", closeImageModal);

  // EDITOR INPUT
  if (editorTextarea) {
    editorTextarea.addEventListener("input", () => {
      updatePreview(editorTextarea.value);
      debounceAutosave();
    });
  }

  // UPLOAD SYSTEM
  const fileUploadBtn = document.getElementById("file-upload-btn");
  const fileUploadInput = document.getElementById("file-upload-input");
  const dropZone = document.getElementById("drop-zone");
  const progress = document.getElementById("upload-progress");
  const progressBar = document.getElementById("upload-progress-bar");

  if (fileUploadBtn && fileUploadInput) {
    fileUploadBtn.addEventListener("click", () => fileUploadInput.click());

    fileUploadInput.addEventListener("change", (e) => {
      handleFiles(e.target.files, progressBar, progress);
    });
  }

  if (dropZone) {
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      handleFiles(e.dataTransfer.files, progressBar, progress);
    });
  }

  // Insert selected uploaded images
  if (insertSelectedBtn) {
    insertSelectedBtn.addEventListener("click", () => {
      uploadedImages.forEach((img) => {
        const target = editorTextarea;
        insertAtCursor(
          target,
          `<img src="${img.optimizedUrl || img.originalUrl}" alt="">`
        );
      });

      updatePreview(editorTextarea.value);
      debounceAutosave();

      uploadedImages = [];
      if (uploadGalleryEl) uploadGalleryEl.innerHTML = "";
      updateInsertButton();
    });
  }

  if (closeGalleryBtn && uploadGalleryModal) {
    closeGalleryBtn.addEventListener("click", () => {
      uploadGalleryModal.classList.add("hidden");
    });
  }

  // RESIZE HANDLE
  if (resizeHandle) {
    resizeHandle.addEventListener("mousedown", startResize);

    resizeHandle.addEventListener("touchstart", (e) => {
      const touch = e.touches[0];
      if (!touch) return;

      resizeStartX = touch.clientX;
      resizeStartY = touch.clientY;
      isResizing = true;

      if (editorTextarea) {
        const rect = editorTextarea.getBoundingClientRect();
        editorStartWidth = rect.width;
        editorStartHeight = rect.height;
      }

      document.addEventListener("touchmove", doResizeTouch, { passive: false });
      document.addEventListener("touchend", stopResizeTouch);
    });
  }
}

// ============================================================
// INIT
// ============================================================

async function init() {
  await new Promise(requestAnimationFrame);

  setStatus("Loading…");
  initThemeFromStorage();

  const me = await api("me");

  if (me && !me.error && me.login) {
    document.body.classList.remove("logged-out");
    document.body.classList.add("logged-in");

    document.getElementById("login-screen").style.display = "none";
    document.getElementById("cms").style.display = "flex";

    userDisplay.textContent = `Logged in as ${me.login}`;

    await loadPage();
  } else {
    document.body.classList.add("logged-out");
    document.body.classList.remove("logged-in");

    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("cms").style.display = "none";

    setStatus("Please log in");
    setAutosaveStatus("idle");
    return;
  }

  await new Promise(requestAnimationFrame);

  setStatus("Ready");
  setAutosaveStatus("idle");

  wireEvents();
}

init();

// Load stored themes
function initThemeFromStorage() {
  const cmsTheme = localStorage.getItem("cms-theme") || "original";
  const siteTheme = localStorage.getItem("website-theme") || "original";
  const dark = localStorage.getItem("cms-dark") === "1";

  applyCmsTheme(cmsTheme);
  applyDarkMode(dark);

  if (cmsThemeSelect) cmsThemeSelect.value = cmsTheme;
  if (siteThemeSelect) siteThemeSelect.value = siteTheme;
}
