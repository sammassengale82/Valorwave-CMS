// -------------------------------
// CONFIG
// -------------------------------
const GITHUB_USER = "sammassengale82";
const WEBSITE_REPO = "valorwaveentertainment";
const BRANCH = "main";

// GitHub API base
const API_BASE = `https://api.github.com/repos/${GITHUB_USER}/${WEBSITE_REPO}/contents/`;

// -------------------------------
// PREVIEW FRAME
// -------------------------------
const previewFrame = document.getElementById("preview-frame");

// -------------------------------
// THEME SWITCHING
// -------------------------------
document.getElementById("cms-theme").addEventListener("change", (e) => {
    document.body.className = `theme-${e.target.value}`;
});

document.getElementById("site-theme").addEventListener("change", (e) => {
    previewFrame.contentWindow.postMessage(
        { type: "set-theme", theme: e.target.value },
        "*"
    );
});

// -------------------------------
// EDITOR MODAL
// -------------------------------
const editorOverlay = document.getElementById("editor-overlay");
const editorContent = document.getElementById("editor-content");
const editorImageURL = document.getElementById("editor-image-url");

document.getElementById("close-editor").onclick = () => editorOverlay.classList.add("hidden");
document.getElementById("cancel-editor").onclick = () => editorOverlay.classList.add("hidden");

// -------------------------------
// SAVE DRAFT / PUBLISH (GitHub API)
// -------------------------------
async function updateFile(path, newContent) {
    const getFile = await fetch(API_BASE + path);
    const fileData = await getFile.json();

    const encoded = btoa(unescape(encodeURIComponent(newContent)));

    const update = await fetch(API_BASE + path, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `token ${GITHUB_TOKEN}` // You will add this later
        },
        body: JSON.stringify({
            message: "CMS Update",
            content: encoded,
            sha: fileData.sha,
            branch: BRANCH
        })
    });

    return update.json();
}

document.getElementById("save-draft").onclick = () => {
    alert("Draft saved (placeholder).");
};

document.getElementById("publish").onclick = () => {
    alert("Publish triggered (GitHub API ready).");
};