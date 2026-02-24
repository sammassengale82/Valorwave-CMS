/* ============================================================
   VALOR WAVE CMS ADMIN — PHASE 14 (Popup Editor)
   cms-admin-v3.js — UPDATED
============================================================ */

/* -------------------------------
   AUTH / GITHUB SESSION MARKER
-------------------------------- */
let githubToken = null;

/* -------------------------------
   DOM REFERENCES (HEADER / LAYOUT)
-------------------------------- */
const editableFrame = document.getElementById("preview-frame-editable");
const liveFrame = document.getElementById("preview-frame-live");

const saveDraftBtn = document.getElementById("save-draft");
const publishBtn = document.getElementById("publish");
const logoutBtn = document.getElementById("logout");
const githubLoginBtn = document.getElementById("github-login");
const authStatus = document.getElementById("auth-status");

const repoLiveFilesContainer = document.getElementById("repo-live-files");
const repoCmsFilesContainer = document.getElementById("repo-cms-files");

const draftHistoryBtn = document.getElementById("draft-history");
const draftHistoryOverlay = document.getElementById("draft-history-overlay");
const draftList = document.getElementById("draft-list");
const closeDraftHistoryBtn = document.getElementById("close-draft-history");

const publishLogsBtn = document.getElementById("publish-logs");
const publishLogsOverlay = document.getElementById("publish-logs-overlay");
const publishLogList = document.getElementById("publish-log-list");
const closePublishLogsBtn = document.getElementById("close-publish-logs");

const addSectionBtn = document.getElementById("add-section");

/* Header theme controls */
const headerCmsThemeSelect = document.getElementById("cms-theme");
const headerSiteThemeSelect = document.getElementById("site-theme");
const headerCmsThemeSavedMsg = document.getElementById("cms-theme-saved");
const headerSiteThemeSavedMsg = document.getElementById("site-theme-saved");

/* -------------------------------
   PANEL DOM REFERENCES (legacy image panel only)
-------------------------------- */
let panelRoot = null; // used only for image file editing

/* ============================================================
   TWO-SUBDOMAIN ARCHITECTURE
============================================================ */
const API_BASE = "https://cms-api.valorwaveentertainment.com";

/* ============================================================
   LOGIN / LOGOUT
============================================================ */
githubLoginBtn?.addEventListener("click", () => {
    window.location.href = `${API_BASE}/login`;
});

logoutBtn?.addEventListener("click", async () => {
    try {
        await fetch(`${API_BASE}/api/logout`, {
            method: "POST",
            credentials: "include"
        });
        window.location.reload();
    } catch (e) {
        console.error(e);
        alert("Logout failed.");
    }
});

/* ============================================================
   AUTH STATUS
============================================================ */
async function checkAuthStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/me`, {
            credentials: "include"
        });

        if (!res.ok) {
            if (authStatus) authStatus.textContent = "Not authenticated.";
            return false;
        }

        const user = await res.json();
        if (authStatus) authStatus.textContent = `Logged in as ${user.login}`;
        githubToken = "session-active";
        return true;
    } catch (e) {
        console.error("Auth check failed:", e);
        if (authStatus) authStatus.textContent = "Auth check failed.";
        return false;
    }
}

async function enforceLogin() {
    const loggedIn = await checkAuthStatus();

    if (!loggedIn) {
        document.body.innerHTML = `
            <div style="padding:40px;text-align:center;">
                <h2>Please log in to access the CMS</h2>
                <button id="login-now" class="btn">Login with GitHub</button>
            </div>
        `;

        document.getElementById("login-now").addEventListener("click", () => {
            window.location.href = `${API_BASE}/login`;
        });

        return false;
    }

    return true;
}

/* ============================================================
   GITHUB API HELPERS
============================================================ */
async function githubApiRequest(path, method = "GET", body = null, repo, owner = "sammassengale82") {
    const res = await fetch(`${API_BASE}/api/github`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, method, body, repo, owner })
    });

    if (!res.ok) throw new Error(`GitHub ${method} failed: ${res.status}`);
    return res.json();
}

async function getFileSha(path, repo) {
    try {
        const data = await githubApiRequest(path, "GET", null, repo);
        return data.sha || null;
    } catch {
        return null;
    }
}

async function commitFile(path, content, message, repo) {
    const sha = await getFileSha(path, repo);
    const encoded = btoa(unescape(encodeURIComponent(content)));

    const body = { message, content: encoded };
    if (sha) body.sha = sha;

    return githubApiRequest(path, "PUT", body, repo);
}

/* -------------------------------
   GLOBAL STATE
-------------------------------- */
let currentEditTarget = null;
let currentEditType = "text";
let currentTargetSelector = null;

let latestDomHtml = null;
let folderState = {};
let contextTarget = null;
let dragItem = null;
let dragOverItem = null;

let addSectionOverlay = null;
let addSectionModal = null;
let templateListEl = null;
let targetBlockSelect = null;
let positionSelectBefore = null;
let positionSelectAfter = null;

let lastSavedHtml = null;
let selectedItems = new Set();

/* ============================================================
   POPUP EDITOR — HYBRID SYSTEM (CONTENT + DESIGN + SETTINGS)
============================================================ */
let editorModal = null;
let editorModalTitle = null;
let editorModalSaveBtn = null;
let editorModalCancelBtn = null;
let editorModalCloseBtn = null;

let currentEditPayload = null;

function initEditorModal() {
    editorModal = document.getElementById("editor-modal");
    editorModalTitle = document.getElementById("editor-modal-title");
    editorModalSaveBtn = document.getElementById("editor-modal-save");
    editorModalCancelBtn = document.getElementById("editor-modal-cancel");
    editorModalCloseBtn = document.getElementById("editor-modal-close");

    const close = () => {
        editorModal.classList.remove("open");
        editorModal.setAttribute("aria-hidden", "true");
        currentEditPayload = null;
    };

    editorModalCloseBtn.addEventListener("click", close);
    editorModalCancelBtn.addEventListener("click", close);

    editorModalSaveBtn.addEventListener("click", () => {
        if (!currentEditPayload) return;

        const html = document.getElementById("editor-modal-input").value;

        const design = {};
        document.querySelectorAll("[data-design]").forEach(el => {
            if (el.value !== "") design[el.dataset.design] = el.value;
        });

        const settings = {};
        document.querySelectorAll("[data-setting]").forEach(el => {
            if (el.value !== "") settings[el.dataset.setting] = el.value;
        });

        editableFrame.contentWindow.postMessage(
            {
                type: "ve-apply-edit",
                blockId: currentEditPayload.blockId,
                html,
                design,
                settings
            },
            "*"
        );

        close();
    });
}

function openEditorModalFromPayload(payload) {
    if (!editorModal) initEditorModal();

    currentEditPayload = payload;

    editorModalTitle.textContent = `Edit: ${payload.blockId}`;

    /* CONTENT */
    const contentFields = document.getElementById("editor-content-fields");
    contentFields.innerHTML = `
        <label>Inner HTML</label>
        <textarea id="editor-modal-input" class="editor-input">${payload.html || ""}</textarea>

        <label>Link URL</label>
        <input id="editor-link-url" class="editor-input" type="text">
    `;

    /* DESIGN */
    const designFields = document.getElementById("editor-design-fields");
    designFields.innerHTML = `
        <label>Font Size (px)</label>
        <input data-design="fontSize" class="editor-input" type="number">

        <label>Text Color</label>
        <input data-design="color" class="editor-input" type="color">

        <label>Background</label>
        <input data-design="backgroundColor" class="editor-input" type="color">

        <label>Padding (px)</label>
        <input data-design="padding" class="editor-input" type="number">
    `;

    /* SETTINGS */
    const settingsFields = document.getElementById("editor-settings-fields");
    settingsFields.innerHTML = `
        <label>Element ID</label>
        <input data-setting="id" class="editor-input" type="text">

        <label>CSS Classes</label>
        <input data-setting="class" class="editor-input" type="text">

        <label>Visibility</label>
        <select data-setting="visibility" class="editor-select">
            <option value="">Default</option>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
        </select>
    `;

    editorModal.classList.add("open");
    editorModal.setAttribute("aria-hidden", "false");
}

/* ============================================================
   MESSAGE LISTENER — OPEN POPUP
============================================================ */
window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === "open-editor") {
        openEditorModalFromPayload({
            blockId: msg.blockId,
            html: msg.html
        });
    }

    if (msg.type === "dom-updated") {
        latestDomHtml = msg.html;
        showUnsavedIndicator();
    }
});

/* ============================================================
   THEME SYSTEM (HEADER ONLY)
============================================================ */
function applyCmsTheme(theme) {
    document.body.className = `theme-${theme}`;
}

function sendThemeToFrames(theme) {
    const msg = { type: "set-theme", theme };
    try { editableFrame?.contentWindow.postMessage(msg, "*"); } catch {}
    try { liveFrame?.contentWindow.postMessage(msg, "*"); } catch {}
}

function syncHeaderThemeControls(cmsTheme, siteTheme) {
    if (headerCmsThemeSelect) headerCmsThemeSelect.value = cmsTheme;
    if (headerSiteThemeSelect) headerSiteThemeSelect.value = siteTheme;
}

function loadSavedThemes() {
    const cmsTheme = localStorage.getItem("cms-theme") || "original";
    const siteTheme = localStorage.getItem("site-theme") || "original";

    syncHeaderThemeControls(cmsTheme, siteTheme);
    applyCmsTheme(cmsTheme);
    sendThemeToFrames(siteTheme);
}

function wireHeaderThemeControls() {
    headerCmsThemeSelect?.addEventListener("change", (e) => {
        const theme = e.target.value;
        applyCmsTheme(theme);
    });

    headerSiteThemeSelect?.addEventListener("change", (e) => {
        const theme = e.target.value;
        sendThemeToFrames(theme);
    });

    const headerSaveCms = document.getElementById("save-cms-theme");
    const headerSaveSite = document.getElementById("save-site-theme");

    headerSaveCms?.addEventListener("click", () => {
        const theme = headerCmsThemeSelect?.value || "original";
        localStorage.setItem("cms-theme", theme);
        applyCmsTheme(theme);
        if (headerCmsThemeSavedMsg) {
            headerCmsThemeSavedMsg.style.opacity = "1";
            setTimeout(() => headerCmsThemeSavedMsg.style.opacity = "0", 1200);
        }
    });

    headerSaveSite?.addEventListener("click", () => {
        const theme = headerSiteThemeSelect?.value || "original";
        localStorage.setItem("site-theme", theme);
        sendThemeToFrames(theme);
        if (headerSiteThemeSavedMsg) {
            headerSiteThemeSavedMsg.style.opacity = "1";
            setTimeout(() => headerSiteThemeSavedMsg.style.opacity = "0", 1200);
        }
    });
}

/* ============================================================
   PREVIEW LOADING
============================================================ */
function loadEditablePreview() {
    const frame = document.getElementById("preview-frame-editable");
    if (!frame) return;

    frame.src = "https://sammassengale82.github.io/valorwaveentertainment/editable/index.html";

    frame.onload = () => {
        frame.contentWindow.postMessage({ type: "ve-init" }, "*");

        const siteTheme = localStorage.getItem("site-theme") || "original";
        frame.contentWindow.postMessage({ type: "set-theme", theme: siteTheme }, "*");
    };
}

function loadLivePreview() {
    const frame = document.getElementById("preview-frame-live");
    if (!frame) return;

    frame.src = "https://valorwaveentertainment.com";
}

/* ============================================================
   UNSAVED INDICATOR + DIFF
============================================================ */
function showUnsavedIndicator() {
    const header = document.getElementById("cms-header");
    if (!header) return;

    let badge = header.querySelector(".unsaved-indicator");
    if (!badge) {
        badge = document.createElement("span");
        badge.className = "unsaved-indicator";
        badge.textContent = "Unsaved changes";
        header.appendChild(badge);
    }
    badge.style.display = "inline-block";
}

function hideUnsavedIndicator() {
    const header = document.getElementById("cms-header");
    if (!header) return;

    const badge = header.querySelector(".unsaved-indicator");
    if (badge) badge.style.display = "none";
}

function updateLastSavedHtml(html) {
    lastSavedHtml = html;
}

function showUnsavedDiff() {
    if (!lastSavedHtml || !latestDomHtml) return;
    if (typeof showDiffViewer === "function") {
        showDiffViewer(lastSavedHtml, latestDomHtml, "index.html");
    }
}

/* ============================================================
   FILE SIDEBAR — TREE VIEW
============================================================ */
function isTextFile(name) {
    const lower = name.toLowerCase();
    return (
        lower.endsWith(".html") ||
        lower.endsWith(".css") ||
        lower.endsWith(".js") ||
        lower.endsWith(".txt") ||
        lower.endsWith(".md") ||
        lower.endsWith(".xml") ||
        lower.endsWith(".json")
    );
}

async function loadFolder(repoName, path) {
    return githubApiRequest(path, "GET", null, repoName);
}

function sortEntriesFoldersFirst(entries) {
    return entries.sort((a, b) => {
        if (a.type === "dir" && b.type !== "dir") return -1;
        if (a.type !== "dir" && b.type === "dir") return 1;
        return a.name.localeCompare(b.name);
    });
}

function createFileItem(entry, repoName, depth) {
    const item = document.createElement("div");
    item.className = "file-item";
    item.draggable = true;
    item.dataset.repo = repoName;
    item.dataset.path = entry.path;
    item.dataset.type = entry.type;
    item.dataset.depth = depth;

    const indent = document.createElement("span");
    indent.className = "file-indent";
    indent.style.setProperty("--indent", `${depth * 16}px`);
    item.appendChild(indent);

    const label = document.createElement("span");

    if (entry.type === "dir") {
        label.textContent = entry.name;
        label.classList.add("folder-label");

        const key = `${repoName}/${entry.path}`;
        const expanded = folderState[key] === true;

        label.classList.add(expanded ? "folder-expanded" : "folder-collapsed");

        label.addEventListener("click", async () => {
            const expandedNow = folderState[key] === true;
            folderState[key] = !expandedNow;
            saveFolderState();
            renderFolder(repoName, entry.path, item, depth);
        });
    } else {
        label.textContent = entry.name;
        label.classList.add("file-item-file");

        label.addEventListener("click", () => {
            if (isTextFile(entry.name)) {
                openFileFromRepo(repoName, entry.path);
            } else {
                openImageFileInPanel(repoName, entry.path, entry.name);
            }
        });
    }

    item.appendChild(label);
    return item;
}

async function renderFolder(repoName, path, container, depth) {
    const children = Array.from(container.parentElement.children).filter(
        el => el.dataset?.parent === `${repoName}/${path}`
    );
    children.forEach(el => el.remove());

    const key = `${repoName}/${path}`;
    const expanded = folderState[key] === true;

    const folderLabel = container.querySelector(".folder-label");
    if (folderLabel) {
        folderLabel.classList.remove("folder-expanded", "folder-collapsed");
        folderLabel.classList.add(expanded ? "folder-expanded" : "folder-collapsed");
    }

    if (!expanded) return;

    const entries = await loadFolder(repoName, path);
    const sorted = sortEntriesFoldersFirst(entries);

    sorted.forEach(entry => {
        const item = createFileItem(entry, repoName, depth + 1);
        item.dataset.parent = `${repoName}/${path}`;
        container.insertAdjacentElement("afterend", item);

        const childKey = `${repoName}/${entry.path}`;
        if (entry.type === "dir" && folderState[childKey]) {
            renderFolder(repoName, entry.path, item, depth + 1);
        }
    });
}

async function renderRepoRoot(repoName, container) {
    container.innerHTML = "";

    const entries = await loadFolder(repoName, "");
    const sorted = sortEntriesFoldersFirst(entries);

    sorted.forEach(entry => {
        const item = createFileItem(entry, repoName, 0);
        container.appendChild(item);

        const key = `${repoName}/${entry.path}`;
        if (entry.type === "dir" && folderState[key]) {
            renderFolder(repoName, entry.path, item, 0);
        }
    });
}

async function loadSidebarFileListsTree() {
    if (repoLiveFilesContainer) repoLiveFilesContainer.textContent = "Loading...";
    if (repoCmsFilesContainer) repoCmsFilesContainer.textContent = "Loading...";

    try {
        await renderRepoRoot("valorwaveentertainment", repoLiveFilesContainer);
        await renderRepoRoot("ValorWave-CMS", repoCmsFilesContainer);
    } catch (e) {
        console.error("Failed to load file lists:", e);
        if (repoLiveFilesContainer) repoLiveFilesContainer.textContent = "Error loading files.";
        if (repoCmsFilesContainer) repoCmsFilesContainer.textContent = "Error loading files.";
    }
}

/* ============================================================
   OPEN FILE FROM REPO (RAW TEXT EDIT)
============================================================ */
async function openFileFromRepo(repoName, path) {
    try {
        const file = await githubApiRequest(path, "GET", null, repoName);
        if (!file?.content) {
            alert("Unable to load file content.");
            return;
        }

        const decoded = atob(file.content);

        const payload = {
            editType: "file",
            targetSelector: null,
            html: decoded,
            path,
            repoName
        };
        openEditorModalFromPayload(payload);
    } catch (e) {
        console.error("Failed to open file:", e);
        alert("Failed to open file. Check console for details.");
    }
}

/* ============================================================
   IMAGE FILE EDITING (Phase 14 — Option C1)
============================================================ */
async function openImageFileInPanel(repoName, path, fileName) {
    if (!panelRoot) {
        panelRoot = document.getElementById("editor-panel");
    }

    const nameEl = panelRoot?.querySelector("#editor-block-name");
    if (nameEl) nameEl.textContent = `Image: ${fileName}`;

    panelRoot?.classList.remove("hidden");

    const contentFields = panelRoot?.querySelector("#editor-content-fields");
    const designFields = panelRoot?.querySelector("#editor-design-fields");
    const settingsFields = panelRoot?.querySelector("#editor-settings-fields");

    if (designFields) designFields.innerHTML = "";
    if (settingsFields) settingsFields.innerHTML = "";

    if (contentFields) {
        contentFields.innerHTML = "";

        const preview = document.createElement("img");
        preview.src = `https://raw.githubusercontent.com/sammassengale82/${repoName}/main/${path}`;
        preview.style.maxWidth = "100%";
        preview.style.border = "1px solid #ccc";
        preview.style.marginBottom = "12px";

        const uploadLabel = document.createElement("label");
        uploadLabel.textContent = "Replace Image:";

        const uploadInput = document.createElement("input");
        uploadInput.type = "file";
        uploadInput.accept = "image/*";

        contentFields.appendChild(preview);
        contentFields.appendChild(uploadLabel);
        contentFields.appendChild(uploadInput);

        uploadInput.addEventListener("change", async () => {
            const file = uploadInput.files[0];
            if (!file) return;

            const arrayBuffer = await file.arrayBuffer();
            const content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

            await githubApiRequest(path, "PUT", {
                message: `Replace image ${fileName}`,
                content
            }, repoName);

            alert("Image replaced successfully.");
            preview.src = URL.createObjectURL(file);
        });
    }
}

/* ============================================================
   CONTEXT MENU + FILE OPS
============================================================ */
const contextMenu = document.getElementById("context-menu");

document.addEventListener("click", () => {
    if (contextMenu) contextMenu.classList.add("hidden");
});

document.addEventListener("contextmenu", (e) => {
    const item = e.target.closest(".file-item");
    if (!item || !contextMenu) return;

    e.preventDefault();

    const repo = item.dataset.repo;
    const path = item.dataset.path;
    const type = item.dataset.type;
    const depth = Number(item.dataset.depth);

    contextTarget = { repo, path, type, depth, element: item };

    contextMenu.style.left = e.pageX + "px";
    contextMenu.style.top = e.pageY + "px";
    contextMenu.classList.remove("hidden");

    contextMenu.querySelector("[data-action='open']").style.display =
        type === "file" ? "block" : "none";

    contextMenu.querySelector("[data-action='rename']").style.display = "block";
    contextMenu.querySelector("[data-action='delete']").style.display = "block";

    contextMenu.querySelector("[data-action='new-file']").style.display = "block";
    contextMenu.querySelector("[data-action='new-folder']").style.display = "block";
    contextMenu.querySelector("[data-action='upload-file']").style.display = "block";
});

contextMenu?.addEventListener("click", async (e) => {
    const action = e.target.dataset.action;
    if (!action || !contextTarget) return;

    contextMenu.classList.add("hidden");

    const { repo, path, type, element, depth } = contextTarget;

    const parentFolderForNew =
        type === "dir"
            ? path
            : (path.includes("/") ? path.split("/").slice(0, -1).join("/") : "");

    switch (action) {
        case "open":
            if (type === "file") {
                if (isTextFile(path)) {
                    await openFileFromRepo(repo, path);
                } else {
                    await openImageFileInPanel(repo, path, path.split("/").pop());
                }
            }
            break;
        case "new-file":
            await createNewFile(repo, parentFolderForNew);
            break;
        case "new-folder":
            await createNewFolder(repo, parentFolderForNew);
            break;
        case "upload-file":
            await uploadFileToFolder(repo, parentFolderForNew);
            break;
        case "rename":
            await renameItem(repo, path, type);
            break;
        case "delete":
            await deleteItem(repo, path, type);
            break;
    }

    const parentPath = path.includes("/") ? path.split("/").slice(0, -1).join("/") : "";
    const parentContainer = element;
    await renderFolder(repo, parentPath, parentContainer, depth - 1);
});

async function createNewFile(repo, parentPath) {
    const name = prompt("Enter new file name:");
    if (!name) return;

    const fullPath = parentPath ? `${parentPath}/${name}` : name;

    await commitFile(fullPath, "", `Create file ${fullPath}`, repo);
    alert(`Created file: ${fullPath}`);
}

async function createNewFolder(repo, parentPath) {
    const name = prompt("Enter new folder name:");
    if (!name) return;

    const fullPath = parentPath ? `${parentPath}/${name}` : name;

    await commitFile(`${fullPath}/.keep`, "", `Create folder ${fullPath}`, repo);
    alert(`Created folder: ${fullPath}`);
}

async function uploadFileToFolder(repo, parentPath) {
    const input = document.createElement("input");
    input.type = "file";

    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        const arrayBuffer = await file.arrayBuffer();
        const content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        const fullPath = parentPath ? `${parentPath}/${file.name}` : file.name;

        await githubApiRequest(fullPath, "PUT", {
            message: `Upload ${file.name}`,
            content
        }, repo);

        alert(`Uploaded: ${file.name}`);
    };

    input.click();
}

async function renameItem(repo, path, type) {
    const newName = prompt("Enter new name:", path.split("/").pop());
    if (!newName) return;

    const parent = path.includes("/") ? path.split("/").slice(0, -1).join("/") : "";
    const newPath = parent ? `${parent}/${newName}` : newName;

    const file = await githubApiRequest(path, "GET", null, repo);

    await githubApiRequest(newPath, "PUT", {
        message: `Rename ${path} → ${newPath}`,
        content: file.content,
        sha: file.sha
    }, repo);

    await githubApiRequest(path, "DELETE", {
        message: `Remove old name ${path}`,
        sha: file.sha
    }, repo);

    alert(`Renamed to: ${newName}`);
}

async function deleteItem(repo, path, type) {
    const confirmDelete = confirm(`Delete ${path}? This cannot be undone.`);
    if (!confirmDelete) return;

    if (type === "file") {
        const file = await githubApiRequest(path, "GET", null, repo);

        await githubApiRequest(path, "DELETE", {
            message: `Delete file ${path}`,
            sha: file.sha
        }, repo);

        alert(`Deleted file: ${path}`);
        return;
    }

    const contents = await githubApiRequest(path, "GET", null, repo);

    for (const entry of contents) {
        await deleteItem(repo, entry.path, entry.type);
    }

    alert(`Deleted folder: ${path}`);
}

/* ============================================================
   DRAFTS + PUBLISH LOGS
============================================================ */
saveDraftBtn?.addEventListener("click", async () => {
    if (!latestDomHtml) {
        alert("No changes to save.");
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `drafts/${timestamp}.json`;

    const draftData = {
        html: latestDomHtml,
        timestamp
    };

    try {
        await commitFile(
            path,
            JSON.stringify(draftData, null, 2),
            `Save draft ${timestamp}`,
            "ValorWave-CMS"
        );

        alert("Draft saved!");
    } catch (e) {
        console.error(e);
        alert("Failed to save draft.");
    }
});

draftHistoryBtn?.addEventListener("click", async () => {
    if (!draftList) return;
    draftList.innerHTML = "Loading...";

    try {
        const drafts = await githubApiRequest("drafts", "GET", null, "ValorWave-CMS");
        draftList.innerHTML = "";

        drafts.forEach(d => {
            const item = document.createElement("div");
            item.className = "draft-item";
            item.textContent = d.name;
            item.dataset.path = d.path;

            item.addEventListener("click", async () => {
                const file = await githubApiRequest(d.path, "GET", null, "ValorWave-CMS");
                const data = JSON.parse(atob(file.content));

                const w = window.open("", "_blank");
                w.document.open();
                w.document.write(data.html);
                w.document.close();
            });

            draftList.appendChild(item);
        });
    } catch (e) {
        console.error(e);
        draftList.textContent = "Failed to load drafts.";
    }

    draftHistoryOverlay?.classList.remove("hidden");
});

closeDraftHistoryBtn?.addEventListener("click", () => {
    draftHistoryOverlay?.classList.add("hidden");
});
draftHistoryOverlay?.addEventListener("click", (e) => {
    if (e.target === draftHistoryOverlay) {
        draftHistoryOverlay.classList.add("hidden");
    }
});

publishBtn?.addEventListener("click", async () => {
    if (!latestDomHtml) {
        alert("No changes to publish.");
        return;
    }

    if (!confirm("Publish changes to live site?")) return;

    try {
        const commitResponse = await commitFile(
            "index.html",
            latestDomHtml,
            "Publish from CMS",
            "valorwaveentertainment"
        );

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const logPath = `publish-logs/${timestamp}.json`;

        const logData = {
            timestamp,
            message: "Publish from CMS",
            commitSha: commitResponse.commit.sha,
            previewUrl: `https://raw.githubusercontent.com/sammassengale82/valorwaveentertainment/main/index.html`
        };

        await commitFile(
            logPath,
            JSON.stringify(logData, null, 2),
            `Publish log ${timestamp}`,
            "ValorWave-CMS"
        );

        alert("Site published and publish log saved!");
        hideUnsavedIndicator();
        updateLastSavedHtml(latestDomHtml);
    } catch (e) {
        console.error(e);
        alert("Failed to publish.");
    }
});

publishLogsBtn?.addEventListener("click", async () => {
    if (!publishLogList) return;
    publishLogList.innerHTML = "Loading...";

    try {
        const logs = await githubApiRequest("publish-logs", "GET", null, "ValorWave-CMS");
        publishLogList.innerHTML = "";

        logs.forEach(log => {
            const item = document.createElement("div");
            item.className = "publish-log-item";
            item.textContent = log.name;
            item.dataset.path = log.path;

            item.addEventListener("click", async () => {
                const file = await githubApiRequest(log.path, "GET", null, "ValorWave-CMS");
                const data = JSON.parse(atob(file.content));

                alert(
                    `Timestamp: ${data.timestamp}\n` +
                    `Message: ${data.message}\n` +
                    `Commit SHA: ${data.commitSha}\n` +
                    `Preview URL:\n${data.previewUrl}`
                );
            });

            publishLogList.appendChild(item);
        });
    } catch (e) {
        console.error(e);
        publishLogList.textContent = "Failed to load logs.";
    }

    publishLogsOverlay?.classList.remove("hidden");
});

closePublishLogsBtn?.addEventListener("click", () => {
    publishLogsOverlay?.classList.add("hidden");
});
publishLogsOverlay?.addEventListener("click", (e) => {
    if (e.target === publishLogsOverlay) {
        publishLogsOverlay.classList.add("hidden");
    }
});

/* ============================================================
   ADD SECTION MODAL
============================================================ */
function createAddSectionModal() {
    if (addSectionOverlay) return;

    addSectionOverlay = document.createElement("div");
    addSectionOverlay.id = "add-section-overlay";
    addSectionOverlay.className = "overlay hidden";

    addSectionModal = document.createElement("div");
    addSectionModal.id = "add-section-modal";
    addSectionModal.className = "modal";

    const title = document.createElement("h2");
    title.textContent = "Add Section";

    const blockLabel = document.createElement("label");
    blockLabel.textContent = "Insert relative to block:";

    targetBlockSelect = document.createElement("select");
    targetBlockSelect.id = "target-block-select";

    const positionWrapper = document.createElement("div");
    positionWrapper.className = "position-wrapper";

    positionSelectBefore = document.createElement("input");
    positionSelectBefore.type = "radio";
    positionSelectBefore.name = "insert-position";
    positionSelectBefore.value = "before";

    positionSelectAfter = document.createElement("input");
    positionSelectAfter.type = "radio";
    positionSelectAfter.name = "insert-position";
    positionSelectAfter.value = "after";
    positionSelectAfter.checked = true;

    const beforeLabel = document.createElement("label");
    beforeLabel.appendChild(positionSelectBefore);
    beforeLabel.appendChild(document.createTextNode(" Before"));

    const afterLabel = document.createElement("label");
    afterLabel.appendChild(positionSelectAfter);
    afterLabel.appendChild(document.createTextNode(" After"));

    positionWrapper.appendChild(beforeLabel);
    positionWrapper.appendChild(afterLabel);

    const templateLabel = document.createElement("h3");
    templateLabel.textContent = "Choose a template:";

    templateListEl = document.createElement("div");
    templateListEl.id = "template-list";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "close-btn";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => {
        addSectionOverlay.classList.add("hidden");
    });

    addSectionModal.appendChild(closeBtn);
    addSectionModal.appendChild(title);
    addSectionModal.appendChild(blockLabel);
    addSectionModal.appendChild(targetBlockSelect);
    addSectionModal.appendChild(positionWrapper);
    addSectionModal.appendChild(templateLabel);
    addSectionModal.appendChild(templateListEl);

    addSectionOverlay.appendChild(addSectionModal);
    document.body.appendChild(addSectionOverlay);

    addSectionOverlay.addEventListener("click", (e) => {
        if (e.target === addSectionOverlay) {
            addSectionOverlay.classList.add("hidden");
        }
    });
}

function populateTargetBlockSelect() {
    if (!targetBlockSelect || !editableFrame || !editableFrame.contentDocument) return;

    targetBlockSelect.innerHTML = "";

    const blocks = editableFrame.contentDocument.querySelectorAll("[data-ve-block-id]");

    const endOption = document.createElement("option");
    endOption.value = "";
    endOption.textContent = "End of page";
    targetBlockSelect.appendChild(endOption);

    blocks.forEach(block => {
        const id = block.getAttribute("data-ve-block-id") || "(unnamed)";
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = id;
        targetBlockSelect.appendChild(opt);
    });
}

async function openAddSectionModal() {
    createAddSectionModal();
    populateTargetBlockSelect();

    templateListEl.innerHTML = "Loading templates...";

    try {
        const files = await githubApiRequest("templates", "GET", null, "ValorWave-CMS");
        templateListEl.innerHTML = "";

        files.forEach(file => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "template-item";
            btn.textContent = file.name;

            btn.addEventListener("click", async () => {
                const content = await githubApiRequest(file.path, "GET", null, "ValorWave-CMS");
                const html = atob(content.content);

                const targetBlockId = targetBlockSelect.value || null;
                const position = positionSelectBefore.checked ? "before" : "after";

                editableFrame.contentWindow.postMessage(
                    {
                        type: "insert-block",
                        html,
                        position,
                        targetBlockId
                    },
                    "*"
                );

                addSectionOverlay.classList.add("hidden");
            });

            templateListEl.appendChild(btn);
        });
    } catch (e) {
        console.error(e);
        templateListEl.textContent = "Failed to load templates.";
    }

    addSectionOverlay.classList.remove("hidden");
}

addSectionBtn?.addEventListener("click", openAddSectionModal);

/* ============================================================
   FOLDER-STATE PERSISTENCE
============================================================ */
function saveFolderState() {
    localStorage.setItem("cms-folder-state", JSON.stringify(folderState));
}

function loadFolderState() {
    const saved = localStorage.getItem("cms-folder-state");
    if (!saved) return;
    try {
        Object.assign(folderState, JSON.parse(saved));
    } catch {}
}

loadFolderState();

/* ============================================================
   MULTI-SELECT + SHORTCUTS
============================================================ */
document.addEventListener("click", (e) => {
    const item = e.target.closest(".file-item");
    if (!item) return;

    if (e.ctrlKey || e.metaKey) {
        if (selectedItems.has(item)) {
            selectedItems.delete(item);
            item.classList.remove("selected");
        } else {
            selectedItems.add(item);
            item.classList.add("selected");
        }
    } else {
        selectedItems.forEach(i => i.classList.remove("selected"));
        selectedItems.clear();
        selectedItems.add(item);
        item.classList.add("selected");
    }
});

async function deleteSelectedItems() {
    if (selectedItems.size === 0) return;

    if (!confirm(`Delete ${selectedItems.size} items?`)) return;

    for (const item of selectedItems) {
        const repo = item.dataset.repo;
        const path = item.dataset.path;
        const type = item.dataset.type;

        await deleteItem(repo, path, type);
    }

    selectedItems.clear();
    await loadSidebarFileListsTree();
}

document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveDraftBtn?.click();
    }

    if (e.ctrlKey && e.shiftKey && e.key === "S") {
        e.preventDefault();
        publishBtn?.click();
    }

    if (e.key === "Escape") {
        if (addSectionOverlay) addSectionOverlay.classList.add("hidden");
        if (draftHistoryOverlay) draftHistoryOverlay.classList.add("hidden");
        if (publishLogsOverlay) publishLogsOverlay.classList.add("hidden");
    }

    if (e.key === "Delete") {
        deleteSelectedItems();
    }
});

/* ============================================================
   MESSAGE LISTENER (CMS <-> VE) — POPUP EDITOR
============================================================ */
window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object" || !msg.type) return;

    console.log("[CMS] Received message:", msg);

    if (msg.type === "open-editor") {
        openEditorModalFromPayload({
            editType: "block",
            blockId: msg.blockId,
            html: msg.html || "",
            targetSelector: `[data-ve-edit="${msg.blockId}"]`
        });
    }

    if (msg.type === "dom-updated") {
        latestDomHtml = msg.html;
        showUnsavedIndicator();
    }
});

/* ============================================================
   INITIALIZATION
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
    const allowed = await enforceLogin();
    if (!allowed) return;

    loadSavedThemes();
    wireHeaderThemeControls();
    loadEditablePreview();
    loadLivePreview();
    loadSidebarFileListsTree();
});