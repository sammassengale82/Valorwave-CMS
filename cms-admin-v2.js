/* ============================================================
   Valor Wave Visual CMS — Full Visual Editor Engine
   - Loads LIVE site as draft
   - Click-to-edit sections & elements
   - Popup editor for text, images, buttons
   - Draft save (local)
   - Publish to GitHub via Worker
   - Theme support
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

/* ------------------------------------------------------------
   STATE
------------------------------------------------------------ */
let currentTarget = null; // { type, selector }
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
    injectEditableBehavior();
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
  const type = node.getAttribute("data-editable") || "text";
  const selector = buildSelector(node);

  currentTarget = { type, selector };

  editorTextBlock.classList.add("hidden");
  editorImageBlock.classList.add("hidden");

  if (type === "image") {
    editorTitle.textContent = "Edit Image";
    editorImageBlock.classList.remove("hidden");
    editorImageUrl.value = node.getAttribute("src") || "";
  } else {
    editorTitle.textContent = "Edit Content";
    editorTextBlock.classList.remove("hidden");
    editorTextarea.value = node.innerHTML.trim();
  }

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

  if (currentTarget.type === "image") {
    const url = editorImageUrl.value.trim();
    if (url) node.setAttribute("src", url);

    if (editorImageFile.files[0]) {
      await uploadAndReplaceImage(node, editorImageFile.files[0]);
    }
  } else {
    node.innerHTML = editorTextarea.value;
  }

  currentDraftHtml = doc.documentElement.outerHTML;
  overlay.classList.add("hidden");
  setStatus("Draft updated");
}

/* ------------------------------------------------------------
   IMAGE UPLOAD
------------------------------------------------------------ */
async function uploadAndReplaceImage(node, file) {
  try {
    setStatus("Uploading image…");

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/upload-image", {
      method: "POST",
      body: form
    });

    if (!res.ok) {
      setStatus("Image upload failed");
      return;
    }

    const data = await res.json();
    if (data.optimized) {
      node.setAttribute("src", data.optimized);
      setStatus("Image updated");
    }
  } catch (err) {
    console.error(err);
    setStatus("Image upload error");
  }
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
  const hadDraft = loadDraftFromLocal();
  if (!hadDraft) {
    await loadLiveAsDraft();
  }
})();