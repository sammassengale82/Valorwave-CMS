// -------------------------------
// GitHub OAuth (Device Flow)
// -------------------------------
const GITHUB_CLIENT_ID = "0v23lioJaq0Kfz4sXFss"; // from your GitHub OAuth App
const GITHUB_SCOPES = "repo";
let githubToken = null; // in-memory only

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

// Track current edit target
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

applyChangesBtn.addEventListener("click", () => {
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
        console.error("Failed to send apply-edit to editable frame:", e);
    }

    editorOverlay.classList.add("hidden");
    currentEditTarget = null;
});
// ============================
// PHASE 4 — WYSIWYG TOOLBAR
// ============================

function applyFormatting(type) {
    const textarea = document.getElementById("editor-content");
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const selected = value.substring(start, end);

    let replacement = selected;

    switch (type) {
        case "bold":
            replacement = `**${selected || "bold text"}**`;
            break;

        case "italic":
            replacement = `*${selected || "italic text"}*`;
            break;

        case "underline":
            replacement = `<u>${selected || "underlined text"}</u>`;
            break;

        case "h1":
            replacement = `# ${selected || "Heading 1"}`;
            break;

        case "h2":
            replacement = `## ${selected || "Heading 2"}`;
            break;

        case "h3":
            replacement = `### ${selected || "Heading 3"}`;
            break;

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

    textarea.value =
        value.substring(0, start) +
        replacement +
        value.substring(end);

    textarea.focus();
    textarea.selectionStart = start;
    textarea.selectionEnd = start + replacement.length;

    // Refresh preview
    if (typeof updatePreview === "function") {
        updatePreview();
    }
}

function initWysiwygToolbar() {
    const toolbar = document.getElementById("wysiwyg-toolbar");
    if (!toolbar) return;

    toolbar.addEventListener("click", (e) => {
        const button = e.target.closest("button");
        if (!button) return;
        const action = button.dataset.action;
        if (!action) return;
        applyFormatting(action);
    });
}

function initEditorShortcuts() {
    const textarea = document.getElementById("editor-content");
    if (!textarea) return;

    textarea.addEventListener("keydown", (e) => {
        if (!e.ctrlKey && !e.metaKey) return;

        if (e.key.toLowerCase() === "b") {
            e.preventDefault();
            applyFormatting("bold");
        }
        if (e.key.toLowerCase() === "i") {
            e.preventDefault();
            applyFormatting("italic");
        }
        if (e.key.toLowerCase() === "u") {
            e.preventDefault();
            applyFormatting("underline");
        }
    });
}

// -------------------------------
// THEME SYSTEM (CMS + SITE)
// -------------------------------
function applyCmsTheme(theme) {
    document.body.className = `theme-${theme}`;
}

function sendThemeToFrames(theme) {
    const msg = { type: "set-theme", theme };
    try { editableFrame.contentWindow.postMessage(msg, "*"); } catch (e) {}
    try { liveFrame.contentWindow.postMessage(msg, "*"); } catch (e) {}
}

async function loadSavedThemes() {
    try {
        const cmsTheme = localStorage.getItem("cms-theme") || "original";
        const siteTheme = localStorage.getItem("site-theme") || "original";

        cmsThemeSelect.value = cmsTheme;
        siteThemeSelect.value = siteTheme;

        applyCmsTheme(cmsTheme);
        sendThemeToFrames(siteTheme);
    } catch (e) {
        console.warn("Theme load failed:", e);
    }
}

// Save CMS theme → Valorwave-CMS
saveCmsThemeBtn.addEventListener("click", async () => {
    const theme = cmsThemeSelect.value;
    localStorage.setItem("cms-theme", theme);

    try {
        await commitFile(
            "cms-theme.txt",
            theme,
            "Save CMS theme from CMS",
            "Valorwave-CMS"
        );
    } catch (e) {
        console.warn("Failed to save CMS theme to GitHub:", e);
    }

    cmsThemeSavedMsg.style.opacity = 1;
    setTimeout(() => cmsThemeSavedMsg.style.opacity = 0, 1500);
});

// Save Site theme → valorwaveentertainment
saveSiteThemeBtn.addEventListener("click", async () => {
    const theme = siteThemeSelect.value;
    localStorage.setItem("site-theme", theme);

    try {
        await commitFile(
            "site-theme.txt",
            theme,
            "Save site theme from CMS",
            "valorwaveentertainment"
        );
    } catch (e) {
        console.warn("Failed to save site theme to GitHub:", e);
    }

    siteThemeSavedMsg.style.opacity = 1;
    setTimeout(() => siteThemeSavedMsg.style.opacity = 0, 1500);
});

// Instant preview on dropdown change
cmsThemeSelect.addEventListener("change", e => {
    applyCmsTheme(e.target.value);
});

siteThemeSelect.addEventListener("change", e => {
    sendThemeToFrames(e.target.value);
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
        console.error(data);
        return;
    }

    const msg = `Go to ${data.verification_uri} and enter code: ${data.user_code}`;
    alert(msg);
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

        if (data.error === "authorization_pending") {
            continue;
        }

        if (data.error) {
            console.error("OAuth error:", data);
            authStatus.textContent = "GitHub auth failed.";
            return;
        }

        githubToken = data.access_token;
        authStatus.textContent = "Authenticated with GitHub.";
        break;
    }
}

githubLoginBtn.addEventListener("click", () => {
    if (githubToken) {
        alert("Already authenticated with GitHub.");
        return;
    }
    startGitHubDeviceFlow().catch(err => {
        console.error(err);
        authStatus.textContent = "GitHub auth error.";
    });
});

// -------------------------------
// GitHub API helpers (using OAuth token)
// -------------------------------
async function githubApiRequest(path, method = "GET", body = null, repo, owner = "sammassengale82") {
    if (!githubToken) {
        alert("You must login with GitHub first.");
        throw new Error("No GitHub token");
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    const options = {
        method,
        headers: {
            "Authorization": `Bearer ${githubToken}`,
            "Accept": "application/vnd.github+json"
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub ${method} ${path} failed: ${res.status} ${text}`);
    }
    return res.json();
}

async function getFileSha(path, repo) {
    try {
        const data = await githubApiRequest(path, "GET", null, repo);
        return data.sha;
    } catch (e) {
        return null;
    }
}

async function commitFile(path, content, message, repo) {
    const sha = await getFileSha(path, repo);
    const encoded = btoa(unescape(encodeURIComponent(content)));

    const body = {
        message,
        content: encoded
    };

    if (sha) {
        body.sha = sha;
    }

    return githubApiRequest(path, "PUT", body, repo);
}

// -------------------------------
// Save Draft / Publish
// -------------------------------
saveDraftBtn.addEventListener("click", async () => {
    try {
        const doc = editableFrame.contentDocument || editableFrame.contentWindow.document;
        const html = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;

        await commitFile(
            "drafts/index.html",
            html,
            "Save draft from CMS",
            "Valorwave-CMS"
        );

        alert("Draft saved to Valorwave-CMS/drafts/index.html");
    } catch (e) {
        console.error(e);
        alert("Failed to save draft. Check console for details.");
    }
});

publishBtn.addEventListener("click", async () => {
    if (!confirm("Publish changes to live site?")) return;

    try {
        const doc = editableFrame.contentDocument || editableFrame.contentWindow.document;
        const html = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;

        await commitFile(
            "index.html",
            html,
            "Publish from CMS",
            "valorwaveentertainment"
        );

        alert("Site published to valorwaveentertainment/index.html");
    } catch (e) {
        console.error(e);
        alert("Failed to publish. Check console for details.");
    }
});

// -------------------------------
// Logout (just clears token in this setup)
// -------------------------------
logoutBtn.addEventListener("click", () => {
    githubToken = null;
    authStatus.textContent = "Not authenticated";
    alert("Logged out of GitHub in this session.");
});

// ============================
// PHASE 4 — INITIALIZATION
// ============================
document.addEventListener("DOMContentLoaded", () => {
    initWysiwygToolbar();
    initEditorShortcuts();
});

// -------------------------------
// Init
// -------------------------------
loadSavedThemes();



