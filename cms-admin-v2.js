// --- DOM references ---
const editableFrame = document.getElementById("preview-frame-editable");
const liveFrame = document.getElementById("preview-frame-live");
const dragBar = document.getElementById("drag-bar");
const topPane = document.getElementById("top-pane");
const bottomPane = document.getElementById("bottom-pane");

const cmsThemeSelect = document.getElementById("cms-theme");
const siteThemeSelect = document.getElementById("site-theme");

const editorOverlay = document.getElementById("editor-overlay");
const editorContent = document.getElementById("editor-content");
const editorImageURL = document.getElementById("editor-image-url");
const editorImageUpload = document.getElementById("editor-image-upload");
const closeEditorBtn = document.getElementById("close-editor");
const cancelEditorBtn = document.getElementById("cancel-editor");
const applyChangesBtn = document.getElementById("apply-changes");

// --- Force overlay hidden on load ---
editorOverlay.style.display = "none";

// --- Resizable vertical split ---
(function setupVerticalSplit() {
    let isDragging = false;
    let startY = 0;
    let startTopHeight = 0;

    dragBar.addEventListener("mousedown", (e) => {
        e.preventDefault();
        isDragging = true;
        startY = e.clientY;
        startTopHeight = topPane.getBoundingClientRect().height;
        document.body.style.cursor = "row-resize";
    });

    window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const dy = e.clientY - startY;
        const containerHeight = topPane.parentElement.getBoundingClientRect().height;
        let newTopHeight = startTopHeight + dy;

        const minHeight = 80;
        const maxHeight = containerHeight - 80;
        if (newTopHeight < minHeight) newTopHeight = minHeight;
        if (newTopHeight > maxHeight) newTopHeight = maxHeight;

        const topPercent = (newTopHeight / containerHeight) * 100;
        const bottomPercent = 100 - topPercent;

        topPane.style.flex = `0 0 ${topPercent}%`;
        bottomPane.style.flex = `0 0 ${bottomPercent}%`;
    });

    window.addEventListener("mouseup", () => {
        if (!isDragging) return;
        isDragging = false;
        document.body.style.cursor = "default";
    });
})();

/* -------------------------------
   THEME SYSTEM (CMS + SITE)
--------------------------------*/

// DOM refs
const cmsThemeSelect = document.getElementById("cms-theme");
const siteThemeSelect = document.getElementById("site-theme");

const saveCmsThemeBtn = document.getElementById("save-cms-theme");
const saveSiteThemeBtn = document.getElementById("save-site-theme");

const cmsThemeSavedMsg = document.getElementById("cms-theme-saved");
const siteThemeSavedMsg = document.getElementById("site-theme-saved");

// Apply CMS theme instantly
function applyCmsTheme(theme) {
    document.body.className = `theme-${theme}`;
}

// Send theme to iframes instantly
function sendThemeToFrames(theme) {
    const msg = { type: "set-theme", theme };
    try { editableFrame.contentWindow.postMessage(msg, "*"); } catch (e) {}
    try { liveFrame.contentWindow.postMessage(msg, "*"); } catch (e) {}
}

// Load saved themes on startup
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

// Save CMS theme
saveCmsThemeBtn.addEventListener("click", () => {
    const theme = cmsThemeSelect.value;
    localStorage.setItem("cms-theme", theme);

    cmsThemeSavedMsg.style.opacity = 1;
    setTimeout(() => cmsThemeSavedMsg.style.opacity = 0, 1500);
});

// Save Site theme
saveSiteThemeBtn.addEventListener("click", () => {
    const theme = siteThemeSelect.value;
    localStorage.setItem("site-theme", theme);

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

// Initialize
loadSavedThemes();


// --- Editor modal wiring ---
closeEditorBtn.addEventListener("click", () => {
    editorOverlay.style.display = "none";
});

cancelEditorBtn.addEventListener("click", () => {
    editorOverlay.style.display = "none";
});

applyChangesBtn.addEventListener("click", () => {
    alert("Apply Changes clicked (content wiring to be added).");
    editorOverlay.style.display = "none";
});

// --- Listen for future editable events ---
window.addEventListener("message", (event) => {
    if (!event.data || typeof event.data !== "object") return;

    if (event.data.type === "open-editor") {
        editorContent.value = event.data.content || "";
        editorImageURL.value = event.data.imageUrl || "";
        editorOverlay.style.display = "flex";
    }
});

// --- Placeholder buttons ---
document.getElementById("save-draft").addEventListener("click", () => {
    alert("Save Draft clicked.");
});

document.getElementById("publish").addEventListener("click", () => {
    alert("Publish clicked.");
});

document.getElementById("logout").addEventListener("click", () => {
    alert("Logout clicked.");
});
