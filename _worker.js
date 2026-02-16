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
    <!-- (unchanged CMS UI markup here) -->
  </div>

  <script src="/cms/cms-admin-v2.js" defer></script>
</body>
</html>`;

    // (ADMIN_CSS, THEMES_CSS unchanged — omitted here for brevity)

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
    // LOGIN ROUTES (NEW)
    // ============================================================

    // Redirect user to GitHub OAuth
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
    // API ROUTES (unchanged)
    // ============================================================

    // (Your existing /api routes remain unchanged)

    // ============================================================
    // FALLBACK
    // ============================================================

    return new Response("Not found", { status: 404 });
  }
};