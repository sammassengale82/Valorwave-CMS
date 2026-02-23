/* ============================================================
   EDITOR PANEL CONTROLLER
   - Resizable right-side panel
   - Content / Design / Settings sections
   - CMS + Site theme controls
   - Preview Draft
   - Structured VE → CMS → VE messaging
============================================================ */

let editorPanel = null;
let editorResizeHandle = null;
let editorContentFields = null;
let editorDesignFields = null;
let editorSettingsFields = null;

let editorApplyBtn = null;
let editorCancelBtn = null;
let editorCloseBtn = null;

let panelcmsThemeSelect = null;
let panelsiteThemeSelect = null;
let panelsaveCmsThemeBtn = null;
let panelsaveSiteThemeBtn = null;
let previewDraftBtn = null;

let currentEditPayload = null;
let isResizingPanel = false;

/* ============================================================
   INITIALIZE PANEL
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
    editorPanel = document.getElementById("editor-panel");
    editorResizeHandle = document.getElementById("editor-panel-resize-handle");

    editorContentFields = document.getElementById("editor-content-fields");
    editorDesignFields = document.getElementById("editor-design-fields");
    editorSettingsFields = document.getElementById("editor-settings-fields");

    editorApplyBtn = document.getElementById("editor-apply-btn");
    editorCancelBtn = document.getElementById("editor-cancel-btn");
    editorCloseBtn = document.getElementById("editor-panel-close");

    panelcmsThemeSelect = document.getElementById("cms-theme-select");
    panelsiteThemeSelect = document.getElementById("site-theme-select");
    panelsaveCmsThemeBtn = document.getElementById("save-cms-theme");
    panelsaveSiteThemeBtn = document.getElementById("save-site-theme");
    previewDraftBtn = document.getElementById("preview-draft-btn");

    setupPanelResize();
    setupThemeControls();
    setupEditorButtons();
});

/* ============================================================
   PANEL RESIZING
============================================================ */
function setupPanelResize() {
    if (!editorResizeHandle) return;

    editorResizeHandle.addEventListener("mousedown", () => {
        isResizingPanel = true;
        document.body.style.userSelect = "none";
    });

    document.addEventListener("mouseup", () => {
        isResizingPanel = false;
        document.body.style.userSelect = "";
    });

    document.addEventListener("mousemove", (e) => {
        if (!isResizingPanel) return;

        const newWidth = window.innerWidth - e.clientX;
        const minWidth = 300;
        const maxWidth = 600;

        const finalWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        editorPanel.style.width = `${finalWidth}px`;
    });
}

/* ============================================================
   THEME CONTROLS
============================================================ */
function setupThemeControls() {
    // CMS Theme
    panelcmsThemeSelect?.addEventListener("change", () => {
        document.body.classList.remove("cms-theme-original", "cms-theme-army", "cms-theme-patriotic");
        document.body.classList.add(`cms-theme-${cmsThemeSelect.value}`);
    });

    panelsaveCmsThemeBtn?.addEventListener("click", async () => {
        await saveThemeFile("cms-theme.txt", cmsThemeSelect.value);
        alert("CMS Theme saved.");
    });

    // Site Theme
    panelsiteThemeSelect?.addEventListener("change", () => {
        if (editableFrame?.contentWindow) {
            editableFrame.contentWindow.postMessage({
                type: "set-theme",
                theme: siteThemeSelect.value
            }, "*");
        }
    });

    panelsaveSiteThemeBtn?.addEventListener("click", async () => {
        await saveThemeFile("site-theme.txt", siteThemeSelect.value);
        alert("Site Theme saved.");
    });

    previewDraftBtn?.addEventListener("click", () => {
        window.open("/preview-draft.html", "_blank");
    });
}

async function saveThemeFile(filename, value) {
    await githubApiRequest(filename, "PUT", {
        message: `Save theme: ${value}`,
        content: btoa(value)
    }, "ValorWave-CMS");
}

/* ============================================================
   EDITOR BUTTONS
============================================================ */
function setupEditorButtons() {
    editorCloseBtn?.addEventListener("click", closeEditorPanel);
    editorCancelBtn?.addEventListener("click", closeEditorPanel);

    editorApplyBtn?.addEventListener("click", () => {
        if (!currentEditPayload) return;

        const message = buildApplyMessage(currentEditPayload);
        editableFrame.contentWindow.postMessage(message, "*");

        closeEditorPanel();
    });
}

/* ============================================================
   OPEN EDITOR PANEL (FROM VE)
============================================================ */
function openEditorPanel(payload) {
    currentEditPayload = payload;

    // Set block name
    document.getElementById("editor-block-name").textContent =
        payload.editType.charAt(0).toUpperCase() + payload.editType.slice(1);

    // Clear previous fields
    editorContentFields.innerHTML = "";
    editorDesignFields.innerHTML = "";
    editorSettingsFields.innerHTML = "";

    // Populate sections
    populateContentSection(payload);
    populateDesignSection(payload);
    populateSettingsSection(payload);

    // Show panel instantly
    editorPanel.classList.remove("hidden");
}

/* ============================================================
   CLOSE PANEL
============================================================ */
function closeEditorPanel() {
    editorPanel.classList.add("hidden");
    currentEditPayload = null;
}

/* ============================================================
   POPULATE CONTENT SECTION
============================================================ */
function populateContentSection(payload) {
    const type = payload.editType;

    if (type === "text") {
        editorContentFields.innerHTML = `
            <div id="editor-wysiwyg-toolbar">
                <button class="wysiwyg-btn" data-cmd="bold">B</button>
                <button class="wysiwyg-btn" data-cmd="italic">I</button>
                <button class="wysiwyg-btn" data-cmd="underline">U</button>
                <button class="wysiwyg-btn" data-cmd="h1">H1</button>
                <button class="wysiwyg-btn" data-cmd="h2">H2</button>
                <button class="wysiwyg-btn" data-cmd="h3">H3</button>
            </div>

            <textarea id="editor-text-content">${payload.text || ""}</textarea>
        `;
    }

    if (type === "link") {
        editorContentFields.innerHTML = `
            <label>Label</label>
            <input id="editor-link-label" value="${payload.label || ""}">

            <label>URL</label>
            <input id="editor-link-url" value="${payload.url || ""}">

            <label class="toggle-switch">
                <input type="checkbox" id="editor-link-target" ${payload.target === "_blank" ? "checked" : ""}>
                Open in new tab
            </label>
        `;
    }

    if (type === "image") {
        editorContentFields.innerHTML = `
            <label>Image URL</label>
            <input id="editor-image-url" value="${payload.imageUrl || ""}">

            <label>Alt Text</label>
            <input id="editor-image-alt" value="${payload.alt || ""}">
        `;
    }
}

/* ============================================================
   POPULATE DESIGN SECTION
============================================================ */
function populateDesignSection(payload) {
    editorDesignFields.innerHTML = `
        <label>Padding</label>
        <input type="range" min="0" max="80" id="editor-padding" value="${payload.style?.padding || 0}">
        
        <label>Corner Radius</label>
        <input type="range" min="0" max="40" id="editor-radius" value="${payload.style?.radius || 0}">
    `;
}

/* ============================================================
   POPULATE SETTINGS SECTION
============================================================ */
function populateSettingsSection(payload) {
    editorSettingsFields.innerHTML = `
        <label>Block ID</label>
        <input value="${payload.targetSelector}" disabled>
    `;
}

/* ============================================================
   BUILD APPLY MESSAGE (CMS → VE)
============================================================ */
function buildApplyMessage(payload) {
    const type = payload.editType;

    const msg = {
        type: "apply-edit",
        editType: type,
        targetSelector: payload.targetSelector
    };

    if (type === "text") {
        msg.text = document.getElementById("editor-text-content").value;
    }

    if (type === "link") {
        msg.label = document.getElementById("editor-link-label").value;
        msg.url = document.getElementById("editor-link-url").value;
        msg.target = document.getElementById("editor-link-target").checked ? "_blank" : "_self";
    }

    if (type === "image") {
        msg.imageUrl = document.getElementById("editor-image-url").value;
        msg.alt = document.getElementById("editor-image-alt").value;
    }

    msg.style = {
        padding: document.getElementById("editor-padding")?.value || 0,
        radius: document.getElementById("editor-radius")?.value || 0
    };

    return msg;
}

/* ============================================================
   MESSAGE LISTENER (VE → CMS)
============================================================ */
window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data) return;

    if (data.type === "open-editor") {
        openEditorPanel(data);
    }
});
