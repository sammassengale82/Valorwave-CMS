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

// --- Theme switching (CMS + site previews) ---
function applyCmsTheme(theme) {
    document.body.className = `theme-${theme}`;
}

function sendThemeToFrames(theme) {
    const message = { type: "set-theme", theme };
    try {
        editableFrame.contentWindow.postMessage(message, "*");
    } catch (e) {}
    try {
        liveFrame.contentWindow.postMessage(message, "*");
    } catch (e) {}
}

cmsThemeSelect.addEventListener("change", (e) => {
    const theme = e.target.value;
    applyCmsTheme(theme);
});

siteThemeSelect.addEventListener("change", (e) => {
    const theme = e.target.value;
    sendThemeToFrames(theme);
});

// Initialize defaults
applyCmsTheme(cmsThemeSelect.value);
sendThemeToFrames(siteThemeSelect.value);

// --- Editor modal wiring (UI only for now) ---
closeEditorBtn.addEventListener("click", () => {
    editorOverlay.classList.add("hidden");
});

cancelEditorBtn.addEventListener("click", () => {
    editorOverlay.classList.add("hidden");
});

applyChangesBtn.addEventListener("click", () => {
    // Placeholder: this is where content injection / GitHub API update would go
    alert("Apply Changes clicked (content wiring to be added).");
    editorOverlay.classList.add("hidden");
});

// You can later wire up click handlers from inside the editable iframe
// via postMessage to open this editor with specific content.
window.addEventListener("message", (event) => {
    if (!event.data || typeof event.data !== "object") return;

    if (event.data.type === "open-editor") {
        editorContent.value = event.data.content || "";
        editorImageURL.value = event.data.imageUrl || "";
        editorOverlay.classList.remove("hidden");
    }
});

// --- Buttons (placeholders for now) ---
document.getElementById("save-draft").addEventListener("click", () => {
    alert("Save Draft clicked (GitHub API wiring can be added here).");
});

document.getElementById("publish").addEventListener("click", () => {
    alert("Publish clicked (GitHub API wiring can be added here).");
});

document.getElementById("logout").addEventListener("click", () => {
    alert("Logout clicked (session handling can be added here).");
});