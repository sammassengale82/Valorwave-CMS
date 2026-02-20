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

// -------------------------------
// Split pane drag logic
// -------------------------------
let isDragging = false;

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

// -------------------------------
// Editor modal logic (message-based)
// -------------------------------
window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.type !== "open-editor") return;

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
});

cancelEditorBtn.addEventListener("click", () => {
    editorOverlay.classList.add("hidden");
    currentEditTarget = null;
});

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

            // Clear context and close modal
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

// Fetch list of publish logs
async function fetchPublishLogList() {
    return githubApiRequest("publish-logs", "GET", null, "Valorwave-CMS");
}

// Fetch a single publish log
async function fetchPublishLog(path) {
    const response = await githubApiRequest(path, "GET", null, "Valorwave-CMS");
    if (!response?.content) return null;
    return JSON.parse(atob(response.content));
}

// Open Publish Logs modal
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
    // root path is "" → /contents/
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
            // Phase 9: expand into full explorer
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
        const [liveEntries, cmsEntries] = await Promise.all([
            fetchRepoRoot(LIVE_REPO),
            fetchRepoRoot(CMS_REPO)
        ]);

        renderFileList(liveContainer, LIVE_REPO, liveEntries);
        renderFileList(cmsContainer, CMS_REPO, cmsEntries);
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

        // Load into existing editor modal
        currentEditType = "text";
        currentEditTarget = null; // we're editing a repo file, not DOM selector
        editorContent.value = decoded;
        editorImageURL.value = "";
        editorImageUpload.value = "";

        // Store context on the modal element so we know what to save later
        editorModal.dataset.repoName = repoName;
        editorModal.dataset.filePath = path;

        editorOverlay.classList.remove("hidden");
    } catch (e) {
        console.error("Failed to open file:", e);
        alert("Failed to open file. Check console for details.");
    }
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
        const doc = editableFrame.contentDocument || editableFrame.contentWindow.document;
        const html = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;

        // 1. Commit to live repo
        const commitResponse = await commitFile(
            "index.html",
            html,
            "Publish from CMS",
            "valorwaveentertainment"
        );

        // 2. Build publish log
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const logPath = `publish-logs/${timestamp}.json`;

        const logData = {
            timestamp,
            message: "Publish from CMS",
            path: "index.html",
            commitSha: commitResponse.commit.sha,
            previewUrl: `https://raw.githubusercontent.com/sammassengale82/valorwaveentertainment/main/index.html`
        };

        // 3. Save publish log to Valorwave-CMS
        await commitFile(
            logPath,
            JSON.stringify(logData, null, 2),
            `Publish log ${timestamp}`,
            "Valorwave-CMS"
        );

        alert("Site published and publish log saved!");
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
        // Phase 7 — Publish Logs
    const publishLogsBtn = document.getElementById("publish-logs");
    const publishLogsOverlay = document.getElementById("publish-logs-overlay");
    const closePublishLogsBtn = document.getElementById("close-publish-logs");

    if (publishLogsBtn && publishLogsOverlay && closePublishLogsBtn) {
        publishLogsBtn.addEventListener("click", openPublishLogsModal);
        closePublishLogsBtn.addEventListener("click", () => {
            publishLogsOverlay.classList.add("hidden");
          });
}
// Phase 8 — load file sidebar
    loadSidebarFileLists();
});

// -------------------------------
// Load Themes
// -------------------------------
loadSavedThemes();
