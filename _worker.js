export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    console.log("CMS WORKER ACTIVE:", path);

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
    <aside id="sidebar">
      <div class="sidebar-header">
        <h2>Files</h2>
        <div id="user-display"></div>
        <button id="new-file-btn">New File</button>
        <button id="new-folder-btn">New Folder</button>
      </div>
      <div id="file-list"></div>
    </aside>

    <main id="editor-area">
      <div id="toolbar">
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
        <button data-cmd="align-left">Left</button>
        <button data-cmd="align-center">Center</button>
        <button data-cmd="align-right">Right</button>
        <button data-cmd="indent">→</button>
        <button data-cmd="outdent">←</button>
        <button data-cmd="remove-format">Clear</button>
        <button id="insert-image-btn">📷 Image</button>
        <input type="file" id="upload-image-input" accept="image/*" multiple style="display:none;" />
        <button id="toolbar-more-btn">⋮</button>
        <div id="toolbar-more" class="hidden">
          <button id="theme-btn">Theme</button>
        </div>
        <button id="mode-toggle">WYSIWYG</button>
      </div>

      <div id="editor-wrapper">
        <textarea id="editor"></textarea>
        <div id="wysiwyg" class="hidden" contenteditable="true"></div>
        <div id="preview"></div>
      </div>

      <div id="status-bar">
        <span id="status-message">Ready</span>
        <span id="status-autosave">Autosave: idle</span>
      </div>

      <div id="image-modal" class="modal hidden">
        <div class="modal-content">
          <h2>Insert Image by URL</h2>
          <input id="image-url-input" type="text" placeholder="https://example.com/image.jpg" />
          <button id="insert-image-confirm">Insert</button>
          <button id="insert-image-cancel">Cancel</button>
        </div>
      </div>

      <div id="upload-gallery-modal" class="modal hidden">
        <div class="modal-content">
          <h2>Uploaded Images</h2>
          <div id="upload-gallery"></div>
          <button id="insert-selected-btn" disabled>Insert Selected</button>
          <button id="close-gallery-btn">Close</button>
        </div>
      </div>

      <div id="upload-progress" style="display:none;">
        <div id="upload-progress-bar"></div>
      </div>

      <div id="drop-zone">Drop images here</div>
    </main>
  </div>

  <script src="/cms/cms-admin-v2.js" defer></script>
</body>
</html>`;

    const ADMIN_CSS = `/* Admin CSS omitted for brevity */`;
    const THEMES_CSS = `/* Themes CSS omitted for brevity */`;

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

    if (path === "/cms/login") {
      const redirectUrl =
        `https://github.com/login/oauth/authorize` +
        `?client_id=${env.GITHUB_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(env.CALLBACK_URL)}` +
        `&scope=repo`;

      return Response.redirect(redirectUrl, 302);
    }

    if (path === "/cms/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing ?code", { status: 400 });

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
    // AUTH: /api/me
    // ============================================================

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
    }

    // ============================================================
    // LOGOUT
    // ============================================================

    if (path === "/api/logout") {
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
        }
      });
    }

    // ============================================================
    // CMS STATIC ROUTES
    // ============================================================

    if (path === "/cms" || path === "/cms/") {
      return new Response(INDEX_HTML, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    if (path === "/cms/admin.css") {
      return new Response(ADMIN_CSS, {
        status: 200,
        headers: { "Content-Type": "text/css; charset=utf-8" }
      });
    }

    if (path === "/cms/themes.css") {
      return new Response(THEMES_CSS, {
        status: 200,
        headers: { "Content-Type": "text/css; charset=utf-8" }
      });
    }

    if (path === "/cms/cms-admin-v2.js") {
      return fetchFromGitHub("/cms/cms-admin-v2.js");
    }

    if (path === "/favicon.ico") {
      return fetchFromGitHub("/favicon.ico");
    }

    if (path.startsWith("/content/")) {
      return fetchFromGitHub(path);
    }

    // ============================================================
    // API ROUTES — FILE OPERATIONS
    // ============================================================

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