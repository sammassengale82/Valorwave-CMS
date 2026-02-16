export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    console.log("CMS WORKER ACTIVE:", path);
    console.log(
      "RAW URL:",
      `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_BRANCH}/cms/cms-admin-v2.js`
    );

    // ============================================================
    // EMBEDDED CMS ASSETS (HTML + CSS)
    // ============================================================

    const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Valor Wave CMS 2.0</title>

  <link rel="stylesheet" href="/cms/admin.css" />
  <link rel="stylesheet" href="/cms/themes.css" />
</head>

<body class="logged-out">

  <!-- LOGIN SCREEN -->
  <div id="login-screen">
    <h1>Valor Wave CMS</h1>
    <a id="login-btn" href="/cms/login">Login with GitHub</a>
  </div>

  <!-- MAIN CMS UI -->
  <div id="cms" style="display:none;">

    <!-- SIDEBAR -->
    <aside id="sidebar">
      <div class="sidebar-header">
        <h2>Files</h2>
        <div id="user-display"></div>

        <button id="new-file-btn">New File</button>
        <button id="new-folder-btn">New Folder</button>
      </div>

      <!-- File tree container -->
      <div id="file-list"></div>
    </aside>

    <!-- EDITOR AREA -->
    <main id="editor-area">

      <!-- TOOLBAR -->
      <div id="toolbar">

        <!-- Formatting -->
        <button data-cmd="bold"><b>B</b></button>
        <button data-cmd="italic"><i>I</i></button>
        <button data-cmd="underline"><u>U</u></button>
        <button data-cmd="strike">S</button>

        <button data-cmd="h1">H1</button>
        <button data-cmd="h2">H2</button>
        <button data-cmd="h3">H3</button>

        <button data-cmd="ul">• List</button>
        <button data-cmd="ol">1. List</button>

        <button data-cmd="quote">❝</button>
        <button data-cmd="code">{ }</button>
        <button data-cmd="hr">HR</button>

        <!-- Alignment -->
        <button data-cmd="align-left">Left</button>
        <button data-cmd="align-center">Center</button>
        <button data-cmd="align-right">Right</button>

        <!-- Indent -->
        <button data-cmd="indent">→</button>
        <button data-cmd="outdent">←</button>

        <!-- Clear formatting -->
        <button data-cmd="remove-format">Clear</button>

        <!-- Insert image -->
        <button id="insert-image-btn">📷 Image</button>

        <!-- Hidden upload input -->
        <input 
          type="file" 
          id="upload-image-input"
          accept="image/*"
          multiple
          style="display:none;"
        />

        <!-- More menu -->
        <button id="toolbar-more-btn">⋮</button>
        <div id="toolbar-more" class="hidden">
          <button id="theme-btn">Theme</button>
        </div>

        <!-- Mode toggle -->
        <button id="mode-toggle">WYSIWYG</button>

      </div>

      <!-- EDITOR + PREVIEW -->
      <div id="editor-wrapper">
        <textarea id="editor"></textarea>
        <div id="wysiwyg" class="hidden" contenteditable="true"></div>
        <div id="preview"></div>
      </div>

      <!-- STATUS BAR -->
      <div id="status-bar">
        <span id="status-message">Ready</span>
        <span id="status-autosave">Autosave: idle</span>
      </div>

      <!-- IMAGE URL MODAL -->
      <div id="image-modal" class="modal hidden">
        <div class="modal-content">
          <h2>Insert Image by URL</h2>
          <input id="image-url-input" type="text" placeholder="https://example.com/image.jpg" />
          <button id="insert-image-confirm">Insert</button>
          <button id="insert-image-cancel">Cancel</button>
        </div>
      </div>

      <!-- UPLOAD GALLERY MODAL -->
      <div id="upload-gallery-modal" class="modal hidden">
        <div class="modal-content">
          <h2>Uploaded Images</h2>
          <div id="upload-gallery"></div>
          <button id="insert-selected-btn" disabled>Insert Selected</button>
          <button id="close-gallery-btn">Close</button>
        </div>
      </div>

      <!-- UPLOAD PROGRESS -->
      <div id="upload-progress" style="display:none;">
        <div id="upload-progress-bar"></div>
      </div>

      <!-- DROP ZONE -->
      <div id="drop-zone">Drop images here</div>

    </main>
  </div>

  <script src="/cms/cms-admin-v2.js" defer></script>
</body>
</html>`;

    const ADMIN_CSS = `/* ---------------------------------------------------------
   Valor Wave CMS 2.0 — Admin Styles
   --------------------------------------------------------- */

/* RESET */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: "JetBrains Mono", monospace;
  background: #1a1a1a;
  color: #eee;
  height: 100vh;
  overflow: hidden;
}

/* LOGIN SCREEN */
#login-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

#login-screen button {
  margin-top: 20px;
  padding: 12px 24px;
  font-size: 18px;
}

/* MAIN CMS LAYOUT */
#cms {
  display: flex;
  height: 100vh;
}

/* SIDEBAR */
#sidebar {
  width: 260px;
  background: #111;
  border-right: 1px solid #333;
  padding: 15px;
  overflow-y: auto;
}

.sidebar-header h2 {
  margin-bottom: 10px;
}

.sidebar-header button {
  width: 100%;
  margin-bottom: 8px;
  padding: 8px;
}

#file-list ul {
  list-style: none;
  padding-left: 15px;
}

.folder-node {
  margin-bottom: 4px;
}

.folder-header {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.folder-icon {
  margin-right: 6px;
}

.folder-children.hidden {
  display: none;
}

.file-node {
  cursor: pointer;
  padding: 3px 0;
}

.file-node:hover {
  color: #4da3ff;
}

/* EDITOR AREA */
#editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
}

/* TOOLBAR */
#toolbar {
  display: flex;
  flex-wrap: wrap;
  padding: 10px;
  background: #222;
  border-bottom: 1px solid #333;
}

#toolbar button {
  margin-right: 6px;
  margin-bottom: 6px;
  padding: 6px 10px;
  background: #333;
  border: 1px solid #444;
  color: #eee;
  cursor: pointer;
}

#toolbar button:hover {
  background: #444;
}

#toolbar-more {
  margin-left: 10px;
}

#toolbar-more.hidden {
  display: none;
}

/* EDITOR + PREVIEW */
#editor-wrapper {
  display: flex;
  flex: 1;
  overflow: hidden;
}

#editor,
#wysiwyg,
#preview {
  flex: 1;
  padding: 15px;
  overflow-y: auto;
  border-right: 1px solid #333;
}

#wysiwyg.hidden {
  display: none;
}

#preview {
  background: #111;
}

/* STATUS BAR */
#status-bar {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px;
  background: #222;
  border-top: 1px solid #333;
  font-size: 14px;
}

/* DROP ZONE */
#drop-zone {
  margin: 10px;
  padding: 20px;
  border: 2px dashed #555;
  text-align: center;
  color: #aaa;
}

#drop-zone.dragover {
  border-color: #4da3ff;
  color: #4da3ff;
}

/* UPLOAD PROGRESS */
#upload-progress {
  width: 100%;
  height: 6px;
  background: #333;
  margin-top: 10px;
}

#upload-progress-bar {
  height: 100%;
  width: 0%;
  background: #4da3ff;
  transition: width 0.2s linear;
}

/* THUMBNAILS */
#upload-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.thumb {
  position: relative;
}

.thumb img {
  width: 100px;
  height: 100px;
  object-fit: cover;
}

.thumb .delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: #c00;
  color: white;
  border: none;
  padding: 2px 6px;
  cursor: pointer;
}

/* MODALS */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal.hidden {
  display: none;
}

.modal-content {
  background: #222;
  padding: 20px;
  border: 1px solid #444;
  width: 400px;
}

.modal-content input {
  width: 100%;
  padding: 8px;
  margin-bottom: 12px;
}
`;

    const THEMES_CSS = `/* ---------------------------------------------------------
   Valor Wave CMS 2.0 — Theme Variants
   --------------------------------------------------------- */

/* ORIGINAL THEME */
body.theme-original {
  --bg: #1a1a1a;
  --panel: #222;
  --border: #333;
  --text: #eee;
  --accent: #4da3ff;
}

/* ARMY MULTICAM */
body.theme-multicam {
  --bg: #2b2a27;
  --panel: #3a392f;
  --border: #4a493f;
  --text: #e8e3d3;
  --accent: #b5a76a;
}

/* PATRIOTIC */
body.theme-patriotic {
  --bg: #0b1a33;
  --panel: #11284d;
  --border: #1c3a66;
  --text: #e6e9f2;
  --accent: #d62828;
}

/* DARK MODE OVERRIDE */
body.dark {
  --bg: #000;
  --panel: #111;
  --border: #222;
  --text: #ddd;
  --accent: #4da3ff;
}

/* APPLY VARIABLES */
body {
  background: var(--bg);
  color: var(--text);
}

#sidebar,
#toolbar,
#status-bar,
.modal-content {
  background: var(--panel);
  border-color: var(--border);
}

#toolbar button,
.sidebar-header button {
  background: var(--panel);
  border-color: var(--border);
  color: var(--text);
}

#toolbar button:hover {
  background: var(--border);
}

#drop-zone {
  border-color: var(--border);
}

#drop-zone.dragover {
  border-color: var(--accent);
  color: var(--accent);
}

#upload-progress-bar {
  background: var(--accent);
}

a {
  color: var(--accent);
}
`;

    // ============================================================
    // HELPER: FETCH NON-HTML FILES FROM GITHUB RAW
    // ============================================================

    async function fetchFromGitHub(pathSuffix) {
      const rawUrl = `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_BRANCH}${pathSuffix}`;
      const ghRes = await fetch(rawUrl, {
        headers: { "User-Agent": "ValorWaveCMS" }
      });

      if (!ghRes.ok) {
        return new Response("Not found", { status: 404 });
      }

      const headers = new Headers(ghRes.headers);

      // Set explicit content types
      if (pathSuffix.endsWith(".js")) headers.set("Content-Type", "application/javascript; charset=utf-8");
      if (pathSuffix.endsWith(".css")) headers.set("Content-Type", "text/css; charset=utf-8");
      if (pathSuffix.endsWith(".md")) headers.set("Content-Type", "text/plain; charset=utf-8");
      if (pathSuffix.endsWith(".json")) headers.set("Content-Type", "application/json; charset=utf-8");
      if (pathSuffix.endsWith(".png")) headers.set("Content-Type", "image/png");
      if (pathSuffix.endsWith(".jpg") || pathSuffix.endsWith(".jpeg")) headers.set("Content-Type", "image/jpeg");
      if (pathSuffix.endsWith(".webp")) headers.set("Content-Type", "image/webp");

      return new Response(await ghRes.arrayBuffer(), {
        status: ghRes.status,
        headers
      });
    }

    // ============================================================
    // LOGIN ROUTES
    // ============================================================

    // Redirect to GitHub OAuth
    if (path === "/cms/login") {
      const redirectUrl =
        `https://github.com/login/oauth/authorize` +
        `?client_id=${env.GITHUB_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(env.CALLBACK_URL)}` +
        `&scope=repo`;

      return Response.redirect(redirectUrl, 302);
    }

    // GitHub OAuth callback
    if (path === "/cms/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return new Response("Missing ?code", { status: 400 });
      }

      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: env.CALLBACK_URL
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        return new Response("OAuth failed", { status: 401 });
      }

      const headers = new Headers({
        "Location": "/cms",
        "Set-Cookie": `session=${tokenData.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax`
      });

      return new Response(null, { status: 302, headers });
    }

    // ============================================================
    // CMS STATIC ROUTES
    // ============================================================

    // /cms or /cms/ → index.html (embedded, no sandbox)
    if (path === "/cms" || path === "/cms/") {
      return new Response(INDEX_HTML, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // /cms/admin.css → embedded CSS
    if (path === "/cms/admin.css") {
      return new Response(ADMIN_CSS, {
        status: 200,
        headers: { "Content-Type": "text/css; charset=utf-8" }
      });
    }

    // /cms/themes.css → embedded CSS
    if (path === "/cms/themes.css") {
      return new Response(THEMES_CSS, {
        status: 200,
        headers: { "Content-Type": "text/css; charset=utf-8" }
      });
    }

    // /cms/cms-admin-v2.js → from GitHub (JS is safe from sandbox issue)
    if (path === "/cms/cms-admin-v2.js") {
      return fetchFromGitHub("/cms/cms-admin-v2.js");
    }

    // Serve favicon
    if (path === "/favicon.ico") {
      return fetchFromGitHub("/favicon.ico");
    }

    // /content/* → markdown, images, etc. from GitHub
    if (path.startsWith("/content/")) {
      return fetchFromGitHub(path);
    }

    // ============================================================
    // API ROUTES — GITHUB FILE OPERATIONS
    // ============================================================

    // READ FILE
if (path === "/api/me") {
  const cookie = request.headers.get("Cookie") || "";
  const token = cookie.match(/session=([^;]+)/)?.[1];

  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const ghUser = await fetch("https://api.github.com/user", {
    headers: {
      "User-Agent": "ValorWaveCMS",
      "Authorization": `token ${token}`
    }
  });

  if (!ghUser.ok) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const user = await ghUser.json();

  return new Response(JSON.stringify({
    login: user.login,
    avatar_url: user.avatar_url
  }), {
    headers: { "Content-Type": "application/json" }
  });

    if (path === "/api/read-file" && request.method === "POST") {
      const { filePath } = await request.json();

      const apiUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${filePath}?ref=${env.GITHUB_BRANCH}`;
      const ghRes = await fetch(apiUrl, {
        headers: {
          "User-Agent": "ValorWaveCMS",
          "Accept": "application/vnd.github.v3.raw"
        }
      });

      if (!ghRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to read file" }), { status: 500 });
      }

      const content = await ghRes.text();
      return new Response(JSON.stringify({ content }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // WRITE FILE
    if (path === "/api/write-file" && request.method === "POST") {
      const { filePath, content, message } = await request.json();

      const getUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${filePath}`;
      const getRes = await fetch(getUrl, {
        headers: { "User-Agent": "ValorWaveCMS" }
      });

      let sha = null;
      if (getRes.ok) {
        const data = await getRes.json();
        sha = data.sha;
      }

      const putRes = await fetch(getUrl, {
        method: "PUT",
        headers: {
          "User-Agent": "ValorWaveCMS",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: message || `Update ${filePath}`,
          content: btoa(unescape(encodeURIComponent(content))),
          sha
        })
      });

      if (!putRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to write file" }), { status: 500 });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // CREATE FOLDER
    if (path === "/api/create-folder" && request.method === "POST") {
      const { folderPath } = await request.json();

      const placeholderFile = `${folderPath}/.keep`;
      const apiUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${placeholderFile}`;

      const res = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          "User-Agent": "ValorWaveCMS",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Create folder ${folderPath}`,
          content: btoa("placeholder")
        })
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ error: "Failed to create folder" }), { status: 500 });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // UPLOAD IMAGE
    if (path === "/api/upload-image" && request.method === "POST") {
      const form = await request.formData();
      const file = form.get("file");
      const filePath = form.get("filePath");

      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const apiUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${filePath}`;

      const res = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          "User-Agent": "ValorWaveCMS",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Upload image ${filePath}`,
          content: base64
        })
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ error: "Failed to upload image" }), { status: 500 });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ============================================================
    // FALLBACK
    // ============================================================

    return new Response("Not found", { status: 404 });
  }
};