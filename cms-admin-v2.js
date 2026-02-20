// --- THEME SELECTORS ---

const cmsThemeSelect = document.getElementById("cmsThemeSelect");
const siteThemeSelect = document.getElementById("siteThemeSelect");

// Load saved theme choices
const savedCmsTheme = localStorage.getItem("cmsTheme") || "original";
const savedSiteTheme = localStorage.getItem("siteTheme") || "original";

if (cmsThemeSelect) {
  cmsThemeSelect.value = savedCmsTheme;
  document.body.setAttribute("data-theme", savedCmsTheme);

  cmsThemeSelect.addEventListener("change", e => {
    const value = e.target.value;
    document.body.setAttribute("data-theme", value);
    localStorage.setItem("cmsTheme", value);
  });
}

if (siteThemeSelect) {
  siteThemeSelect.value = savedSiteTheme;

  siteThemeSelect.addEventListener("change", e => {
    const value = e.target.value;
    localStorage.setItem("siteTheme", value);
    // Optional: send to backend or message iframe
  });
}

// --- MODAL + EDITING (scaffold) ---

const editModal = document.getElementById("editModal");
const closeModal = document.getElementById("closeModal");
const applyChangesBtn = document.getElementById("applyChangesBtn");
const cancelChangesBtn = document.getElementById("cancelChangesBtn");
const editContent = document.getElementById("editContent");
const editImageUrl = document.getElementById("editImageUrl");
const imageUpload = document.getElementById("imageUpload");
const previewFrame = document.getElementById("previewFrame");

let currentTargetSelector = null;

// Open modal (you’ll wire this to clicks in the iframe later)
function openEditModal(initialText = "", initialImage = "", selector = null) {
  currentTargetSelector = selector;
  if (editContent) editContent.value = initialText;
  if (editImageUrl) editImageUrl.value = initialImage;
  if (editModal) editModal.classList.remove("hidden");
}

function closeEditModal() {
  if (editModal) editModal.classList.add("hidden");
  currentTargetSelector = null;
}

if (closeModal) closeModal.addEventListener("click", closeEditModal);
if (cancelChangesBtn) cancelChangesBtn.addEventListener("click", closeEditModal);

if (applyChangesBtn) {
  applyChangesBtn.addEventListener("click", () => {
    // This is where you’d push changes into the iframe DOM
    // and/or prepare content for /api/save.
    closeEditModal();
  });
}

// --- SAVE / PUBLISH / LOGOUT (endpoints assumed) ---

const saveDraftBtn = document.getElementById("saveDraftBtn");
const publishBtn = document.getElementById("publishBtn");
const logoutBtn = document.getElementById("logoutBtn");

async function callApi(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    ...options
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json().catch(() => ({}));
}

if (saveDraftBtn) {
  saveDraftBtn.addEventListener("click", async () => {
    try {
      // Placeholder: you’ll gather content and call /api/save
      await callApi("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Save draft", content: "<!-- draft html here -->" })
      });
      alert("Draft saved.");
    } catch (e) {
      console.error(e);
      alert("Failed to save draft.");
    }
  });
}

if (publishBtn) {
  publishBtn.addEventListener("click", async () => {
    try {
      // Placeholder: same endpoint, different message
      await callApi("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Publish", content: "<!-- published html here -->" })
      });
      alert("Site published.");
    } catch (e) {
      console.error(e);
      alert("Failed to publish.");
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await callApi("/api/logout");
      window.location.href = "/login";
    } catch (e) {
      console.error(e);
      alert("Failed to log out.");
    }
  });
}
