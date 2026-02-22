/* ============================================================
   Valor Wave CMS — Monaco File Editor
   Phase 14 — Single‑File Editor Route
   ------------------------------------------------------------
   Responsibilities:
   - Parse repo + path from URL
   - Load file content via Worker GitHub API
   - Initialize Monaco editor
   - Apply CMS theme (original / army / patriotic)
   - Save file back to GitHub
   - Keyboard shortcuts (Ctrl+S)
   ============================================================ */

const API_BASE = "https://cms-api.valorwaveentertainment.com";

/* ------------------------------------------------------------
   Parse URL parameters
------------------------------------------------------------ */
const params = new URLSearchParams(window.location.search);
const repo = params.get("repo");
const filePath = params.get("path");

if (!repo || !filePath) {
    alert("Missing repo or path in URL.");
    throw new Error("Missing repo/path");
}

/* ------------------------------------------------------------
   DOM references
------------------------------------------------------------ */
const backBtn = document.getElementById("back-btn");
const saveBtn = document.getElementById("save-btn");
const repoLabel = document.getElementById("repo-label");
const pathLabel = document.getElementById("path-label");
const editorContainer = document.getElementById("editor-container");

repoLabel.textContent = repo;
pathLabel.textContent = filePath;

/* ------------------------------------------------------------
   Back to CMS
------------------------------------------------------------ */
backBtn.addEventListener("click", () => {
    window.location.href = "/";
});

/* ------------------------------------------------------------
   Apply CMS theme to this page + Monaco
------------------------------------------------------------ */
function applyCmsTheme() {
    const theme = localStorage.getItem("cms-theme") || "original";

    document.documentElement.classList.remove(
        "cms-theme-original",
        "cms-theme-army",
        "cms-theme-patriotic"
    );

    document.documentElement.classList.add(`cms-theme-${theme}`);

    // Monaco theme mapping
    if (window.monaco) {
        if (theme === "original") monaco.editor.setTheme("vs-dark");
        if (theme === "army") monaco.editor.setTheme("vs-dark");
        if (theme === "patriotic") monaco.editor.setTheme("vs-dark");
    }
}

applyCmsTheme();

/* ------------------------------------------------------------
   GitHub API helpers (via Worker)
------------------------------------------------------------ */
async function githubApiRequest(path, method = "GET", body = null, repoName) {
    const res = await fetch(`${API_BASE}/api/github`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            path,
            method,
            body,
            repo: repoName,
            owner: "sammassengale82"
        })
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub API error: ${res.status} — ${text}`);
    }

    return res.json();
}

async function getFileSha(path, repoName) {
    try {
        const data = await githubApiRequest(path, "GET", null, repoName);
        return data.sha || null;
    } catch {
        return null;
    }
}

/* ------------------------------------------------------------
   Load file content
------------------------------------------------------------ */
async function loadFile() {
    const file = await githubApiRequest(filePath, "GET", null, repo);
    if (!file?.content) throw new Error("File has no content");

    return atob(file.content);
}

/* ------------------------------------------------------------
   Save file content
------------------------------------------------------------ */
async function saveFile(content) {
    const sha = await getFileSha(filePath, repo);
    const encoded = btoa(unescape(encodeURIComponent(content)));

    const body = { message: `Edit ${filePath}`, content: encoded };
    if (sha) body.sha = sha;

    await githubApiRequest(filePath, "PUT", body, repo);
}

/* ------------------------------------------------------------
   Initialize Monaco
------------------------------------------------------------ */
let editor = null;

require.config({
    paths: {
        vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs"
    }
});

require(["vs/editor/editor.main"], async () => {
    try {
        const content = await loadFile();

        editor = monaco.editor.create(editorContainer, {
            value: content,
            language: detectLanguage(filePath),
            theme: "vs-dark",
            automaticLayout: true,
            fontSize: 15,
            minimap: { enabled: false }
        });

        applyCmsTheme();
    } catch (err) {
        console.error(err);
        alert("Failed to load file.");
    }
});

/* ------------------------------------------------------------
   Detect language from file extension
------------------------------------------------------------ */
function detectLanguage(path) {
    const lower = path.toLowerCase();
    if (lower.endsWith(".html")) return "html";
    if (lower.endsWith(".css")) return "css";
    if (lower.endsWith(".js")) return "javascript";
    if (lower.endsWith(".json")) return "json";
    if (lower.endsWith(".md")) return "markdown";
    if (lower.endsWith(".xml")) return "xml";
    return "plaintext";
}

/* ------------------------------------------------------------
   Save button
------------------------------------------------------------ */
saveBtn.addEventListener("click", async () => {
    if (!editor) return;

    try {
        const content = editor.getValue();
        await saveFile(content);
        alert("File saved!");
    } catch (err) {
        console.error(err);
        alert("Failed to save file.");
    }
});

/* ------------------------------------------------------------
   Keyboard shortcuts
------------------------------------------------------------ */
document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveBtn.click();
    }
});
