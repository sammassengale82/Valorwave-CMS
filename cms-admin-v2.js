/* ============================================================
   VALOR WAVE CMS ADMIN — PHASE 13
   FULL VERSION (F1)
   Includes:
   - GitHub OAuth (Device Flow)
   - Full DOM references
   - Split-pane logic
   - Theme system
   - Preview loading + visual-editor injection
   - Global state
   ============================================================ */

/* -------------------------------
   GitHub OAuth (Device Flow)
-------------------------------- */
const GITHUB_CLIENT_ID = "0v23lioJaq0Kfz4sXFss";
const GITHUB_SCOPES = "repo";
let githubToken = null;

/* -------------------------------
   DOM REFERENCES
-------------------------------- */
const editableFrame = document.getElementById("preview-frame-editable");
const liveFrame = document.getElementById("preview-frame-live");

const topPane = document.getElementById("top-pane");
const bottomPane = document.getElementById("bottom-pane");
const dragBar = document.getElementById("drag-bar");

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

/* -------------------------------
   GLOBAL STATE
-------------------------------- */
let currentEditTarget = null;
let currentEditType = "text";
let currentTargetSelector = null;

let latestDomHtml = null;
let draftHistory = [];
let publishLogs = [];

let folderState = {}; // For file sidebar tree
let contextTarget = null; // For right-click menu
let dragItem = null; // For file drag/move
let dragOverItem = null;

/* ============================================================
   SPLIT-PANE DRAG LOGIC
============================================================ */
let isDraggingPane = false;

if (dragBar && topPane && bottomPane) {
    dragBar.addEventListener("mousedown", () => {
        isDraggingPane = true;
        document.body.style.userSelect = "none";
    });

    document.addEventListener("mouseup", () => {
        isDraggingPane = false;
        document.body.style.userSelect = "";
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDraggingPane) return;

        const containerRect = topPane.parentElement.getBoundingClientRect();
        const offsetY = e.clientY - containerRect.top;
        const minHeight = 80;

        const topHeight = Math.max(minHeight, Math.min(offsetY, containerRect.height - minHeight));
        const bottomHeight = containerRect.height - topHeight;

        topPane.style.flex = "none";
        bottomPane.style.flex = "none";
        topPane.style.height = `${topHeight}px`;
        bottomPane.style.height = `${bottomHeight}px`;
    });
}

/* ============================================================
   THEME SYSTEM
============================================================ */
function applyCmsTheme(theme) {
    document.body.className = `theme-${theme}`;
}

function sendThemeToFrames(theme) {
    const msg = { type: "set-theme", theme };
    try { editableFrame.contentWindow.postMessage(msg, "*"); } catch {}
    try { liveFrame.contentWindow.postMessage(msg, "*"); } catch {}
}

function loadSavedThemes() {
    const cmsTheme = localStorage.getItem("cms-theme") || "original";
    const siteTheme = localStorage.getItem("site-theme") || "original";

    cmsThemeSelect.value = cmsTheme;
    siteThemeSelect.value = siteTheme;

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
   PREVIEW LOADING (LIVE + EDITABLE)
============================================================ */
async function loadEditablePreview() {
    const rawUrl = "https://raw.githubusercontent.com/sammassengale82/valorwaveentertainment/main/index.html";

    try {
        const res = await fetch(rawUrl);
        if (!res.ok) throw new Error("Failed to fetch index.html");
        let html = await res.text();

        // Inject visual-editor.js from the PUBLIC SITE, not the CMS domain
const scriptTag = `<script src="https://valorwaveentertainment.com/visual-editor.js"></script>`;

// Insert script before </body>
html = html.includes("</body>")
    ? html.replace("</body>", `${scriptTag}\n</body>`)
    : html + scriptTag;

// Rewrite ALL relative asset URLs so they load from the public site
html = html.replace(/src="\//g, 'src="https://valorwaveentertainment.com/');
html = html.replace(/href="\//g, 'href="https://valorwaveentertainment.com/');

// Inject into iframe safely (NO document.write on the main document)
const doc = editableFrame.contentDocument || editableFrame.contentWindow.document;
doc.open();
doc.write(html);
doc.close();

function loadLivePreview() {
    liveFrame.src = "https://valorwaveentertainment.com";
}

/* ============================================================
   MESSAGE LISTENER (INITIAL)
============================================================ */
window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data) return;

    if (data.type === "open-editor") {
        openEditorModal(data);
        return;
    }

    if (data.type === "dom-updated") {
        latestDomHtml = data.html;
        showUnsavedIndicator();
        return;
    }
});

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
   GITHUB API HELPERS
============================================================ */
async function githubApiRequest(path, method = "GET", body = null, repo, owner = "sammassengale82") {
    if (!githubToken) throw new Error("Not authenticated with GitHub");

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    const options = {
        method,
        headers: {
            "Authorization": `Bearer ${githubToken}`,
            "Accept": "application/vnd.github+json"
        }
    };

    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`GitHub ${method} failed: ${res.status}`);
    return res.json();
}

async function getFileSha(path, repo) {
    try {
        const data = await githubApiRequest(path, "GET", null, repo);
        return data.sha;
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

/* ============================================================
   GITHUB DEVICE FLOW AUTH
============================================================ */
async function startGitHubDeviceFlow() {
    authStatus.textContent = "Starting GitHub login...";

    const res = await fetch("https://github.com/login/device/code", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            scope: GITHUB_SCOPES
        })
    });

    const data = await res.json();
    if (!data.device_code) {
        authStatus.textContent = "Failed to start GitHub login.";
        return;
    }

    alert(`Go to ${data.verification_uri} and enter code: ${data.user_code}`);
    authStatus.textContent = "Waiting for GitHub authorization...";

    await pollForGitHubToken(data.device_code, data.interval);
}

async function pollForGitHubToken(deviceCode, interval) {
    while (!githubToken) {
        await new Promise(r => setTimeout(r, interval * 1000));

        const res = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                device_code: deviceCode,
                grant_type: "urn:ietf:params:oauth:grant-type:device_code"
            })
        });

        const data = await res.json();

        if (data.error === "authorization_pending") continue;
        if (data.error) {
            authStatus.textContent = "GitHub auth failed.";
            return;
        }

        githubToken = data.access_token;
        authStatus.textContent = "Authenticated with GitHub.";

        await loadSidebarFileListsTree();
        break;
    }
}

githubLoginBtn?.addEventListener("click", () => {
    if (githubToken) return alert("Already authenticated.");
    startGitHubDeviceFlow();
});

/* ============================================================
   FILE SIDEBAR — TREE VIEW (PHASE 9)
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

        if (entry.type === "dir") {
            const childKey = `${repoName}/${entry.path}`;
            if (folderState[childKey]) {
                renderFolder(repoName, entry.path, item, depth + 1);
            }
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
        await renderRepoRoot("Valorwave-CMS", repoCmsFilesContainer);
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
        editorContent.value = decoded;
        editorImageURL.value = "";
        editorImageUpload.value = "";

        editorModal.dataset.repoName = repoName;
        editorModal.dataset.filePath = path;

        editorOverlay.classList.remove("hidden");
    } catch (e) {
        console.error("Failed to open file:", e);
        alert("Failed to open file. Check console for details.");
    }
}

/* ============================================================
   RIGHT-CLICK CONTEXT MENU
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

    document.querySelector("[data-action='new-file']").style.display =
        type === "dir" || path === "" ? "block" : "none";

    document.querySelector("[data-action='new-folder']").style.display =
        type === "dir" || path === "" ? "block" : "none";

    document.querySelector("[data-action='upload-file']").style.display =
        type === "dir" || path === "" ? "block" : "none";
});

contextMenu.addEventListener("click", async (e) => {
    const action = e.target.dataset.action;
    if (!action || !contextTarget) return;

    contextMenu.classList.add("hidden");

    const { repo, path, type, element } = contextTarget;

    switch (action) {
        case "open":
            openFileFromRepo(repo, path);
            break;

        case "new-file":
            await createNewFile(repo, path);
            break;

        case "new-folder":
            await createNewFolder(repo, path);
            break;

        case "upload-file":
            await uploadFileToFolder(repo, path);
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
    await renderFolder(repo, parentPath, parentContainer, contextTarget.depth - 1);
});

/* ============================================================
   FILE OPERATIONS
============================================================ */
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
   DRAG & DROP FILE MOVEMENT (PHASE 11)
============================================================ */
document.addEventListener("dragstart", (e) => {
    const item = e.target.closest(".file-item");
    if (!item) return;

    dragItem = {
        repo: item.dataset.repo,
        path: item.dataset.path,
        type: item.dataset.type,
        element: item
    };

    item.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
});

document.addEventListener("dragend", () => {
    if (dragItem?.element) {
        dragItem.element.classList.remove("dragging");
    }
    dragItem = null;

    clearDropHighlights();
});

document.addEventListener("dragover", (e) => {
    const item = e.target.closest(".file-item");
    if (!item) return;

    e.preventDefault();

    const repo = item.dataset.repo;
    const path = item.dataset.path;
    const type = item.dataset.type;

    if (!dragItem) return;

    if (type !== "dir") {
        item.classList.add("invalid-drop");
        dragOverItem = item;
        return;
    }

    if (repo !== dragItem.repo) {
        item.classList.add("invalid-drop");
        dragOverItem = item;
        return;
    }

    if (dragItem.type === "dir" && path.startsWith(dragItem.path)) {
        item.classList.add("invalid-drop");
        dragOverItem = item;
        return;
    }

    item.classList.add("drop-target");
    dragOverItem = item;
});

function clearDropHighlights() {
    document.querySelectorAll(".drop-target, .invalid-drop").forEach(el => {
        el.classList.remove("drop-target", "invalid-drop");
    });
}

document.addEventListener("drop", async (e) => {
    const item = e.target.closest(".file-item");
    if (!item || !dragItem) return;

    const targetRepo = item.dataset.repo;
    const targetPath = item.dataset.path;
    const targetType = item.dataset.type;

    clearDropHighlights();

    if (targetType !== "dir") return;

    if (targetRepo !== dragItem.repo) {
        alert("Cannot move items between repos.");
        return;
    }

    if (dragItem.type === "dir" && targetPath.startsWith(dragItem.path)) {
        alert("Cannot move a folder into itself or its own subfolder.");
        return;
    }

    await moveItem(dragItem.repo, dragItem.path, targetPath);

    await renderFolder(targetRepo, targetPath, item, Number(item.dataset.depth));

    dragItem = null;
});

async function moveItem(repo, oldPath, targetFolder) {
    const name = oldPath.split("/").pop();
    const newPath = `${targetFolder}/${name}`;

    const entry = await githubApiRequest(oldPath, "GET", null, repo);

    await githubApiRequest(newPath, "PUT", {
        message: `Move ${oldPath} → ${newPath}`,
        content: entry.content,
        sha: entry.sha
    }, repo);

    await githubApiRequest(oldPath, "DELETE", {
        message: `Remove old path ${oldPath}`,
        sha: entry.sha
    }, repo);

    alert(`Moved: ${oldPath} → ${newPath}`);
}
/* ============================================================
   DRAFT SYSTEM
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
            "Valorwave-CMS"
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
        const drafts = await githubApiRequest("drafts", "GET", null, "Valorwave-CMS");
        draftList.innerHTML = "";

        drafts.forEach(d => {
            const item = document.createElement("div");
            item.className = "draft-item";
            item.textContent = d.name;
            item.dataset.path = d.path;

            item.addEventListener("click", async () => {
                const file = await githubApiRequest(d.path, "GET", null, "Valorwave-CMS");
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

/* ============================================================
   PUBLISH LOGS
============================================================ */
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
            "Valorwave-CMS"
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
        const logs = await githubApiRequest("publish-logs", "GET", null, "Valorwave-CMS");
        publishLogList.innerHTML = "";

        logs.forEach(log => {
            const item = document.createElement("div");
            item.className = "publish-log-item";
            item.textContent = log.name;
            item.dataset.path = log.path;

            item.addEventListener("click", async () => {
                const file = await githubApiRequest(log.path, "GET", null, "Valorwave-CMS");
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

/* ============================================================
   EDITOR MODAL
============================================================ */
function openEditorModal(payload) {
    currentEditType = payload.editType;
    currentTargetSelector = payload.targetSelector;

    if (currentEditType === "text" || currentEditType === "list") {
        editorContent.value = payload.content || "";
        editorImageURL.value = "";
    } else if (currentEditType === "image") {
        editorContent.value = "";
        editorImageURL.value = payload.imageUrl || "";
    } else if (currentEditType === "link") {
        editorContent.value = payload.label || "";
        editorImageURL.value = payload.url || "";
    }

    editorOverlay.classList.remove("hidden");
}

function closeEditorModal() {
    editorOverlay.classList.add("hidden");
    currentEditType = null;
    currentTargetSelector = null;
}

applyChangesBtn?.addEventListener("click", () => {
    if (!editableFrame || !currentTargetSelector || !currentEditType) return;

    const message = {
        type: "apply-edit",
        targetSelector: currentTargetSelector,
        editType: currentEditType
    };

    if (currentEditType === "text" || currentEditType === "list") {
        message.content = editorContent.value;
    } else if (currentEditType === "image") {
        message.imageUrl = editorImageURL.value;
    } else if (currentEditType === "link") {
        message.label = editorContent.value;
        message.url = editorImageURL.value;
    }

    editableFrame.contentWindow.postMessage(message, "*");
    closeEditorModal();
});

cancelEditorBtn?.addEventListener("click", closeEditorModal);
cancelEditorBtnSecondary?.addEventListener("click", closeEditorModal);

/* ============================================================
   WYSIWYG TOOLBAR
============================================================ */
wysiwygToolbar?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const start = editorContent.selectionStart;
    const end = editorContent.selectionEnd;
    const selected = editorContent.value.substring(start, end);

    let replacement = selected;

    switch (action) {
        case "bold": replacement = `**${selected}**`; break;
        case "italic": replacement = `*${selected}*`; break;
        case "underline": replacement = `<u>${selected}</u>`; break;
        case "h1": replacement = `# ${selected}`; break;
        case "h2": replacement = `## ${selected}`; break;
        case "h3": replacement = `### ${selected}`; break;
        case "ul":
            replacement = selected.split("\n").map(line => `- ${line}`).join("\n");
            break;
        case "ol":
            replacement = selected.split("\n").map((line, i) => `${i + 1}. ${line}`).join("\n");
            break;
        case "left":
            replacement = `<div style="text-align:left">${selected}</div>`;
            break;
        case "center":
            replacement = `<div style="text-align:center">${selected}</div>`;
            break;
        case "right":
            replacement = `<div style="text-align:right">${selected}</div>`;
            break;
    }

    editorContent.setRangeText(replacement, start, end, "end");
});

/* ============================================================
   ADD SECTION MODAL (PHASE 12)
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
    if (!targetBlockSelect) return;

    targetBlockSelect.innerHTML = "";

    const blocks = editableFrame.contentDocument.querySelectorAll("[data-editable-block]");

    const endOption = document.createElement("option");
    endOption.value = "";
    endOption.textContent = "End of page";
    targetBlockSelect.appendChild(endOption);

    blocks.forEach(block => {
        const id = block.getAttribute("data-block-id") || "(unnamed)";
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
        const files = await githubApiRequest("templates", "GET", null, "Valorwave-CMS");
        templateListEl.innerHTML = "";

        files.forEach(file => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "template-item";
            btn.textContent = file.name;

            btn.addEventListener("click", async () => {
                const content = await githubApiRequest(file.path, "GET", null, "Valorwave-CMS");
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
   LOGOUT
============================================================ */
logoutBtn?.addEventListener("click", () => {
    githubToken = null;
    authStatus.textContent = "Not authenticated";
    alert("Logged out.");
});

/* ============================================================
   INITIALIZATION
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
    loadSavedThemes();
    loadEditablePreview();
    loadLivePreview();

    if (githubToken) {
        loadSidebarFileListsTree();
    }
    /* ============================================================
   PHASE 13 — EXPANSION PACK (2D-FULL)
   Adds:
   - SHA caching layer
   - File diff viewer
   - Ghost drag preview + auto-scroll
   - Folder-state persistence
   - Multi-select operations
   - Duplicate file
   - Open in new tab
   - Template categories + search
   - Block-ID validator + auto-assigner
   - Error overlay system
   - Keyboard shortcuts
   - Unsaved diff engine
============================================================ */

/* ============================================================
   SHA CACHE (prevents rate-limit spikes)
============================================================ */
const shaCache = {};

async function getCachedSha(path, repo) {
    const key = `${repo}:${path}`;
    if (shaCache[key]) return shaCache[key];

    try {
        const data = await githubApiRequest(path, "GET", null, repo);
        shaCache[key] = data.sha;
        return data.sha;
    } catch {
        return null;
    }
}

/* ============================================================
   FILE DIFF VIEWER
============================================================ */
function showDiffViewer(oldContent, newContent, filename) {
    const overlay = document.createElement("div");
    overlay.className = "diff-overlay";

    const modal = document.createElement("div");
    modal.className = "diff-modal";

    const title = document.createElement("h2");
    title.textContent = `Changes in ${filename}`;

    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => overlay.remove());

    const diffArea = document.createElement("pre");
    diffArea.className = "diff-area";

    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");

    let diffText = "";

    const max = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < max; i++) {
        const oldLine = oldLines[i] || "";
        const newLine = newLines[i] || "";

        if (oldLine !== newLine) {
            diffText += `- ${oldLine}\n+ ${newLine}\n`;
        } else {
            diffText += `  ${oldLine}\n`;
        }
    }

    diffArea.textContent = diffText;

    modal.appendChild(closeBtn);
    modal.appendChild(title);
    modal.appendChild(diffArea);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

/* ============================================================
   GHOST DRAG PREVIEW + AUTO-SCROLL
============================================================ */
let ghostEl = null;
let autoScrollInterval = null;

function createGhostPreview(text) {
    ghostEl = document.createElement("div");
    ghostEl.className = "ghost-preview";
    ghostEl.textContent = text;
    document.body.appendChild(ghostEl);
}

function moveGhostPreview(x, y) {
    if (!ghostEl) return;
    ghostEl.style.left = x + 10 + "px";
    ghostEl.style.top = y + 10 + "px";
}

function destroyGhostPreview() {
    if (ghostEl) ghostEl.remove();
    ghostEl = null;
}

function startAutoScroll(e) {
    stopAutoScroll();

    autoScrollInterval = setInterval(() => {
        const buffer = 80;
        const speed = 12;

        if (e.clientY < buffer) {
            window.scrollBy(0, -speed);
        } else if (e.clientY > window.innerHeight - buffer) {
            window.scrollBy(0, speed);
        }
    }, 16);
}

function stopAutoScroll() {
    if (autoScrollInterval) clearInterval(autoScrollInterval);
    autoScrollInterval = null;
}

document.addEventListener("dragstart", (e) => {
    const item = e.target.closest(".file-item");
    if (!item) return;

    createGhostPreview(item.dataset.path);
});

document.addEventListener("dragover", (e) => {
    moveGhostPreview(e.clientX, e.clientY);
    startAutoScroll(e);
});

document.addEventListener("dragend", () => {
    destroyGhostPreview();
    stopAutoScroll();
});

/* ============================================================
   FOLDER-STATE PERSISTENCE (localStorage)
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
   MULTI-SELECT OPERATIONS
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

/* ============================================================
   DUPLICATE FILE
============================================================ */
async function duplicateFile(repo, path) {
    const file = await githubApiRequest(path, "GET", null, repo);
    const content = file.content;

    const base = path.split("/").pop();
    const parent = path.includes("/") ? path.split("/").slice(0, -1).join("/") : "";
    const newName = base.replace(/(\.[^.]+)$/, "-copy$1");
    const newPath = parent ? `${parent}/${newName}` : newName;

    await githubApiRequest(newPath, "PUT", {
        message: `Duplicate ${path}`,
        content
    }, repo);

    alert(`Duplicated: ${newName}`);
}

/* ============================================================
   OPEN FILE IN NEW TAB
============================================================ */
async function openFileInNewTab(repo, path) {
    const file = await githubApiRequest(path, "GET", null, repo);
    const decoded = atob(file.content);

    const w = window.open("", "_blank");
    w.document.open();
    w.document.write(`<pre>${decoded.replace(/</g, "&lt;")}</pre>`);
    w.document.close();
}

/* ============================================================
   TEMPLATE CATEGORIES + SEARCH
============================================================ */
let templateSearchInput = null;

function createTemplateSearchBar() {
    if (!templateListEl) return;

    templateSearchInput = document.createElement("input");
    templateSearchInput.type = "text";
    templateSearchInput.placeholder = "Search templates...";
    templateSearchInput.className = "template-search";

    templateListEl.parentNode.insertBefore(templateSearchInput, templateListEl);

    templateSearchInput.addEventListener("input", () => {
        const query = templateSearchInput.value.toLowerCase();
        const items = templateListEl.querySelectorAll(".template-item");

        items.forEach(item => {
            const name = item.textContent.toLowerCase();
            item.style.display = name.includes(query) ? "block" : "none";
        });
    });
}

/* ============================================================
   BLOCK-ID VALIDATOR + AUTO-ASSIGNER
============================================================ */
function ensureBlockIds() {
    const doc = editableFrame.contentDocument;
    if (!doc) return;

    const blocks = doc.querySelectorAll("[data-editable-block]");
    const used = new Set();

    blocks.forEach(block => {
        let id = block.getAttribute("data-block-id");

        if (!id || used.has(id)) {
            id = `block-${Math.random().toString(36).slice(2, 8)}`;
            block.setAttribute("data-block-id", id);
        }

        used.add(id);
    });
}

/* ============================================================
   ERROR OVERLAY SYSTEM
============================================================ */
function showErrorOverlay(message) {
    const overlay = document.createElement("div");
    overlay.className = "error-overlay";

    const modal = document.createElement("div");
    modal.className = "error-modal";

    const title = document.createElement("h2");
    title.textContent = "Error";

    const msg = document.createElement("p");
    msg.textContent = message;

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => overlay.remove());

    modal.appendChild(title);
    modal.appendChild(msg);
    modal.appendChild(closeBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

/* ============================================================
   KEYBOARD SHORTCUTS
============================================================ */
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
    }

    if (e.key === "Delete") {
        deleteSelectedItems();
    }
});

/* ============================================================
   UNSAVED DIFF ENGINE
============================================================ */
let lastSavedHtml = null;

function updateLastSavedHtml(html) {
    lastSavedHtml = html;
}

function showUnsavedDiff() {
    if (!lastSavedHtml || !latestDomHtml) return;

    showDiffViewer(lastSavedHtml, latestDomHtml, "index.html");
}

});
