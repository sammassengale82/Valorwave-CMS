/* ============================================================
   EDITOR PANEL — PHASE 14 (SAFE, ASYNC, VE-COMPATIBLE)
============================================================ */

let currentEditPayload = null;

/* -----------------------------
   OPEN EDITOR PANEL (FROM VE)
----------------------------- */
function openEditorPanel(payload) {
    currentEditPayload = payload;

    // Wait until panel HTML is actually loaded
    if (
        !document.getElementById("editor-block-name") ||
        !window.editorContentFields ||
        !window.editorDesignFields ||
        !window.editorSettingsFields ||
        !window.editorPanel
    ) {
        setTimeout(() => openEditorPanel(payload), 40);
        return;
    }

    // Set block name
    const blockNameEl = document.getElementById("editor-block-name");
    blockNameEl.textContent =
        payload.editType.charAt(0).toUpperCase() + payload.editType.slice(1);

    // Clear previous fields
    editorContentFields.innerHTML = "";
    editorDesignFields.innerHTML = "";
    editorSettingsFields.innerHTML = "";

    // Populate sections
    populateContentSection(payload);
    populateDesignSection(payload);
    populateSettingsSection(payload);

    // Show panel
    editorPanel.classList.remove("hidden");
}

/* -----------------------------
   CONTENT SECTION
----------------------------- */
function populateContentSection(payload) {
    const wrapper = document.createElement("div");
    wrapper.className = "editor-field-group";

    const label = document.createElement("label");
    label.textContent = "Content";

    const textarea = document.createElement("textarea");
    textarea.value = payload.innerHTML || "";

    textarea.addEventListener("input", () => {
        currentEditPayload.innerHTML = textarea.value;
        sendPreviewUpdate();
    });

    wrapper.appendChild(label);
    wrapper.appendChild(textarea);
    editorContentFields.appendChild(wrapper);
}

/* -----------------------------
   DESIGN SECTION (stub)
----------------------------- */
function populateDesignSection(payload) {
    const wrapper = document.createElement("div");
    wrapper.textContent = "Design controls coming soon.";
    editorDesignFields.appendChild(wrapper);
}

/* -----------------------------
   SETTINGS SECTION (stub)
----------------------------- */
function populateSettingsSection(payload) {
    const wrapper = document.createElement("div");
    wrapper.textContent = "Settings coming soon.";
    editorSettingsFields.appendChild(wrapper);
}

/* -----------------------------
   SEND UPDATE TO EDITABLE PREVIEW
----------------------------- */
function sendPreviewUpdate() {
    const editableFrame = document.getElementById("preview-frame-editable");
    if (!editableFrame) return;

    editableFrame.contentWindow.postMessage(
        {
            type: "ve-update-block",
            blockId: currentEditPayload.blockId,
            innerHTML: currentEditPayload.innerHTML
        },
        "*"
    );
}
