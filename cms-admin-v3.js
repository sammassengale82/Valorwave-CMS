/* ============================================================
   VALOR WAVE CMS ADMIN — PHASE 14
   FULL VERSION
============================================================ */

/* -------------------------------
   AUTH / GITHUB SESSION MARKER
-------------------------------- */
let githubToken = null;

/* -------------------------------
   DOM REFERENCES
-------------------------------- */
const editableFrame = document.getElementById("preview-frame-editable");
const liveFrame = document.getElementById("preview-frame-live");

const editorOverlay = document.getElementById("editor-overlay");
const editorModal = document.getElementById("editor-modal");
const editorContent = document.getElementById("editor-content");
const editorImageURL = document.getElementById("editor-image-url");
const editorImageUpload = document.getElementById("editor-image-upload");
const applyChangesBtn = document.getElementById("apply-changes");
const cancelEditorBtn = document.getElementById("cancel-editor");
const cancelEditorBtnSecondary = document.getElementById("cancel-editor-secondary");

const cmsThemeSelect = document.getElementById("cms-theme");
const siteThemeSelect = document.getElementById("site-theme");
const saveCmsThemeBtn = document.getElementById("save-cms-theme");
const saveSiteThemeBtn = document.getElementById("save-site-theme");
const cmsThemeSavedMsg = document.getElementById("cms-theme-saved");
const siteThemeSavedMsg = document.getElementById("site-theme-saved");

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

const wysiwygToolbar = document.getElementById("wysiwyg-toolbar");
const imageDropZone = document.getElementById("image-drop-zone");
const addSectionBtn = document.getElementById("add-section");

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
            authStatus.textContent = "Not authenticated.";
            return false;
        }

        const user = await res.json();
        authStatus.textContent = `Logged in as ${user.login}`;
        githubToken = "session-active";
        return true;
    } catch (e) {
        console.error("Auth check failed:", e);
        authStatus.textContent = "Auth check failed.";
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

/* ============================================================
   VISUAL EDITOR BRIDGE
============================================================ */
function openEditorModalFromPayload(payload) {
    currentEditType = payload.editType || "block";
    currentTargetSelector = payload.targetSelector || null;
    currentEditTarget = payload;

    const tagName = (payload.tagName || "").toLowerCase();

    let mainText = payload.html || payload.text || "";

    if (currentEditType === "link" || tagName === "a") {
        mainText = payload.label || payload.text || mainText;
        if (editorImageURL) {
            editorImageURL.value = payload.url || "";
            editorImageURL.placeholder = "Link URL";
        }
    }

    if (currentEditType === "image" || tagName === "img") {
        mainText = payload.alt || mainText;
        if (editorImageURL) {
            editorImageURL.value = payload.imageUrl || "";
            editorImageURL.placeholder = "Image URL";
        }
    }

    if (editorContent) editorContent.value = mainText;
    if (editorImageUpload) editorImageUpload.value = "";

    if (editorOverlay) editorOverlay.style.display = "flex";
    if (editorModal) editorModal.style.display = "block";
}

function closeEditorModal() {
    if (editorOverlay) editorOverlay.style.display = "none";
    if (editorModal) editorModal.style.display = "none";

    currentEditTarget = null;
    currentTargetSelector = null;
    currentEditType = "text";
}

/* ============================================================
   MESSAGE LISTENER (NO IFRAME FILTERING)
============================================================ */
window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (!data.type) return;

    console.log("[CMS] Received message:", data);

    if (data.type === "open-editor") {
        const normalized = {
            editType: data.editType || "block",
            targetSelector: data.blockId || null,
            html: typeof data.innerHTML === "string" ? data.innerHTML : "",
            raw: data
        };
        openEditorModalFromPayload(normalized);
        return;
    }

    if (data.type === "dom-updated") {
        latestDomHtml = data.html;
        showUnsavedIndicator();
        return;
    }
});
/* ============================================================
   APPLY EDIT
============================================================ */
applyChangesBtn?.addEventListener("click", () => {
    if (!editableFrame) {
        closeEditorModal();
        return;
    }

    const payload = {
        type: "apply-edit",
        editType: currentEditType
    };

    const mainText = editorContent ? editorContent.value : "";

    if (currentEditType === "text" || currentEditType === "block") {
        payload.html = mainText;
    }

    if (currentEditType === "link") {
        payload.label = mainText;
        payload.url = editorImageURL?.value || "";
    }

    if (currentEditType === "image") {
        payload.alt = mainText;
        payload.imageUrl = editorImageURL?.value || "";
    }

    if (currentEditTarget?.style) payload.style = currentEditTarget.style;
    if (currentEditTarget?.classes) payload.classes = currentEditTarget.classes;

    console.log("[CMS] Sending apply-edit to VE:", payload);
    editableFrame.contentWindow.postMessage(payload, "*");
    closeEditorModal();
});

cancelEditorBtn?.addEventListener("click", closeEditorModal);
cancelEditorBtnSecondary?.addEventListener("click", closeEditorModal);

/* ============================================================
   IMAGE UPLOAD / DROP → URL FIELD
============================================================ */
editorImageUpload?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file || !editorImageURL) return;

    const reader = new FileReader();
    reader.onload = () => editorImageURL.value = reader.result;
    reader.readAsDataURL(file);
});

imageDropZone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    imageDropZone.classList.add("drag-over");
});

imageDropZone?.addEventListener("dragleave", () => {
    imageDropZone.classList.remove("drag-over");
});

imageDropZone?.addEventListener("drop", (e) => {
    e.preventDefault();
    imageDropZone.classList.remove("drag-over");

    const file = e.dataTransfer.files?.[0];
    if (!file || !editorImageURL) return;

    const reader = new FileReader();
    reader.onload = () => editorImageURL.value = reader.result;
    reader.readAsDataURL(file);
});

/* ============================================================
   THEME SYSTEM
============================================================ */
function applyCmsTheme(theme) {
    document.body.className = `theme-${theme}`;
}

function sendThemeToFrames(theme) {
    const msg = { type: "set-theme", theme };
    try { editableFrame?.contentWindow.postMessage(msg, "*"); } catch {}
    try { liveFrame?.contentWindow.postMessage(msg, "*"); } catch {}
}

function loadSavedThemes() {
    const cmsTheme = localStorage.getItem("cms-theme") || "original";
    const siteTheme = localStorage.getItem("site-theme") || "original";

    if (cmsThemeSelect) cmsThemeSelect.value = cmsTheme;
    if (siteThemeSelect) siteThemeSelect.value = siteTheme;

    applyCmsTheme(cmsTheme);
    sendThemeToFrames(siteTheme);
}

cmsThemeSelect?.addEventListener("change", e => applyCmsTheme(e.target.value));
siteThemeSelect?.addEventListener("change", e => sendThemeToFrames(e.target.value));

saveCmsThemeBtn?.addEventListener("click", () => {
    localStorage.setItem("cms-theme", cmsThemeSelect.value);
    cmsThemeSavedMsg.style.opacity = "1";
    setTimeout(() => cmsThemeSavedMsg.style.opacity = "0", 1200);
});

saveSiteThemeBtn?.addEventListener("click", () => {
    localStorage.setItem("site-theme", siteThemeSelect.value);
    siteThemeSavedMsg.style.opacity = "1";
    setTimeout(() => siteThemeSavedMsg.style.opacity = "0", 1200);
});

/* ============================================================
   PREVIEW LOADING
============================================================ */
function loadEditablePreview() {
    const frame = document.getElementById("preview-frame-editable");
    if (!frame) return;

    frame.src = "https://sammassengale82.github.io/valorwaveentertainment/";

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
   UNSAVED INDICATOR
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

        if (isTextFile(entry.name)) {
            label.addEventListener("click", () => {
                openFileFromRepo(repoName, entry.path);
            });
        } else {
            label.addEventListener("click", () => {
                alert(`File type not editable yet: ${entry.name}`);
            });
        }
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
    repoLiveFilesContainer.textContent = "Loading...";
    repoCmsFilesContainer.textContent = "Loading...";

    try {
        await renderRepoRoot("valorwaveentertainment", repoLiveFilesContainer);
        await renderRepoRoot("ValorWave-CMS", repoCmsFilesContainer);
    } catch (e) {
        console.error("Failed to load file lists:", e);
        repoLiveFilesContainer.textContent = "Error loading files.";
        repoCmsFilesContainer.textContent = "Error loading files.";
    }
}
/* ============================================================
   OPEN FILE FROM REPO
============================================================ */
async function openFileFromRepo(repoName, path) {
    try {
        const file = await githubApiRequest(path, "GET", null, repoName);
        if (!file?.content) {
            alert("Unable to load file content.");
            return;
        }

        const decoded = atob(file.content);

        currentEditType = "text";
        currentTargetSelector = null;
        currentEditTarget = null;

        if (editorContent) editorContent.value = decoded;
        if (editorImageURL) editorImageURL.value = "";
        if (editorImageUpload) editorImageUpload.value = "";

        if (editorModal) {
            editorModal.dataset.repoName = repoName;
            editorModal.dataset.filePath = path;
        }

        if (editorOverlay) editorOverlay.style.display = "flex";
        if (editorModal) editorModal.style.display = "block";
    } catch (e) {
        console.error("Failed to open file:", e);
        alert("Failed to open file. Check console for details.");
    }
}

/* ============================================================
   CONTEXT MENU + FILE OPS
============================================================ */
const contextMenu = document.getElementById("context-menu");

document.addEventListener("click", () => {
    contextMenu.classList.add("hidden");
});

document.addEventListener("contextmenu", (e) => {
    const item = e.target.closest(".file-item");
    if (!item) return;

    e.preventDefault();

    const repo = item.dataset.repo;
    const path = item.dataset.path;
    const type = item.dataset.type;
    const depth = Number(item.dataset.depth);

    contextTarget = { repo, path, type, depth, element: item };

    contextMenu.style.left = e.pageX + "px";
    contextMenu.style.top = e.pageY + "px";
    contextMenu.classList.remove("hidden");

    document.querySelector("[data-action='open']").style.display =
        type === "file" ? "block" : "none";

    document.querySelector("[data-action='rename']").style.display = "block";
    document.querySelector("[data-action='delete']").style.display = "block";

    document.querySelector("[data-action='new-file']").style.display = "block";
    document.querySelector("[data-action='new-folder']").style.display = "block";
    document.querySelector("[data-action='upload-file']").style.display = "block";
});

contextMenu.addEventListener("click", async (e) => {
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
                await openFileFromRepo(repo, path);
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

    draftHistoryOverlay.classList.remove("hidden");
});

closeDraftHistoryBtn?.addEventListener("click", () => {
    draftHistoryOverlay.classList.add("hidden");
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
    } catch (e) {
        console.error(e);
        alert("Failed to publish.");
    }
});

publishLogsBtn?.addEventListener("click", async () => {
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

    publishLogsOverlay.classList.remove("hidden");
});

closePublishLogsBtn?.addEventListener("click", () => {
    publishLogsOverlay.classList.add("hidden");
});
publishLogsOverlay?.addEventListener("click", (e) => {
    if (e.target === publishLogsOverlay) {
        publishLogsOverlay.classList.add("hidden");
    }
});

/* ============================================================
   ADD SECTION MODAL
============================================================ */
let addSectionOverlay = null;
let addSectionModal = null;
let templateListEl = null;
let targetBlockSelect = null;
let positionSelectBefore = null;
let positionSelectAfter = null;

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
   MULTI-SELECT + SHORTCUTS + DIFF
============================================================ */
let selectedItems = new Set();

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
        closeEditorModal();
        if (addSectionOverlay) addSectionOverlay.classList.add("hidden");
        if (draftHistoryOverlay) draftHistoryOverlay.classList.add("hidden");
        if (publishLogsOverlay) publishLogsOverlay.classList.add("hidden");
    }

    if (e.key === "Delete") {
        deleteSelectedItems();
    }
});

let lastSavedHtml = null;

function updateLastSavedHtml(html) {
    lastSavedHtml = html;
}

function showUnsavedDiff() {
    if (!lastSavedHtml || !latestDomHtml) return;

    showDiffViewer(lastSavedHtml, latestDomHtml, "index.html");
}

/* ============================================================
   INITIALIZATION
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
    const allowed = await enforceLogin();
    if (!allowed) return;

    loadSavedThemes();
    loadEditablePreview();
    loadLivePreview();
    loadSidebarFileListsTree();

    fetch("/editor-panel.html")
        .then(res => res.text())
        .then(html => {
            document.getElementById("editor-panel-container").innerHTML = html;

            if (typeof initializeEditorPanel === "function") {
                initializeEditorPanel();
            }
        })
        .catch(err => console.error("Failed to load editor panel:", err));
});
