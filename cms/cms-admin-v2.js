// ============================================================
// BASIC DOM HOOKS
// ============================================================

const loginBtn = document.getElementById("login-btn");
const userDisplay = document.getElementById("user-display");
const fileListEl = document.getElementById("file-list");
const sidebarToggleBtn = document.getElementById("sidebar-toggle");

const editorTextarea = document.getElementById("editor");
const wysiwygEl = document.getElementById("wysiwyg");
const previewEl = document.getElementById("preview");

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
const themeSelect = document.getElementById("theme-select");
const darkModeToggle = document.getElementById("dark-mode-toggle");

const searchInput = document.getElementById("search-input");
const logoutBtn = document.getElementById("logout-btn");

const toastContainer = document.getElementById("toast-container");

// ============================================================
// STATE
// ============================================================

let isWysiwygMode = false;
let currentPath = null;
let lastContent = "";
let isSaving = false;
let autosaveTimer = null;
let fileTreeData = [];

// ============================================================
// API HELPER
// ============================================================

const API_BASE = "/api/";

async function api(endpoint, options = {}) {
  const url = API_BASE + endpoint;
  const opts = {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  };

  // GET should not send Content-Type
  if ((opts.method || "GET").toUpperCase() === "GET") {
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

// ============================================================
// STATUS + TOAST
// ============================================================

function setStatus(msg, isError = false) {
  if (statusMessageEl) {
    statusMessageEl.textContent = msg;
    statusMessageEl.style.color = isError ? "#f66" : "#eee";
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
  div.className = `toast ${type}`;
  div.textContent = message;
  toastContainer.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// ============================================================
// MARKDOWN <-> HTML (simple)
// ============================================================

function markdownToHtml(md) {
  // Very minimal; you can swap in a real parser later
  let html = md || "";
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\n/g, "<br>");
  return html;
}

function htmlToMarkdown(html) {
  let md = html || "";
  md = md.replace(/<h1>(.*?)<\/h1>/gi, "# $1\n");
  md = md.replace(/<h2>(.*?)<\/h2>/gi, "## $1\n");
  md = md.replace(/<h3>(.*?)<\/h3>/gi, "### $1\n");
  md = md.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b>(.*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em>(.*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i>(.*?)<\/i>/gi, "*$1*");
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<[^>]+>/g, "");
  return md;
}

function updatePreview(md) {
  if (!previewEl) return;
  previewEl.innerHTML = markdownToHtml(md);
}

// ============================================================
// THEME + DARK MODE
// ============================================================

function applyTheme(theme) {
  document.body.classList.remove("theme-original", "theme-multicam", "theme-patriotic");
  document.body.classList.add(`theme-${theme}`);
  localStorage.setItem("cms-theme", theme);
}

function applyDarkMode(isDark) {
  if (isDark) {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
  localStorage.setItem("cms-dark", isDark ? "1" : "0");
}

function initThemeFromStorage() {
  const theme = localStorage.getItem("cms-theme") || "original";
  const dark = localStorage.getItem("cms-dark") === "1";
  applyTheme(theme);
  applyDarkMode(dark);
  if (themeSelect) themeSelect.value = theme;
}

// ============================================================
// MODE TOGGLE
// ============================================================

function setMode(wysiwyg) {
  isWysiwygMode = wysiwyg;
  if (!editorTextarea || !wysiwygEl) return;

  if (wysiwyg) {
    const md = editorTextarea.value;
    wysiwygEl.innerHTML = markdownToHtml(md);
    wysiwygEl.classList.remove("hidden");
    editorTextarea.style.display = "none";
    if (modeToggleBtn) modeToggleBtn.textContent = "Markdown";
  } else {
    const md = htmlToMarkdown(wysiwygEl.innerHTML);
    editorTextarea.value = md;
    wysiwygEl.classList.add("hidden");
    editorTextarea.style.display = "block";
    if (modeToggleBtn) modeToggleBtn.textContent = "WYSIWYG";
  }
}

// ============================================================
// AUTOSAVE
// ============================================================

function debounceAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveContent(true), 1500);
}

// ============================================================
// FILE TREE
// ============================================================

function buildTree(files) {
  const root = {};
  files.forEach((f) => {
    const rel = f.path.replace(/^content\//, "");
    const parts = rel.split("/");
    let node = root;
    parts.forEach((part, idx) => {
      const isFile = idx === parts.length - 1;
      if (!node[part]) {
        node[part] = {
          __isFile: isFile,
          __path: isFile ? f.path : null,
          __children: isFile ? null : {}
        };
      }
      if (!isFile) {
        node = node[part].__children;
      }
    });
  });
  return root;
}

function renderTree(node, container) {
  container.innerHTML = "";
  const ul = document.createElement("ul");

  const entries = Object.entries(node).sort(([aName, aVal], [bName, bVal]) => {
    const aIsFile = aVal.__isFile;
    const bIsFile = bVal.__isFile;
    if (aIsFile === bIsFile) return aName.localeCompare(bName);
    return aIsFile ? 1 : -1;
  });

  for (const [name, info] of entries) {
    const li = document.createElement("li");
    if (info.__isFile) {
      li.className = "file-node";
      li.textContent = name;
      li.addEventListener("click", () => openFile(info.__path));
    } else {
      li.className = "folder-node";
      const header = document.createElement("div");
      header.className = "folder-header";

      const icon = document.createElement("span");
      icon.className = "folder-icon";
      icon.textContent = "▸";

      const label = document.createElement("span");
      label.className = "folder-label";
      label.textContent = name;

      const childrenContainer = document.createElement("div");
      childrenContainer.className = "folder-children hidden";

      header.addEventListener("click", () => {
        const isHidden = childrenContainer.classList.toggle("hidden");
        icon.textContent = isHidden ? "▸" : "▾";
      });

      li.appendChild(header);
      header.appendChild(icon);
      header.appendChild(label);

      renderTree(info.__children, childrenContainer);
      li.appendChild(childrenContainer);
    }
    ul.appendChild(li);
  }

  container.appendChild(ul);
}

async function loadFiles() {
  const files = await api("files");
  if (!files || files.error) {
    setStatus("Failed to load files", true);
    showToast("Failed to load files", "error");
    return;
  }
  fileTreeData = files;
  const tree = buildTree(files);
  renderTree(tree, fileListEl);
  setStatus("Files loaded");
}

// ============================================================
// FILE OPERATIONS
// ============================================================

async function openFile(path) {
  const data = await api("read-file", {
    method: "POST",
    body: JSON.stringify({ filePath: path })
  });

  if (!data || data.error) {
    showToast("Error loading file", "error");
    setStatus("Error loading file", true);
    return;
  }

  currentPath = path;
  const content = data.content || "";
  lastContent = content;

  if (editorTextarea) editorTextarea.value = content;
  if (isWysiwygMode && wysiwygEl) {
    wysiwygEl.innerHTML = markdownToHtml(content);
  }
  updatePreview(content);
  setStatus(`Opened ${path}`);
  setAutosaveStatus("on");
}

async function saveContent(isAutosave = false) {
  if (!currentPath) return;
  const content = isWysiwygMode
    ? htmlToMarkdown(wysiwygEl.innerHTML)
    : editorTextarea.value;

  if (content === lastContent && isAutosave) {
    setAutosaveStatus("idle");
    return;
  }

  isSaving = true;
  setStatus(isAutosave ? "Autosaving…" : "Saving…");
  setAutosaveStatus("saving…");

  const res = await api("write-file", {
    method: "POST",
    body: JSON.stringify({
      filePath: currentPath,
      content,
      message: `${isAutosave ? "Autosave" : "Update"} ${currentPath} via CMS`
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

async function createNewFile() {
  const name = prompt("New file name (e.g. about.md):");
  if (!name) return;
  const path = `content/${name.replace(/^\/+/, "")}`;

  const res = await api("new-file", {
    method: "POST",
    body: JSON.stringify({
      path,
      content: "# New File\n",
      message: `Create ${path} via CMS`
    })
  });

  if (!res || res.error) {
    showToast("Failed to create file", "error");
    return;
  }

  await loadFiles();
  await openFile(path);
}

async function createNewFolder() {
  const name = prompt("New folder name (e.g. blog):");
  if (!name) return;
  const folderPath = `content/${name.replace(/\/+$/, "")}`;

  const res = await api("new-folder", {
    method: "POST",
    body: JSON.stringify({
      folderPath
    })
  });

  if (!res || res.error) {
    showToast("Failed to create folder", "error");
    return;
  }

  await loadFiles();
}

// ============================================================
// IMAGE MODAL + INSERT
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

  if (target === wysiwygEl) {
    const md = htmlToMarkdown(wysiwygEl.innerHTML) + text;
    editorTextarea.value = md;
    wysiwygEl.innerHTML = markdownToHtml(md);
    updatePreview(md);
    debounceAutosave();
    return;
  }

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
  const target = isWysiwygMode ? wysiwygEl : editorTextarea;
  insertAtCursor(target, `![Image](${url})\n`);
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

let uploadedImages = [];

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
  uploadedImages.push({ thumbUrl, originalUrl, webpUrl, optimizedUrl });
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
      // Expecting { thumb, original, webp, optimized } or at least original
      addThumbnail(res.thumb || res.original, res.original, res.webp, res.optimized);
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
// EVENT WIRING
// ============================================================

function wireEvents() {
  // Auth
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      window.location.href = "/cms/login";
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await api("logout", { method: "POST" });
      window.location.href = "/cms";
    });
  }

  // Sidebar toggle (mobile)
  if (sidebarToggleBtn && fileListEl) {
    sidebarToggleBtn.addEventListener("click", () => {
      fileListEl.classList.toggle("visible");
    });
  }

  // New file / folder
  const newFileBtn = document.getElementById("new-file-btn");
  const newFolderBtn = document.getElementById("new-folder-btn");

  if (newFileBtn) newFileBtn.addEventListener("click", createNewFile);
  if (newFolderBtn) newFolderBtn.addEventListener("click", createNewFolder);

  // Image modal
  if (insertImageBtn) insertImageBtn.addEventListener("click", openImageModal);
  if (insertImageConfirmBtn) insertImageConfirmBtn.addEventListener("click", confirmInsertImage);
  if (insertImageCancelBtn) insertImageCancelBtn.addEventListener("click", closeImageModal);

  // Mode toggle
  if (modeToggleBtn) {
    modeToggleBtn.addEventListener("click", () => setMode(!isWysiwygMode));
  }

  // Editor changes
  if (editorTextarea) {
    editorTextarea.addEventListener("input", () => {
      updatePreview(editorTextarea.value);
      debounceAutosave();
    });
  }
  if (wysiwygEl) {
    wysiwygEl.addEventListener("input", () => {
      const md = htmlToMarkdown(wysiwygEl.innerHTML);
      editorTextarea.value = md;
      updatePreview(md);
      debounceAutosave();
    });
  }

  // Theme
  if (themeSelect) {
    themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
  }
  if (darkModeToggle) {
    darkModeToggle.addEventListener("click", () => {
      const isDark = !document.body.classList.contains("dark");
      applyDarkMode(isDark);
    });
  }

  // Toolbar more
  if (toolbarMoreBtn && toolbarMoreMenu) {
    toolbarMoreBtn.addEventListener("click", () => {
      toolbarMoreMenu.classList.toggle("visible");
    });
  }

  // Search filter
  if (searchInput && fileListEl) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase();
      const items = fileListEl.querySelectorAll(".file-node");
      items.forEach((li) => {
        const text = li.textContent.toLowerCase();
        li.style.display = text.includes(q) ? "" : "none";
      });
    });
  }

  // Upload system
  const fileUploadBtn = document.getElementById("file-upload-btn");
  const fileUploadInput = document.getElementById("file-upload-input");
  const dropZone = document.getElementById("drop-zone");
  const progress = document.getElementById("upload-progress");
  const progressBar = document.getElementById("upload-progress-bar");

  if (fileUploadBtn && fileUploadInput) {
    fileUploadBtn.addEventListener("click", () => {
      fileUploadInput.click();
    });

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

  if (insertSelectedBtn) {
    insertSelectedBtn.addEventListener("click", () => {
      uploadedImages.forEach((img) => {
        const target = isWysiwygMode ? wysiwygEl : editorTextarea;
        insertAtCursor(
          target,
          `![Image](${img.optimizedUrl || img.originalUrl})\n`
        );
      });

      const md = isWysiwygMode
        ? htmlToMarkdown(wysiwygEl.innerHTML)
        : editorTextarea.value;
      updatePreview(md);
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
    // Logged in
    document.body.classList.remove("logged-out");
    document.body.classList.add("logged-in");
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("cms").style.display = "flex";

    userDisplay.textContent = `Logged in as ${me.login}`;

    await loadFiles();
  } else {
    // Not logged in
    document.body.classList.add("logged-out");
    document.body.classList.remove("logged-in");
    document.getElementById("login-screen").style.display = "flex";
    document.getElementById("cms").style.display = "none";

    setStatus("Please log in");
    setAutosaveStatus("idle");
    return;
  }

  await new Promise(requestAnimationFrame);

  setMode(false);
  setStatus("Ready");
  setAutosaveStatus("idle");

  wireEvents();
}

init();
