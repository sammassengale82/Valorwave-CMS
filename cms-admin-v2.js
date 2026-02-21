// -------------------------------
// GitHub OAuth (Device Flow)
// -------------------------------
const GITHUB_CLIENT_ID = "0v23lioJaq0Kfz4sXFss";
const GITHUB_SCOPES = "repo";
let githubToken = null;

// -------------------------------
// DOM references
// -------------------------------
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

let currentEditTarget = null;
let currentEditType = "text";

// Phase 12: latest DOM from visual editor + known blocks
let pendingHtml = null;
let knownBlocks = [];

// -------------------------------
// Split pane drag logic
// -------------------------------
let isDragging = false;

if (dragBar && topPane && bottomPane) {
    dragBar.addEventListener("mousedown", () => {
        isDragging = true;
        document.body.style.userSelect = "none";
    });

    document.addEventListener("mouseup", () => {
        isDragging = false;
        document.body.style.userSelect = "";
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
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

// -------------------------------
// Editor modal logic (message-based)
// -------------------------------
window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data) return;

    // Open editor from visual-editor.js
    if (data.type === "open-editor") {
        currentEditType = data.editType || "text";
        currentEditTarget = data.targetSelector || null;

        if (currentEditType === "text" || currentEditType === "list") {
            editorContent.value = data.content || "";
            editorImageURL.value = "";
            editorImageUpload.value = "";
        } else if (currentEditType === "image") {
            editorContent.value = "";
            editorImageURL.value = data.imageUrl || "";
            editorImageUpload.value = "";
        } else if (currentEditType === "link") {
            editorContent.value = data.label || "";
            editorImageURL.value = data.url || "";
            editorImageUpload.value = "";
        }

        editorOverlay.classList.remove("hidden");
        return;
    }

    // Phase 12: DOM updated from visual editor
    if (data.type === "dom-updated") {
        pendingHtml = data.html;
        updateKnownBlocksFromHtml(pendingHtml);
        showUnsavedIndicator();
        return;
    }
});

if (cancelEditorBtn) {
    cancelEditorBtn.addEventListener("click", () => {
        editorOverlay.classList.add("hidden");
        currentEditTarget = null;
    });
}

if (cancelEditorBtnSecondary) {
    cancelEditorBtnSecondary.addEventListener("click", () => {
        editorOverlay.classList.add("hidden");
        currentEditTarget = null;
    });
}

applyChangesBtn.addEventListener("click", async () => {
    // Phase 8: if we're editing a repo file, save to GitHub
    const repoName = editorModal.dataset.repoName;
    const filePath = editorModal.dataset.filePath;

    if (repoName && filePath) {
        try {
            await commitFile(
                filePath,
                editorContent.value,
                `Edit ${filePath} from CMS`,
                repoName
            );

            alert(`File saved to ${repoName}/${filePath}`);

            delete editorModal.dataset.repoName;
            delete editorModal.dataset.filePath;
            editorOverlay.classList.add("hidden");
            currentEditTarget = null;
        } catch (e) {
            console.error("Failed to save file:", e);
            alert("Failed to save file. Check console for details.");
        }
        return;
    }

    // Original behavior: DOM-based editing via postMessage
    if (!currentEditTarget) {
        editorOverlay.classList.add("hidden");
        return;
    }

    const payload = {
        type: "apply-edit",
        editType: currentEditType,
        targetSelector: currentEditTarget
    };

    if (currentEditType === "text" || currentEditType === "list") {
        payload.content = editorContent.value;
    } else if (currentEditType === "image") {
        payload.imageUrl = editorImageURL.value;
    } else if (currentEditType === "link") {
        payload.label = editorContent.value;
        payload.url = editorImageURL.value;
    }

    try {
        editableFrame.contentWindow.postMessage(payload, "*");
    } catch (e) {
        console.error("Failed to send apply-edit:", e);
    }

    editorOverlay.classList.add("hidden");
    currentEditTarget = null;
});

// ============================
// PHASE 4 — WYSIWYG TOOLBAR
// ============================
function applyFormatting(type) {
    const textarea = editorContent;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const selected = value.substring(start, end);

    let replacement = selected;

    switch (type) {
        case "bold": replacement = `**${selected || "bold text"}**`; break;
        case "italic": replacement = `*${selected || "italic text"}*`; break;
        case "underline": replacement = `<u>${selected || "underlined text"}</u>`; break;
        case "h1": replacement = `# ${selected || "Heading 1"}`; break;
        case "h2": replacement = `## ${selected || "Heading 2"}`; break;
        case "h3": replacement = `### ${selected || "Heading 3"}`; break;
        case "ul":
            replacement = (selected || "List item")
                .split("\n")
                .map(line => `- ${line}`)
                .join("\n");
            break;
        case "ol":
            replacement = (selected || "List item")
                .split("\n")
                .map((line, i) => `${i + 1}. ${line}`)
                .join("\n");
            break;
        case "left":
            replacement = `<div style="text-align:left">\n${selected || "Left aligned text"}\n</div>`;
            break;
        case "center":
            replacement = `<div style="text-align:center">\n${selected || "Centered text"}\n</div>`;
            break;
        case "right":
            replacement = `<div style="text-align:right">\n${selected || "Right aligned text"}\n</div>`;
            break;
    }

    textarea.value = value.substring(0, start) + replacement + value.substring(end);
    textarea.focus();
    textarea.selectionStart = start;
    textarea.selectionEnd = start + replacement.length;
}

function initWysiwygToolbar() {
    const toolbar = document.getElementById("wysiwyg-toolbar");
    if (!toolbar) return;

    toolbar.addEventListener("click", (e) => {
        const button = e.target.closest("button");
        if (!button) return;
        const action = button.dataset.action;
        if (action) applyFormatting(action);
    });
}

function initEditorShortcuts() {
    const textarea = editorContent;
    if (!textarea) return;

    textarea.addEventListener("keydown", (e) => {
        if (!e.ctrlKey && !e.metaKey) return;

        const key = e.key.toLowerCase();
        if (key === "b") { e.preventDefault(); applyFormatting("bold"); }
        if (key === "i") { e.preventDefault(); applyFormatting("italic"); }
        if (key === "u") { e.preventDefault(); applyFormatting("underline"); }
    });
}

// ============================
// PHASE 5 — IMAGE UPLOAD SYSTEM
// ============================
async function uploadImageToGitHub(file) {
    if (!githubToken) {
        alert("You must log in with GitHub before uploading images.");
        return null;
    }

    const repo = "Valorwave-CMS";
    const path = `uploads/${Date.now()}-${file.name}`;
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
        reader.onload = async () => {
            const base64Content = reader.result.split(",")[1];

            try {
                const response = await githubApiRequest(
                    path,
                    "PUT",
                    {
                        message: `Upload image ${file.name}`,
                        content: base64Content
                    },
                    repo
                );

                if (response?.content?.download_url) {
                    resolve(response.content.download_url);
                } else {
                    resolve(`https://raw.githubusercontent.com/sammassengale82/${repo}/main/${path}`);
                }
            } catch (err) {
                console.error("Image upload failed:", err);
                reject(err);
            }
        };

        reader.readAsDataURL(file);
    });
}

editorImageUpload.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = await uploadImageToGitHub(file);
    if (url) editorImageURL.value = url;
});

const dropZone = document.getElementById("image-drop-zone");

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const url = await uploadImageToGitHub(file);
    if (url) editorImageURL.value = url;
});

// ============================
// PHASE 6 — DRAFT HISTORY
// ============================
async function fetchDraftList() {
    return githubApiRequest("drafts", "GET", null, "Valorwave-CMS");
}

async function fetchDraft(path) {
    const response = await githubApiRequest(path, "GET", null, "Valorwave-CMS");
    if (!response?.content) return null;
    return JSON.parse(atob(response.content));
}

async function openDraftHistoryModal() {
    const overlay = document.getElementById("draft-history-overlay");
    const list = document.getElementById("draft-list");

    list.innerHTML = "Loading...";

    const drafts = await fetchDraftList();
    list.innerHTML = "";

    drafts.forEach(d => {
        const item = document.createElement("div");
        item.className = "draft-item";
        item.textContent = d.name;
        item.dataset.path = d.path;

        item.addEventListener("click", async () => {
            const draft = await fetchDraft(d.path);
            if (!draft) return;

            editorContent.value = draft.content || "";
            editorImageURL.value = draft.imageUrl || "";

            overlay.classList.add("hidden");
            editorOverlay.classList.remove("hidden");
        });

        list.appendChild(item);
    });

    overlay.classList.remove("hidden");
}

// ============================
// PHASE 7 — PUBLISH LOGS
// ============================
async function fetchPublishLogList() {
    return githubApiRequest("publish-logs", "GET", null, "Valorwave-CMS");
}

async function fetchPublishLog(path) {
    const response = await githubApiRequest(path, "GET", null, "Valorwave-CMS");
    if (!response?.content) return null;
    return JSON.parse(atob(response.content));
}

async function openPublishLogsModal() {
    const overlay = document.getElementById("publish-logs-overlay");
    const list = document.getElementById("publish-log-list");

    list.innerHTML = "Loading...";

    const logs = await fetchPublishLogList();
    list.innerHTML = "";

    logs.forEach(log => {
        const item = document.createElement("div");
        item.className = "publish-log-item";
        item.textContent = log.name;
        item.dataset.path = log.path;

        item.addEventListener("click", async () => {
            const data = await fetchPublishLog(log.path);
            if (!data) return;

            alert(
                `Timestamp: ${data.timestamp}\n` +
                `Message: ${data.message}\n` +
                `Commit SHA: ${data.commitSha}\n` +
                `Preview URL:\n${data.previewUrl}`
            );
        });

        list.appendChild(item);
    });

    overlay.classList.remove("hidden");
}

// ============================
// PHASE 8 — MULTI-FILE SIDEBAR
// ============================

const LIVE_REPO = "valorwaveentertainment";
const CMS_REPO = "Valorwave-CMS";

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

async function fetchRepoRoot(repoName) {
    return githubApiRequest("", "GET", null, repoName);
}

function renderFileList(container, repoName, entries) {
    container.innerHTML = "";

    entries.forEach(entry => {
        const item = document.createElement("div");
        item.className = "file-item";

        if (entry.type === "dir") {
            item.classList.add("file-item-folder");
            item.textContent = `/${entry.name}`;
        } else {
            item.classList.add("file-item-file");
            item.textContent = entry.name;

            if (isTextFile(entry.name)) {
                item.addEventListener("click", () => {
                    openFileFromRepo(repoName, entry.path);
                });
            } else {
                item.addEventListener("click", () => {
                    alert(`File type not yet editable in Phase 8: ${entry.name}`);
                });
            }
        }

        container.appendChild(item);
    });
}

async function loadSidebarFileLists() {
    const liveContainer = document.getElementById("repo-live-files");
    const cmsContainer = document.getElementById("repo-cms-files");
    if (!liveContainer || !cmsContainer) return;

    liveContainer.textContent = "Loading...";
    cmsContainer.textContent = "Loading...";

    try {
        await renderRepoRoot("valorwaveentertainment", liveContainer);
        await renderRepoRoot("Valorwave-CMS", cmsContainer);
    } catch (e) {
        console.error("Failed to load file lists:", e);
        liveContainer.textContent = "Error loading files.";
        cmsContainer.textContent = "Error loading files.";
    }
}

async function openFileFromRepo(repoName, path) {
    try {
        const file = await githubApiRequest(path, "GET", null, repoName);
        if (!file?.content) {
            alert("Unable to load file content.");
            return;
        }

        const decoded = atob(file.content);

        currentEditType = "text";
        currentEditTarget = null;
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

// ============================
// PHASE 9 — EXPANDABLE FOLDER TREE
// ============================

const folderState = {};

function sortEntriesFoldersFirst(entries) {
    return entries.sort((a, b) => {
        if (a.type === "dir" && b.type !== "dir") return -1;
        if (a.type !== "dir" && b.type === "dir") return 1;
        return a.name.localeCompare(b.name);
    });
}

async function loadFolder(repoName, path) {
    return githubApiRequest(path, "GET", null, repoName);
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
    const liveContainer = document.getElementById("repo-live-files");
    const cmsContainer = document.getElementById("repo-cms-files");

    if (!liveContainer || !cmsContainer) return;

    liveContainer.textContent = "Loading...";
    cmsContainer.textContent = "Loading...";

    try {
        await renderRepoRoot("valorwaveentertainment", liveContainer);
        await renderRepoRoot("Valorwave-CMS", cmsContainer);
    } catch (e) {
        console.error("Failed to load file lists:", e);
        liveContainer.textContent = "Error loading files.";
        cmsContainer.textContent = "Error loading files.";
    }
}

// ============================
// PHASE 10 — FILE OPERATIONS (RIGHT-CLICK MENU)
// ============================

let contextTarget = null;

const contextMenu = document.getElementById("context-menu");

if (contextMenu) {
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
}

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

// ============================
// PHASE 11 — DRAG & DROP MOVING
// ============================

let dragItem = null;
let dragOverItem = null;

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

// -------------------------------
// THEME SYSTEM
// -------------------------------
function applyCmsTheme(theme) {
    document.body.className = `theme-${theme}`;
}

function sendThemeToFrames(theme) {
    const msg = { type: "set-theme", theme };
    try { editableFrame.contentWindow.postMessage(msg, "*"); } catch {}
    try { liveFrame.contentWindow.postMessage(msg, "*"); } catch {}
}

async function loadSavedThemes() {
    const cmsTheme = localStorage.getItem("cms-theme") || "original";
    const siteTheme = localStorage.getItem("site-theme") || "original";

    cmsThemeSelect.value = cmsTheme;
    siteThemeSelect.value = siteTheme;

    applyCmsTheme(cmsTheme);
    sendThemeToFrames(siteTheme);
}

cmsThemeSelect.addEventListener("change", e => applyCmsTheme(e.target.value));
siteThemeSelect.addEventListener("change", e => sendThemeToFrames(e.target.value));

saveCmsThemeBtn.addEventListener("click", () => {
    localStorage.setItem("cms-theme", cmsThemeSelect.value);
    cmsThemeSavedMsg.style.opacity = "1";
    setTimeout(() => cmsThemeSavedMsg.style.opacity = "0", 1200);
});

saveSiteThemeBtn.addEventListener("click", () => {
    localStorage.setItem("site-theme", siteThemeSelect.value);
    siteThemeSavedMsg.style.opacity = "1";
    setTimeout(() => siteThemeSavedMsg.style.opacity = "0", 1200);
});

// -------------------------------
// GitHub OAuth Device Flow
// -------------------------------
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

        try {
            await loadSidebarFileListsTree();
        } catch (e) {
            console.error("Failed to load sidebar after auth:", e);
        }

        break;
    }
}

githubLoginBtn.addEventListener("click", () => {
    if (githubToken) return alert("Already authenticated.");
    startGitHubDeviceFlow();
});

// -------------------------------
// GitHub API helpers
// -------------------------------
async function githubApiRequest(path, method = "GET", body = null, repo, owner = "sammassengale82") {
    if (!githubToken) throw new Error("Not authenticated");

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

// -------------------------------
// Save Draft / Publish
// -------------------------------
saveDraftBtn.addEventListener("click", async () => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const path = `drafts/${timestamp}.json`;

        const draftData = {
            content: editorContent.value,
            imageUrl: editorImageURL.value,
            timestamp
        };

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

publishBtn.addEventListener("click", async () => {
    if (!confirm("Publish changes to live site?")) return;

    try {
        let html;

        if (pendingHtml) {
            html = pendingHtml;
        } else {
            const doc = editableFrame.contentDocument || editableFrame.contentWindow.document;
            html = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
        }

        const commitResponse = await commitFile(
            "index.html",
            html,
            "Publish from CMS",
            "valorwaveentertainment"
        );

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const logPath = `publish-logs/${timestamp}.json`;

        const logData = {
            timestamp,
            message: "Publish from CMS",
            path: "index.html",
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
        pendingHtml = null;
        hideUnsavedIndicator();
    } catch (e) {
        console.error(e);
        alert("Failed to publish. Check console for details.");
    }
});

// -------------------------------
// Logout
// -------------------------------
logoutBtn.addEventListener("click", () => {
    githubToken = null;
    authStatus.textContent = "Not authenticated";
    alert("Logged out.");
});

// -------------------------------
// Phase 12 helpers: unsaved indicator + block list
// -------------------------------
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

function updateKnownBlocksFromHtml(html) {
    knownBlocks = [];
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const blocks = doc.querySelectorAll("[data-editable-block]");
        knownBlocks = Array.from(blocks).map(b => ({
            id: b.getAttribute("data-block-id") || "",
            tag: b.tagName.toLowerCase()
        }));
    } catch (e) {
        console.error("Failed to parse HTML for blocks:", e);
    }
}

// -------------------------------
// Phase 12: Add Section modal (created dynamically)
// -------------------------------
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

    const beforeLabel = document.createElement("label");
    positionSelectBefore = document.createElement("input");
    positionSelectBefore.type = "radio";
    positionSelectBefore.name = "insert-position";
    positionSelectBefore.value = "before";
    beforeLabel.appendChild(positionSelectBefore);
    beforeLabel.appendChild(document.createTextNode(" Before"));

    const afterLabel = document.createElement("label");
    positionSelectAfter = document.createElement("input");
    positionSelectAfter.type = "radio";
    positionSelectAfter.name = "insert-position";
    positionSelectAfter.value = "after";
    positionSelectAfter.checked = true;
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

    const endOption = document.createElement("option");
    endOption.value = "";
    endOption.textContent = "End of page";
    targetBlockSelect.appendChild(endOption);

    knownBlocks.forEach(block => {
        const opt = document.createElement("option");
        opt.value = block.id;
        opt.textContent = block.id ? `${block.id} (${block.tag})` : `(unnamed ${block.tag})`;
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
                try {
                    const content = await githubApiRequest(file.path, "GET", null, "Valorwave-CMS");
                    if (!content?.content) return;

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
                } catch (e) {
                    console.error("Failed to load template:", e);
                    alert("Failed to load template. Check console for details.");
                }
            });

            templateListEl.appendChild(btn);
        });
    } catch (e) {
        console.error(e);
        templateListEl.textContent = "Failed to load templates.";
    }

    addSectionOverlay.classList.remove("hidden");
}

// ============================
// INITIALIZATION
// ============================
document.addEventListener("DOMContentLoaded", () => {
    initWysiwygToolbar();
    initEditorShortcuts();

    const draftHistoryBtn = document.getElementById("draft-history");
    const draftHistoryOverlay = document.getElementById("draft-history-overlay");
    const closeDraftHistoryBtn = document.getElementById("close-draft-history");

    if (draftHistoryBtn && draftHistoryOverlay && closeDraftHistoryBtn) {
        draftHistoryBtn.addEventListener("click", openDraftHistoryModal);
        closeDraftHistoryBtn.addEventListener("click", () => {
            draftHistoryOverlay.classList.add("hidden");
        });
    }

    const publishLogsBtn = document.getElementById("publish-logs");
    const publishLogsOverlay = document.getElementById("publish-logs-overlay");
    const closePublishLogsBtn = document.getElementById("close-publish-logs");

    if (publishLogsBtn && publishLogsOverlay && closePublishLogsBtn) {
        publishLogsBtn.addEventListener("click", openPublishLogsModal);
        closePublishLogsBtn.addEventListener("click", () => {
            publishLogsOverlay.classList.add("hidden");
        });
    }

    const addSectionBtn = document.getElementById("add-section");
    if (addSectionBtn) {
        addSectionBtn.addEventListener("click", openAddSectionModal);
    }

    if (githubToken) {
        loadSidebarFileListsTree().catch(e =>
            console.error("Failed to load sidebar on init:", e)
        );
    }

    loadSavedThemes();
});
