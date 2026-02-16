// ---------------------------------------------------------
// Valor Wave CMS - Admin Engine (W1 + T3 + L3 + B1)
// ---------------------------------------------------------

// =============== DOM REFERENCES ===============

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userDisplay = document.getElementById("user-display");

const fileListEl = document.getElementById("file-list");
const searchInput = document.getElementById("search-input");
const newFileBtn = document.getElementById("new-file-btn");
const newFolderBtn = document.getElementById("new-folder-btn");

const editorTextarea = document.getElementById("editor");
const wysiwygEl = document.getElementById("wysiwyg");
const modeToggleBtn = document.getElementById("mode-toggle");
const insertImageBtn = document.getElementById("insert-image-btn");
const saveBtn = document.getElementById("save-btn");
const currentPathEl = document.getElementById("current-path");

const previewEl = document.getElementById("preview");

const newFileModal = document.getElementById("new-file-modal");
const newFileNameInput = document.getElementById("new-file-name");
const newFileFolderInput = document.getElementById("new-file-folder");
const createFileConfirmBtn = document.getElementById("create-file-confirm");
const createFileCancelBtn = document.getElementById("create-file-cancel");

const newFolderModal = document.getElementById("new-folder-modal");
const newFolderNameInput = document.getElementById("new-folder-name");
const createFolderConfirmBtn = document.getElementById("create-folder-confirm");
const createFolderCancelBtn = document.getElementById("create-folder-cancel");

const imageModal = document.getElementById("image-modal");
const imageUrlInput = document.getElementById("image-url-input");
const insertImageConfirmBtn = document.getElementById("insert-image-confirm");
const insertImageCancelBtn = document.getElementById("insert-image-cancel");

const themeSelect = document.getElementById("theme-select");
const applyThemeBtn = document.getElementById("apply-theme-btn");
const darkModeToggle = document.getElementById("dark-mode-toggle");

const toolbarEl = document.getElementById("toolbar");
const toolbarMoreBtn = document.getElementById("toolbar-more-btn");
const toolbarMoreRow = document.getElementById("toolbar-more");

const statusMessageEl = document.getElementById("status-message");
const statusAutosaveEl = document.getElementById("status-autosave");

const toastContainer = document.getElementById("toast-container");

// =============== STATE ===============

let currentPath = null;
let currentSha = null;
let isWysiwygMode = false;
let autosaveTimer = null;
let isSaving = false;
let fileTreeData = [];
let lastContent = "";

// =============== HELPERS ===============

async function api(path, options = {}) {
  const res = await fetch(`/api/${path}`, {
    credentials: "include",
    ...options,
  });

  if (res.status === 401) {
    showToast("Session expired. Please log in again.", "error");
    setStatus("Unauthorized", true);
    return { error: "Unauthorized" };
  }

  try {
    return await res.json();
  } catch {
    return { error: "Invalid JSON" };
  }
}

function showToast(message, type = "info") {
  if (!toastContainer) return;
  const div = document.createElement("div");
  div.className = `toast toast-${type}`;
  div.textContent = message;
  toastContainer.appendChild(div);
  setTimeout(() => {
    div.classList.add("visible");
  }, 10);
  setTimeout(() => {
    div.classList.remove("visible");
    setTimeout(() => div.remove(), 300);
  }, 3000);
}

function setStatus(message, isError = false) {
  if (!statusMessageEl) return;
  statusMessageEl.textContent = message;
  statusMessageEl.classList.toggle("status-error", isError);
}

function setAutosaveStatus(text) {
  if (!statusAutosaveEl) return;
  statusAutosaveEl.textContent = `Autosave: ${text}`;
}

function debounceAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  setAutosaveStatus("pending…");
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    if (currentPath) {
      saveContent(true);
    }
  }, 2000);
}

function getEditorContent() {
  return isWysiwygMode ? wysiwygEl.innerHTML : editorTextarea.value;
}

function setEditorContent(markdown) {
  editorTextarea.value = markdown;
  wysiwygEl.innerHTML = markdownToHtml(markdown);
  lastContent = markdown;
  updatePreview(markdown);
}

// Insert helpers

function insertAtCursor(target, text) {
  if (target === editorTextarea) {
    const start = target.selectionStart || 0;
    const end = target.selectionEnd || 0;
    const value = target.value;
    target.value = value.slice(0, start) + text + value.slice(end);
    target.selectionStart = target.selectionEnd = start + text.length;
    target.focus();
  } else {
    // contenteditable
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      target.innerHTML += text;
      return;
    }
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.setEndAfter(node);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function insertImageAtCursor(url) {
  const markdown = `![Image](${url})\n`;
  if (isWysiwygMode) {
    insertAtCursor(wysiwygEl, markdown);
    const md = htmlToMarkdown(wysiwygEl.innerHTML);
    editorTextarea.value = md;
    updatePreview(md);
  } else {
    insertAtCursor(editorTextarea, markdown);
    updatePreview(editorTextarea.value);
  }
  debounceAutosave();
}

// Markdown → HTML

function markdownToHtml(md) {
  if (!md) return "";
  let html = md;

  // Headings
  html = html.replace(new RegExp("^###### (.*)$", "gm"), "<h6>$1</h6>");
  html = html.replace(new RegExp("^##### (.*)$", "gm"), "<h5>$1</h5>");
  html = html.replace(new RegExp("^#### (.*)$", "gm"), "<h4>$1</h4>");
  html = html.replace(new RegExp("^### (.*)$", "gm"), "<h3>$1</h3>");
  html = html.replace(new RegExp("^## (.*)$", "gm"), "<h2>$1</h2>");
  html = html.replace(new RegExp("^# (.*)$", "gm"), "<h1>$1</h1>");

  // Bold, italic, code
  html = html.replace(new RegExp("\\*\\*(.+?)\\*\\*", "g"), "<strong>$1</strong>");
  html = html.replace(new RegExp("\\*(.+?)\\*", "g"), "<em>$1</em>");
  html = html.replace(new RegExp("`([^`]+)`", "g"), "<code>$1</code>");

  // Link regex with ZERO backslashes in the string
  const linkPattern =
    String.fromCharCode(91) + // [
    "(" +
    "[^" +
    String.fromCharCode(93) +
    "]+" +
    ")" +
    String.fromCharCode(93) + // ]
    String.fromCharCode(40) + // (
    "(" +
    "[^" +
    String.fromCharCode(41) +
    "]+" +
    ")" +
    String.fromCharCode(41); // )

  html = html.replace(
    new RegExp(linkPattern, "g"),
    '<a href="$2" target="_blank">$1</a>'
  );

  // Lists
  html = html.replace(
    new RegExp("^\\s*[-*] (.*)$", "gm"),
    "<ul><li>$1</li></ul>"
  );
  html = html.replace(
    new RegExp("^\\s*\\d+\\. (.*)$", "gm"),
    "<ol><li>$1</li></ol>"
  );

  // Paragraphs
  html = html.replace(new RegExp("\\n{2,}", "g"), "</p><p>");
  html = `<p>${html}</p>`;
  html = html.replace(new RegExp("<p><\\/p>", "g"), "");

  return html;
}

// HTML → Markdown

function htmlToMarkdown(html) {
  if (!html) return "";
  let md = html;

  // Headings
  md = md.replace(new RegExp("<h1>(.*?)<\\/h1>", "gi"), "# $1\n\n");
  md = md.replace(new RegExp("<h2>(.*?)<\\/h2>", "gi"), "## $1\n\n");
  md = md.replace(new RegExp("<h3>(.*?)<\\/h3>", "gi"), "### $1\n\n");
  md = md.replace(new RegExp("<h4>(.*?)<\\/h4>", "gi"), "#### $1\n\n");
  md = md.replace(new RegExp("<h5>(.*?)<\\/h5>", "gi"), "##### $1\n\n");
  md = md.replace(new RegExp("<h6>(.*?)<\\/h6>", "gi"), "###### $1\n\n");

  // Bold / italic / underline / strike
  md = md.replace(new RegExp("<strong>(.*?)<\\/strong>", "gi"), "**$1**");
  md = md.replace(new RegExp("<b>(.*?)<\\/b>", "gi"), "**$1**");
  md = md.replace(new RegExp("<em>(.*?)<\\/em>", "gi"), "*$1*");
  md = md.replace(new RegExp("<i>(.*?)<\\/i>", "gi"), "*$1*");
  md = md.replace(new RegExp("<u>(.*?)<\\/u>", "gi"), "$1");
  md = md.replace(new RegExp("<s>(.*?)<\\/s>", "gi"), "~~$1~~");

  // Code
  md = md.replace(new RegExp("<code>(.*?)<\\/code>", "gi"), "`$1`");

  // Links
  md = md.replace(
    new RegExp('<a [^>]*href="([^"]+)"[^>]*>(.*?)<\\/a>', "gi"),
    "[$2]($1)"
  );

  // Lists
  md = md.replace(
    new RegExp("<ul>\\s*<li>(.*?)<\\/li>\\s*<\\/ul>", "gis"),
    "- $1\n"
  );
  md = md.replace(
    new RegExp("<ol>\\s*<li>(.*?)<\\/li>\\s*<\\/ol>", "gis"),
    "1. $1\n"
  );

  // Line breaks / paragraphs
  md = md.replace(new RegExp("<br\\s*\\/?>", "gi"), "\n");
  md = md.replace(new RegExp("<\\/p>\\s*<p>", "gi"), "\n\n");
  md = md.replace(new RegExp("<\\/?p>", "gi"), "");

  // Entities
  md = md.replace(new RegExp("&nbsp;", "g"), " ");
  md = md
    .replace(new RegExp("&lt;", "g"), "<")
    .replace(new RegExp("&gt;", "g"), ">")
    .replace(new RegExp("&amp;", "g"), "&");

  return md.trim();
}

function updatePreview(markdown) {
  if (!previewEl) return;
  previewEl.innerHTML = markdownToHtml(markdown);
}

// =============== AUTH / USER ===============

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

// =============== FILE TREE ===============

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
          __children: isFile ? null : {},
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
    return;
  }
  fileTreeData = files;
  const tree = buildTree(files);
  renderTree(tree, fileListEl);
  setStatus("Files loaded");
}

// =============== FILE OPERATIONS ===============

async function openFile(path) {
  const data = await api(`content?path=${encodeURIComponent(path)}`);
  if (!data || data.error) {
    showToast("Error loading file", "error");
    setStatus("Error loading file", true);
    return;
  }
  currentPath = data.path;
  currentSha = data.sha || null;
  currentPathEl.textContent = data.path;
  setEditorContent(data.content || "");
  setStatus(`Opened ${data.path}`);
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

  const res = await api(`content?path=${encodeURIComponent(currentPath)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      message: `${isAutosave ? "Autosave" : "Update"} ${currentPath} via CMS`,
    }),
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
  newFileNameInput.value = "";
  newFileFolderInput.value = "";
  newFileModal.classList.remove("hidden");
  newFileNameInput.focus();
}

async function confirmNewFile() {
  const name = newFileNameInput.value.trim();
  const folder = newFileFolderInput.value.trim();
  if (!name) {
    showToast("File name required", "error");
    return;
  }
  const path = folder
    ? `content/${folder.replace(/\/+$/, "")}/${name}`
    : `content/${name}`;

  const res = await api("new-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      content: "# New File\n",
      message: `Create ${path} via CMS`,
    }),
  });

  if (!res || res.error) {
    showToast("Failed to create file", "error");
    return;
  }

  newFileModal.classList.add("hidden");
  await loadFiles();
  await openFile(path);
}

function cancelNewFile() {
  newFileModal.classList.add("hidden");
}

async function createNewFolder() {
  newFolderNameInput.value = "";
  newFolderModal.classList.remove("hidden");
  newFolderNameInput.focus();
}

async function confirmNewFolder() {
  const name = newFolderNameInput.value.trim();
  if (!name) {
    showToast("Folder name required", "error");
    return;
  }
  const path = `content/${name.replace(/\/+$/, "")}/.keep`;

  const res = await api("new-folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      content: "",
      message: `Create folder ${name} via CMS`,
    }),
  });

  if (!res || res.error) {
    showToast("Failed to create folder", "error");
    return;
  }

  newFolderModal.classList.add("hidden");
  await loadFiles();
}

function cancelNewFolder() {
  newFolderModal.classList.add("hidden");
}

// =============== IMAGE MODAL ===============

function openImageModal() {
  imageUrlInput.value = "";
  imageModal.classList.remove("hidden");
  imageUrlInput.focus();
}

function closeImageModal() {
  imageModal.classList.add("hidden");
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

// =============== MODE TOGGLE ===============

function setMode(wysiwyg) {
  isWysiwygMode = wysiwyg;
  if (wysiwyg) {
    wysiwygEl.innerHTML = markdownToHtml(editorTextarea.value);
    wysiwygEl.classList.remove("hidden");
    editorTextarea.classList.add("hidden");
    modeToggleBtn.textContent = "Markdown";
  } else {
    const md = htmlToMarkdown(wysiwygEl.innerHTML);
    editorTextarea.value = md;
    wysiwygEl.classList.add("hidden");
    editorTextarea.classList.remove("hidden");
    modeToggleBtn.textContent = "WYSIWYG";
  }
  updatePreview(getEditorContent());
}

// =============== TOOLBAR COMMANDS ===============

function execCommand(cmd) {
  wysiwygEl.focus();

  switch (cmd) {
    case "bold":
      document.execCommand("bold");
      break;
    case "italic":
      document.execCommand("italic");
      break;
    case "underline":
      document.execCommand("underline");
      break;
    case "strike":
      document.execCommand("strikeThrough");
      break;
    case "h1":
      document.execCommand("formatBlock", false, "h1");
      break;
    case "h2":
      document.execCommand("formatBlock", false, "h2");
      break;
    case "h3":
      document.execCommand("formatBlock", false, "h3");
      break;
    case "ul":
      document.execCommand("insertUnorderedList");
      break;
    case "ol":
      document.execCommand("insertOrderedList");
      break;
    case "quote":
      document.execCommand("formatBlock", false, "blockquote");
      break;
    case "code":
      document.execCommand("formatBlock", false, "pre");
      break;
    case "hr":
      document.execCommand("insertHorizontalRule");
      break;
    case "align-left":
      document.execCommand("justifyLeft");
      break;
    case "align-center":
      document.execCommand("justifyCenter");
      break;
    case "align-right":
      document.execCommand("justifyRight");
      break;
    case "indent":
      document.execCommand("indent");
      break;
    case "outdent":
      document.execCommand("outdent");
      break;
    case "remove-format":
      document.execCommand("removeFormat");
      break;
    case "color": {
      const color = prompt("Text color (CSS value):", "#ffffff");
      if (color) document.execCommand("foreColor", false, color);
      break;
    }
    case "bgcolor": {
      const color = prompt("Background color (CSS value):", "#000000");
      if (color) document.execCommand("backColor", false, color);
      break;
    }
    case "table": {
      const rows = parseInt(prompt("Rows:", "2") || "2", 10);
      const cols = parseInt(prompt("Columns:", "2") || "2", 10);
      if (!rows || !cols) break;
      let html = "<table>";
      for (let r = 0; r < rows; r++) {
        html += "<tr>";
        for (let c = 0; c < cols; c++) {
          html += "<td>&nbsp;</td>";
        }
        html += "</tr>";
      }
      html += "</table>";
      document.execCommand("insertHTML", false, html);
      break;
    }
    default:
      break;
  }

  const md = htmlToMarkdown(wysiwygEl.innerHTML);
  editorTextarea.value = md;
  updatePreview(md);
  debounceAutosave();
}

// Toolbar buttons

if (toolbarEl) {
  toolbarEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const cmd = btn.getAttribute("data-cmd");
    if (!cmd) return;
    if (!isWysiwygMode) {
      setMode(true);
    }
    execCommand(cmd);
  });
}

if (toolbarMoreBtn) {
  toolbarMoreBtn.addEventListener("click", () => {
    toolbarMoreRow.classList.toggle("hidden");
  });
}

// =============== THEME & DARK MODE ===============

function applyTheme(theme) {
  document.body.classList.remove("theme-original", "theme-multicam", "theme-patriotic");
  document.body.classList.add(`theme-${theme}`);
  localStorage.setItem("vw-theme", theme);
}

function applyDarkMode(enabled) {
  document.body.classList.toggle("dark", enabled);
  localStorage.setItem("vw-dark", enabled ? "1" : "0");
}

function initThemeFromStorage() {
  const theme = localStorage.getItem("vw-theme") || "original";
  if (themeSelect) themeSelect.value = theme;
  applyTheme(theme);

  const dark = localStorage.getItem("vw-dark") === "1";
  applyDarkMode(dark);
}

// =============== KEYBOARD SHORTCUTS ===============

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveContent(false);
  }

  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key === "N" || e.key === "n") {
      if (e.shiftKey) {
        e.preventDefault();
        createNewFolder();
      } else {
        e.preventDefault();
        createNewFile();
      }
    }
    if (e.key === "D" || e.key === "d") {
      e.preventDefault();
      const isDark = !document.body.classList.contains("dark");
      applyDarkMode(isDark);
    }
    if (e.key === "T" || e.key === "t") {
      if (e.shiftKey) {
        e.preventDefault();
        applyTheme(themeSelect.value);
      }
    }
    if (e.key === "I" || e.key === "i") {
      e.preventDefault();
      openImageModal();
    }
    if (e.key === "M" || e.key === "m") {
      e.preventDefault();
      setMode(!isWysiwygMode);
    }
  }
});

// =============== EVENT WIRING ===============

// Auth
if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    window.location.href = "/login";
  });
}
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    document.cookie = "session=; Path=/; Max-Age=0";
    window.location.reload();
  });
}

// Files
if (newFileBtn) newFileBtn.addEventListener("click", createNewFile);
if (createFileConfirmBtn) createFileConfirmBtn.addEventListener("click", confirmNewFile);
if (createFileCancelBtn) createFileCancelBtn.addEventListener("click", cancelNewFile);

if (newFolderBtn) newFolderBtn.addEventListener("click", createNewFolder);
if (createFolderConfirmBtn) createFolderConfirmBtn.addEventListener("click", confirmNewFolder);
if (createFolderCancelBtn) createFolderCancelBtn.addEventListener("click", cancelNewFolder);

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
if (applyThemeBtn) {
  applyThemeBtn.addEventListener("click", () => applyTheme(themeSelect.value));
}
if (darkModeToggle) {
  darkModeToggle.addEventListener("click", () => {
    const isDark = !document.body.classList.contains("dark");
    applyDarkMode(isDark);
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

// =============== INIT ===============
async function init() {

  // Wait for DOM to fully render at least one frame
  await new Promise(requestAnimationFrame);

  // SHOW CMS UI BEFORE ANY EDITOR CODE RUNS 
  document.getElementById("cms").style.display = "block";
  
  setStatus("Loading…");

  initThemeFromStorage();

  await loadUser();
  await loadFiles();

  // Wait one frame so DOM nodes are created 
  await new Promise(requestAnimationFrame);

  // NOW the editor exists
  setMode(false);

  setStatus("Ready");
  setAutosaveStatus("idle");

    // Upload system
  const fileUploadBtn = document.getElementById("file-upload-btn");
  const fileUploadInput = document.getElementById("file-upload-input");
  const dropZone = document.getElementById("drop-zone");
  const gallery = document.getElementById("upload-gallery");
  const insertSelectedBtn = document.getElementById("insert-selected-btn");
  const progress = document.getElementById("upload-progress");
  const progressBar = document.getElementById("upload-progress-bar");

  let uploadedImages = [];

  function updateInsertButton() {
    insertSelectedBtn.disabled = uploadedImages.length === 0;
  }

  function addThumbnail(thumbUrl, originalUrl, webpUrl, optimizedUrl) {
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

    gallery.appendChild(div);
    uploadedImages.push({ thumbUrl, originalUrl, webpUrl, optimizedUrl });
    updateInsertButton();
  }

  async function uploadFile(file) {
    progress.style.display = "block";
    progressBar.style.width = "0%";

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/upload-image");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = (e.loaded / e.total) * 100;
        progressBar.style.width = percent + "%";
      }
    };

    xhr.onload = () => {
      progressBar.style.width = "100%";
      setTimeout(() => {
        progress.style.display = "none";
      }, 500);

      try {
        const res = JSON.parse(xhr.responseText);
        addThumbnail(res.thumb, res.original, res.webp, res.optimized);
      } catch {
        showToast("Upload failed (invalid response)", "error");
      }
    };

    xhr.onerror = () => {
      progress.style.display = "none";
      showToast("Upload failed", "error");
    };

    xhr.send(formData);
  }

  function handleFiles(files) {
    [...files].forEach((file) => {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        showToast("Only PNG, JPG, and WEBP images are allowed.", "error");
        return;
      }
      uploadFile(file);
    });
  }

  if (fileUploadBtn && fileUploadInput) {
    fileUploadBtn.addEventListener("click", () => {
      fileUploadInput.click();
    });

    fileUploadInput.addEventListener("change", (e) => {
      handleFiles(e.target.files);
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
      handleFiles(e.dataTransfer.files);
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
      gallery.innerHTML = "";
      updateInsertButton();
    });
  }
  // =============== MISSING HELPERS (UPLOAD + INSERT) ===============

// Basic "triggerUpload" for the top Upload Image button
function triggerUpload() {
  if (fileUploadInput) {
    fileUploadInput.click();
  }
}

// Wire the hidden input to reuse the same handler as drop
if (fileUploadInput) {
  fileUploadInput.addEventListener("change", (e) => {
    const files = e.target.files;
    if (files && files.length) {
      Array.from(files).forEach((f) => handleUploadFile(f));
    }
  });
}

// Fallback for handleUploadFile used by the global drag/drop
function handleUploadFile(file) {
  // Reuse the multi-image upload pipeline if you want,
  // or just no-op safely for now:
  // uploadFile(file); // if uploadFile is in scope
  console.warn("handleUploadFile called, but no upload pipeline wired for this entry point yet.", file);
}

// Generic insertAtCursor used by the gallery "Insert Selected" button
function insertAtCursor(target, text) {
  // If we're in WYSIWYG, just append markdown into the textarea mirror
  if (target === wysiwygEl) {
    const md = htmlToMarkdown(wysiwygEl.innerHTML) + text;
    editorTextarea.value = md;
    wysiwygEl.innerHTML = markdownToHtml(md);
    updatePreview(md);
    debounceAutosave();
    return;
  }

  // Plain textarea insertion
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
  } // <-- CLOSE init() 
init(); // <-- CALL init()
