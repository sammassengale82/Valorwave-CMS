/* ============================================================
   Valor Wave Visual CMS — Full Visual Editor Engine
============================================================ */

/* ------------------------------------------------------------
   DOM HOOKS
------------------------------------------------------------ */
const statusEl = document.getElementById("cms-status");
const frame = document.getElementById("preview-frame");

const overlay = document.getElementById("editor-overlay");
const editorTitle = document.getElementById("editor-title");
const editorTextarea = document.getElementById("editor-textarea");
const editorImageBlock = document.getElementById("editor-image-block");
const editorTextBlock = document.getElementById("editor-text-block");
const editorImageUrl = document.getElementById("editor-image-url");
const editorImageFile = document.getElementById("editor-image-file");

const btnSaveDraft = document.getElementById("btn-save-draft");
const btnPublish = document.getElementById("btn-publish");
const btnLogout = document.getElementById("btn-logout");
const btnEditorClose = document.getElementById("editor-close");
const btnEditorCancel = document.getElementById("editor-cancel");
const btnEditorSave = document.getElementById("editor-save");

const cmsThemeSelect = document.getElementById("cms-theme-select");
const siteThemeSelect = document.getElementById("site-theme-select");

/* ------------------------------------------------------------
   STATE
------------------------------------------------------------ */
let currentTarget = null;
let currentDraftHtml = null;

/* ------------------------------------------------------------
   HELPERS
------------------------------------------------------------ */
function setStatus(msg) {
  statusEl.textContent = msg;
}

function decodeGitHubContent(json) {
  if (!json || !json.content) return "";
  const b64 = json.content.replace(/\n/g, "");
  return atob(b64);
}

function getFrameDoc() {
  return frame.contentDocument || frame.contentWindow.document;
}

function loadHtmlIntoFrame(html) {
  frame.srcdoc = html;
  frame.onload = () => {
    injectEditableMarkers();
    injectEditableBehavior();
    applyWebsiteTheme();
  };
}

/* ------------------------------------------------------------
   LOAD LIVE SITE AS DRAFT
------------------------------------------------------------ */
async function loadLiveAsDraft() {
  try {
    setStatus("Loading live site…");

    const res = await fetch("/api/load", { cache: "no-store" });
    if (!res.ok) {
      setStatus("Failed to load live site");
      return;
    }

    const data = await res.json();
    const html = decodeGitHubContent(data);

    currentDraftHtml = html;
    loadHtmlIntoFrame(html);

    setStatus("Live site loaded");
  } catch (err) {
    console.error(err);
    setStatus("Error loading live site");
  }
}

/* ------------------------------------------------------------
   CONVERT COMMENT MARKERS → EDITABLE ATTRIBUTES
------------------------------------------------------------ */
function injectEditableMarkers() {
  const doc = getFrameDoc();
  if (!doc) return;

  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);

  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent.trim();

    if (text.startsWith("cms:editable:")) {
      const nextEl = node.nextElementSibling;
      if (nextEl) {
        nextEl.setAttribute("data-editable", "text");
      }
    }
  }
}

/* ------------------------------------------------------------
   EDITABLE BEHAVIOR INSIDE IFRAME
------------------------------------------------------------ */
function injectEditableBehavior() {
  const doc = getFrameDoc();
  if (!doc) return;

  const editableNodes = doc.querySelectorAll("[data-editable]");
  editableNodes.forEach((node) => {
    node.classList.add("editable-highlight");
    node.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openEditor(node);
    });
  });
}

function buildSelector(node) {
  if (node.id) return `#${node.id}`;

  const parts = [];
  let el = node;

  while (el && el.nodeType === 1 && parts.length < 5) {
    let sel = el.tagName.toLowerCase();
    if (el.className) {
      const cls = String(el.className).split(/\s+/)[0];
      if (cls) sel += "." + cls.replace(/[^a-zA-Z0-9_-]/g, "");
    }
    parts.unshift(sel);
    el = el.parentElement;
  }

  return parts.join(" > ");
}

/* ------------------------------------------------------------
   OPEN POPUP EDITOR
------------------------------------------------------------ */
function openEditor(node) {
  const selector = buildSelector(node);
  currentTarget = { selector };

  editorTextBlock.classList.remove("hidden");
  editorImageBlock.classList.add("hidden");

  editorTitle.textContent = "Edit Content";
  editorTextarea.value = node.innerHTML.trim();

  overlay.classList.remove("hidden");
}

/* ------------------------------------------------------------
   APPLY EDITOR CHANGES
------------------------------------------------------------ */
async function applyEditorChanges() {
  if (!currentTarget) return;

  const doc = getFrameDoc();
  const node = doc.querySelector(currentTarget.selector);
  if (!node) {
    overlay.classList.add("hidden");
    return;
  }

  node.innerHTML = editorTextarea.value;

  currentDraftHtml = doc.documentElement.outerHTML;
  overlay.classList.add("hidden");
  setStatus("Draft updated");
}

/* ------------------------------------------------------------
   DRAFT SAVE (LOCAL)
------------------------------------------------------------ */
function saveDraftLocally() {
  const doc = getFrameDoc();
  if (!doc) return;

  const html = doc.documentElement.outerHTML;
  currentDraftHtml = html;

  try {
    localStorage.setItem("valorwave_cms_draft", html);
    setStatus("Draft saved locally");
  } catch {
    setStatus("Draft saved (memory only)");
  }
}

function loadDraftFromLocal() {
  try {
    const stored = localStorage.getItem("valorwave_cms_draft");
    if (stored) {
      currentDraftHtml = stored;
      loadHtmlIntoFrame(stored);
      setStatus("Loaded local draft");
      return true;
    }
  } catch {}
  return false;
}

/* ------------------------------------------------------------
   PUBLISH TO GITHUB
------------------------------------------------------------ */
async function publishDraft() {
  const doc = getFrameDoc();
  if (!doc) return;

  const html = doc.documentElement.outerHTML;

  setStatus("Publishing…");
  btnPublish.disabled = true;

  try {
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: html,
        message: "Publish from Visual CMS"
      })
    });

    if (!res.ok) {
      setStatus("Publish failed");
      btnPublish.disabled = false;
      return;
    }

    setStatus("Published!");
    btnPublish.disabled = false;
  } catch (err) {
    console.error(err);
    setStatus("Publish error");
    btnPublish.disabled = false;
  }
}

/* ------------------------------------------------------------
   LOGOUT
------------------------------------------------------------ */
async function logout() {
  try {
    await fetch("/api/logout", { method: "POST" });
  } catch {}
  window.location.href = "/login";
}

/* ------------------------------------------------------------
   THEME SUPPORT
------------------------------------------------------------ */
function applyCmsTheme() {
  const theme = localStorage.getItem("cms_theme") || "original";
  document.body.classList.remove("theme-original", "theme-multicam", "theme-patriotic");
  document.body.classList.add(`theme-${theme}`);
}

function applyWebsiteTheme() {
  const doc = getFrameDoc();
  if (!doc) return;

  const theme = localStorage.getItem("site_theme") || "original";
  doc.body.classList.remove("theme-original", "theme-multicam", "theme-patriotic");
  doc.body.classList.add(`theme-${theme}`);
}

/* ------------------------------------------------------------
   THEME SELECTOR EVENTS
------------------------------------------------------------ */
cmsThemeSelect.addEventListener("change", (e) => {
  localStorage.setItem("cms_theme", e.target.value);
  applyCmsTheme();
});

siteThemeSelect.addEventListener("change", (e) => {
  localStorage.setItem("site_theme", e.target.value);
  applyWebsiteTheme();
});

/* ------------------------------------------------------------
   EVENT WIRING
------------------------------------------------------------ */
btnSaveDraft.addEventListener("click", saveDraftLocally);
btnPublish.addEventListener("click", publishDraft);
btnLogout.addEventListener("click", logout);

btnEditorClose.addEventListener("click", () => overlay.classList.add("hidden"));
btnEditorCancel.addEventListener("click", () => overlay.classList.add("hidden"));
btnEditorSave.addEventListener("click", applyEditorChanges);

/* ------------------------------------------------------------
   INIT
------------------------------------------------------------ */
(async function init() {
  applyCmsTheme();

  frame.src = "https://sammassengale82.github.io/valorwaveentertainment/";

  const hadDraft = loadDraftFromLocal();
  if (!hadDraft) {
    await loadLiveAsDraft();
  }
})();