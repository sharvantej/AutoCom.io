document.addEventListener("DOMContentLoaded", () => {
  const connectionsPanel = document.getElementById("connections-panel");
  const connectionsView = document.getElementById("connections-view");
  const connectionsEdit = document.getElementById("connections-edit");

  const saveButton = document.createElement("button");
  saveButton.id = "save-connections-btn";
  saveButton.className = "button ui-btn btn-primary btn-md";
  saveButton.innerHTML = '<span class="btn-icon-leading" aria-hidden="true">&#10003;</span>Save';

  const cancelButton = document.createElement("button");
  cancelButton.id = "cancel-connections-btn";
  cancelButton.className = "button ui-btn btn-secondary btn-md";
  cancelButton.textContent = "Cancel";

  const deviceTypes = [
    "resolume",
    "grandma3",
    "vmix",
    "atem",
    "videohub",
    "swp08",
    "obs",
    "x32",
    "companion_remote",
    "http_api",
    "audio_mixer",
    "ross_talk",
    "ross_carbonite",
    "ross_xpression",
    "generic_osc",
    "generic_udp",
    "generic_tcp",
  ];

  const protocols = ["osc", "udp", "tcp", "http", "https", "ws", "wss"];

  const defaultProtocolByType = {
    resolume: "osc",
    grandma3: "osc",
    vmix: "tcp",
    atem: "udp",
    videohub: "tcp",
    swp08: "tcp",
    obs: "ws",
    x32: "osc",
    companion_remote: "tcp",
    http_api: "http",
    audio_mixer: "osc",
    ross_talk: "tcp",
    ross_carbonite: "tcp",
    ross_xpression: "tcp",
    generic_osc: "osc",
    generic_udp: "udp",
    generic_tcp: "tcp",
  };

  const HTML_ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function escapeSelector(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(String(value ?? ""));
    }
    return String(value ?? "").replace(/["\\]/g, "\\$&");
  }

  let currentConnections = {};
  let manageMode = false;
  let editorContext = { mode: "none", selectedName: "" };

  const defaultFieldUi = {
    title: "Connection configuration",
    labels: {
      name: "Name",
      host: "Host / IP",
      port: "Port",
      type: "Type",
      protocol: "Protocol",
      path: "Path (optional)",
      oscPrefix: "OSC Prefix (optional)",
      password: "Password (optional)",
    },
    placeholders: {
      name: "Name",
      host: "Host IP",
      port: "Port",
      path: "/api",
      oscPrefix: "/cmd",
      password: "Password",
    },
    hiddenFields: [],
    lockedProtocol: "",
  };

  const typeFieldUi = {
    grandma3: {
      title: "GrandMA3 configuration",
      labels: {
        name: "Label",
        host: "Console IP",
        port: "Console OSC Port",
        oscPrefix: "Console OSC Prefix",
      },
      placeholders: {
        name: "GrandMA3",
        host: "127.0.0.1",
        port: "8000",
        oscPrefix: "/cmd",
      },
      hiddenFields: ["path", "password"],
      lockedProtocol: "osc",
    },
    resolume: {
      title: "Resolume configuration",
      labels: {
        host: "Server IP",
        port: "Server OSC Port",
      },
      placeholders: {
        host: "127.0.0.1",
        port: "7000",
      },
      hiddenFields: ["path", "oscPrefix", "password"],
      lockedProtocol: "osc",
    },
    obs: {
      title: "OBS WebSocket configuration",
      labels: {
        host: "Server IP",
        port: "Server Port",
        password: "Server Password",
      },
      placeholders: {
        host: "127.0.0.1",
        port: "4455",
        password: "Server Password",
      },
      hiddenFields: ["path", "oscPrefix"],
      lockedProtocol: "ws",
    },
    companion_remote: {
      title: "Companion remote configuration",
      labels: {
        host: "Companion IP",
        port: "Control Port",
        path: "HTTP Path (optional)",
      },
      placeholders: {
        host: "127.0.0.1",
        port: "16622",
        path: "/api/location/1/1/1/press",
      },
      hiddenFields: ["oscPrefix", "password"],
    },
    atem: {
      title: "ATEM configuration",
      labels: {
        host: "Switcher IP",
        port: "Control Port",
      },
      placeholders: {
        host: "127.0.0.1",
        port: "9993",
      },
      hiddenFields: ["path", "oscPrefix", "password"],
      lockedProtocol: "udp",
    },
    videohub: {
      title: "BMD Videohub configuration",
      labels: {
        host: "Router IP",
        port: "Control Port",
      },
      placeholders: {
        host: "127.0.0.1",
        port: "9990",
      },
      hiddenFields: ["path", "oscPrefix", "password"],
      lockedProtocol: "tcp",
    },
    swp08: {
      title: "SWP-08 configuration",
      labels: {
        host: "Switcher IP",
        port: "Control Port",
      },
      placeholders: {
        host: "127.0.0.1",
        port: "9000",
      },
      hiddenFields: ["path", "oscPrefix", "password"],
      lockedProtocol: "tcp",
    },
    ross_talk: {
      title: "RossTalk configuration",
      labels: {
        host: "Switcher IP",
        port: "RossTalk Port",
      },
      placeholders: {
        host: "127.0.0.1",
        port: "7788",
      },
      hiddenFields: ["path", "oscPrefix", "password"],
      lockedProtocol: "tcp",
    },
    generic_osc: {
      title: "Generic OSC configuration",
      labels: {
        host: "Target IP",
        port: "OSC Port",
      },
      placeholders: {
        host: "127.0.0.1",
        port: "8000",
      },
      hiddenFields: ["path", "password"],
      lockedProtocol: "osc",
    },
    generic_udp: {
      title: "Generic UDP configuration",
      labels: {
        host: "Target IP",
        port: "UDP Port",
      },
      placeholders: {
        host: "127.0.0.1",
        port: "16622",
      },
      hiddenFields: ["path", "oscPrefix", "password"],
      lockedProtocol: "udp",
    },
    x32: {
      title: "Behringer X32 configuration",
      labels: {
        host: "Console IP",
        port: "OSC Port",
      },
      placeholders: {
        host: "127.0.0.1",
        port: "10023",
      },
      hiddenFields: ["path", "oscPrefix", "password"],
      lockedProtocol: "osc",
    },
  };

  function mergeFieldUi(type) {
    const config = typeFieldUi[type] || {};
    return {
      title: config.title || defaultFieldUi.title,
      labels: { ...defaultFieldUi.labels, ...(config.labels || {}) },
      placeholders: {
        ...defaultFieldUi.placeholders,
        ...(config.placeholders || {}),
      },
      hiddenFields: Array.isArray(config.hiddenFields) ? config.hiddenFields : [],
      lockedProtocol: config.lockedProtocol || "",
    };
  }

  function applyTypeUi(row, type) {
    if (!row) return;
    const ui = mergeFieldUi(type);

    const title = row.querySelector(".connection-config-title");
    if (title) title.textContent = ui.title;

    const map = [
      ["name", ".device-name-label", ".device-name"],
      ["host", ".device-host-label", ".device-host"],
      ["port", ".device-port-label", ".device-port"],
      ["type", ".device-type-label", ".device-type"],
      ["protocol", ".device-protocol-label", ".device-protocol"],
      ["path", ".device-path-label", ".device-path"],
      ["oscPrefix", ".device-osc-prefix-label", ".device-osc-prefix"],
      ["password", ".device-password-label", ".device-password"],
    ];

    map.forEach(([key, labelSelector, inputSelector]) => {
      const labelEl = row.querySelector(labelSelector);
      const inputEl = row.querySelector(inputSelector);
      const fieldEl = row.querySelector(`.field-${key}`);

      if (labelEl) labelEl.textContent = ui.labels[key] || defaultFieldUi.labels[key];
      if (inputEl && ui.placeholders[key]) inputEl.placeholder = ui.placeholders[key];
      if (fieldEl) {
        fieldEl.classList.toggle("is-hidden", ui.hiddenFields.includes(key));
      }
    });

    const protocolSelect = row.querySelector(".device-protocol");
    const protocolHint = row.querySelector(".protocol-lock-hint");
    if (protocolSelect) {
      if (ui.lockedProtocol) {
        protocolSelect.value = ui.lockedProtocol;
        protocolSelect.disabled = true;
        if (protocolHint) {
          protocolHint.textContent = `Locked for ${type}`;
          protocolHint.classList.remove("is-hidden");
        }
      } else {
        protocolSelect.disabled = false;
        if (protocolHint) {
          protocolHint.textContent = "";
          protocolHint.classList.add("is-hidden");
        }
      }
    }
  }

  function switchToEditMode() {
    connectionsView.style.display = "none";
    connectionsEdit.style.display = "block";
    connectionsPanel.classList.add("connections-editing");
  }

  function appendBlankConnectionRow() {
    const grid = document.getElementById("connections-edit-grid");
    if (!grid) return;
    grid.appendChild(createEditRow());
  }

  async function removeConnectionByName(name) {
    if (!name || !currentConnections[name]) {
      alert(`Connection "${name || ""}" not found.`);
      return;
    }
    const next = { ...currentConnections };
    delete next[name];
    await persistConnections(next);
    currentConnections = next;
    await loadConnections();
    switchToViewMode();
  }

  function resolveConnectionName(input) {
    const names = Object.keys(currentConnections || {});
    if (!names.length) return "";
    const raw = String(input || "").trim();
    if (!raw) return "";

    const asIndex = Number(raw);
    if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= names.length) {
      return names[asIndex - 1];
    }

    const exact = names.find((name) => name === raw);
    if (exact) return exact;

    const ci = names.find((name) => name.toLowerCase() === raw.toLowerCase());
    return ci || "";
  }

  function switchToViewMode() {
    connectionsView.style.display = "block";
    connectionsEdit.style.display = "none";
    connectionsPanel.classList.remove("connections-editing");
    manageMode = false;
    buildView(currentConnections);
    editorContext = { mode: "none", selectedName: "" };
  }

  function openAddEditorMode() {
    manageMode = false;
    editorContext = { mode: "add", selectedName: "" };
    buildEdit({});
    switchToEditMode();
    appendBlankConnectionRow();
  }

  function openManageEditorByName(name) {
    const resolved = resolveConnectionName(name);
    if (!resolved || !currentConnections[resolved]) {
      alert(`Connection "${name || ""}" not found.`);
      return;
    }

    editorContext = { mode: "manage", selectedName: resolved };
    buildEdit({ [resolved]: currentConnections[resolved] });
    switchToEditMode();
  }

  function setManageMode(enabled) {
    manageMode = !!enabled;
    if (connectionsEdit.style.display === "block") return;
    buildView(currentConnections);
  }

  function typeOptions(selectedType) {
    return deviceTypes
      .map(
        (type) =>
          `<option value="${type}" ${type === selectedType ? "selected" : ""}>${type}</option>`,
      )
      .join("");
  }

  function protocolOptions(selectedProtocol) {
    return protocols
      .map(
        (protocol) =>
          `<option value="${protocol}" ${protocol === selectedProtocol ? "selected" : ""}>${protocol}</option>`,
      )
      .join("");
  }

  function buildView(connections) {
    const wrapper = document.createElement("div");

    for (const [deviceName, config] of Object.entries(connections)) {
      const item = document.createElement("div");
      item.className = "connection-item connection-item-main";

      const enabled = config.enabled !== false;
      const type = config.type || "generic_tcp";
      const protocol = config.protocol || defaultProtocolByType[type] || "tcp";
      const endpoint = `${config.host || "-"}:${config.port || "-"}`;
      const deviceLabel = escapeHtml(deviceName);
      const deviceAttr = escapeAttr(deviceName);
      const typeLabel = escapeHtml(type);
      const protocolLabel = escapeHtml(protocol);
      const endpointLabel = escapeHtml(endpoint);

      item.innerHTML = `
        <div class="connection-main-left">
          <div class="connection-main-title-row">
            <span class="connection-main-title">${deviceLabel}</span>
            <span class="status-indicator unknown" data-indicator-for="${deviceAttr}" title="Status: unknown"></span>
          </div>
          <div class="connection-main-meta">
            <span class="connection-pill">${typeLabel}</span>
            <span class="connection-pill">${protocolLabel}</span>
            <span class="connection-endpoint">${endpointLabel}</span>
          </div>
        </div>
        <div class="connection-main-right ${manageMode ? "manage-mode" : ""}">
          <label class="switch-label">
            <span class="typography-muted">Active</span>
            <button class="switch ${enabled ? "checked" : ""}" type="button" role="switch" aria-checked="${enabled ? "true" : "false"}" data-toggle-device="${deviceAttr}">
              <span class="switch-thumb"></span>
            </button>
          </label>
          ${
            manageMode
              ? `<button class="connection-manage-btn ui-btn btn-secondary btn-md" type="button" data-edit-device="${deviceAttr}">Edit</button>`
              : ""
          }
        </div>
      `;
      wrapper.appendChild(item);
    }

    connectionsView.innerHTML = "";
    connectionsView.appendChild(wrapper);
  }

  function createEditRow(deviceName = "", config = {}) {
    const type = config.type || "generic_tcp";
    const protocol = config.protocol || defaultProtocolByType[type] || "tcp";
    const path = config.path || "";
    const oscPrefix = config.oscPrefix || "";
    const enabled = config.enabled !== false;
    const safeName = escapeAttr(deviceName);
    const safeHost = escapeAttr(config.host || "");
    const safePort = escapeAttr(config.port || "");
    const safePath = escapeAttr(path);
    const safeOscPrefix = escapeAttr(oscPrefix);
    const safePassword = escapeAttr(config.password || "");

    const row = document.createElement("div");
    row.className = "connection-edit-item connection-edit-simple";
    row.innerHTML = `
      <div class="connection-config-title">Connection configuration</div>
      <div class="connection-edit-row row-main">
        <div class="field field-name">
          <label class="field-label device-name-label">Name</label>
          <input type="text" value="${safeName}" class="device-name" placeholder="Name">
        </div>
        <div class="field field-host">
          <label class="field-label device-host-label">Host / IP</label>
          <input type="text" value="${safeHost}" class="device-host" placeholder="Host IP">
        </div>
        <div class="field field-port">
          <label class="field-label device-port-label">Port</label>
          <input type="number" value="${safePort}" class="device-port" placeholder="Port">
        </div>
      </div>
      <div class="connection-edit-row row-conn">
        <div class="field field-type">
          <label class="field-label device-type-label">Type</label>
          <select class="device-type">${typeOptions(type)}</select>
        </div>
        <div class="field field-protocol">
          <label class="field-label device-protocol-label">Protocol</label>
          <select class="device-protocol">${protocolOptions(protocol)}</select>
          <div class="typography-muted protocol-lock-hint is-hidden"></div>
        </div>
        <div class="field field-path">
          <label class="field-label device-path-label">Path (optional)</label>
          <input type="text" value="${safePath}" class="device-path" placeholder="/api">
        </div>
        <div class="field field-oscPrefix">
          <label class="field-label device-osc-prefix-label">OSC Prefix (optional)</label>
          <input type="text" value="${safeOscPrefix}" class="device-osc-prefix" placeholder="/cmd">
        </div>
        <div class="field field-password">
          <label class="field-label device-password-label">Password (optional)</label>
          <input type="password" value="${safePassword}" class="device-password" placeholder="Password">
        </div>
      </div>
      <div class="connection-edit-row row-extra">
        <label class="switch-label">
          <span class="typography-muted">Active</span>
          <button class="switch ${enabled ? "checked" : ""}" type="button" role="switch" aria-checked="${enabled ? "true" : "false"}">
            <span class="switch-thumb"></span>
          </button>
          <input type="checkbox" class="device-enabled" ${enabled ? "checked" : ""} hidden>
        </label>
        <button class="remove-connection-btn ui-btn btn-primary-destructive btn-md" type="button">Remove</button>
      </div>
    `;

    const switchBtn = row.querySelector(".switch");
    const switchInput = row.querySelector(".device-enabled");
    switchBtn.addEventListener("click", () => {
      switchInput.checked = !switchInput.checked;
      switchBtn.classList.toggle("checked", switchInput.checked);
      switchBtn.setAttribute("aria-checked", switchInput.checked ? "true" : "false");
    });

    applyTypeUi(row, type);

    return row;
  }

  function buildEdit(connections) {
    const list = document.createElement("div");
    list.id = "connections-edit-grid";

    for (const [deviceName, config] of Object.entries(connections)) {
      list.appendChild(createEditRow(deviceName, config));
    }

    connectionsEdit.innerHTML = '<h2 class="typography-h2">Edit Connections</h2>';
    connectionsEdit.appendChild(list);

    const actions = document.createElement("div");
    actions.className = "button-group";
    actions.setAttribute("role", "group");
    actions.setAttribute("aria-label", "Connection editor actions");
    actions.appendChild(cancelButton);
    const sep = document.createElement("span");
    sep.className = "button-group-separator";
    sep.setAttribute("aria-hidden", "true");
    actions.appendChild(sep);
    actions.appendChild(saveButton);

    connectionsEdit.appendChild(actions);
  }

  async function persistConnections(payload) {
    const res = await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  async function loadConnections() {
    try {
      const res = await fetch("/api/connections");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const connections = await res.json();
      currentConnections = connections;
      buildView(connections);
      buildEdit(connections);
    } catch (err) {
      console.error("Failed to load connections:", err);
    }
  }

  function collectDraftRows() {
    const rows = connectionsEdit.querySelectorAll(".connection-edit-item");
    const entries = [];
    const seenNames = new Set();

    for (const row of rows) {
      const name = row.querySelector(".device-name").value.trim();
      const host = row.querySelector(".device-host").value.trim();
      const port = Number(row.querySelector(".device-port").value);
      const type = row.querySelector(".device-type").value;
      const protocol = row.querySelector(".device-protocol").value;
      const path = row.querySelector(".device-path").value.trim();
      const oscPrefix = row.querySelector(".device-osc-prefix").value.trim();
      const password = row.querySelector(".device-password").value;
      const enabled = row.querySelector(".device-enabled").checked;

      if (!name && !host && !port) continue;
      if (!name || !host || !port) {
        throw new Error(
          `Invalid row "${name || "(new)"}". Name, host and port are required.`,
        );
      }

      const key = name.toLowerCase();
      if (seenNames.has(key)) {
        throw new Error(`Duplicate connection name in editor: "${name}"`);
      }
      seenNames.add(key);

      const conn = { host, port, type, protocol, enabled };
      if (path) conn.path = path;
      if (oscPrefix) conn.oscPrefix = oscPrefix;
      if (password) conn.password = password;
      entries.push({ name, conn });
    }

    return entries;
  }

  async function saveConnections() {
    let draftRows = [];
    try {
      draftRows = collectDraftRows();
    } catch (err) {
      alert(err.message || "Invalid connection row.");
      return;
    }

    let payload = { ...currentConnections };

    if (editorContext.mode === "add") {
      if (!draftRows.length) {
        alert("Please enter a new device before saving.");
        return;
      }

      for (const { name, conn } of draftRows) {
        const exists = Object.keys(payload).some(
          (key) => key.toLowerCase() === name.toLowerCase(),
        );
        if (exists) {
          alert(`Connection "${name}" already exists.`);
          return;
        }
        payload[name] = conn;
      }
    } else if (editorContext.mode === "manage") {
      const originalName = editorContext.selectedName;
      if (!originalName || !currentConnections[originalName]) {
        alert("Selected connection is no longer available.");
        await loadConnections();
        switchToViewMode();
        return;
      }

      delete payload[originalName];

      if (draftRows.length > 1) {
        alert("Manage Device supports editing one connection at a time.");
        return;
      }

      if (draftRows.length === 1) {
        const { name, conn } = draftRows[0];
        const exists = Object.keys(payload).some(
          (key) => key.toLowerCase() === name.toLowerCase(),
        );
        if (exists) {
          alert(`Connection "${name}" already exists.`);
          return;
        }
        payload[name] = conn;
      }
    } else {
      payload = {};
      for (const { name, conn } of draftRows) {
        payload[name] = conn;
      }
    }

    try {
      await persistConnections(payload);
      currentConnections = payload;
      await loadConnections();
      switchToViewMode();
    } catch (err) {
      console.error("Failed to save connections:", err);
      alert("Failed to save connections.");
    }
  }

  async function toggleConnectionActive(name, enabled) {
    if (!currentConnections[name]) return;
    const next = { ...currentConnections };
    next[name] = { ...next[name], enabled };
    try {
      await persistConnections(next);
      currentConnections = next;
      await loadConnections();
    } catch (err) {
      console.error("Failed to toggle connection:", err);
      alert("Failed to update device active state.");
      await loadConnections();
    }
  }

  saveButton.addEventListener("click", saveConnections);
  cancelButton.addEventListener("click", () => {
    switchToViewMode();
  });

  connectionsView.addEventListener("click", async (event) => {
    const editTarget = event.target.closest("[data-edit-device]");
    if (editTarget) {
      const name = editTarget.dataset.editDevice;
      openManageEditorByName(name);
      return;
    }

    const toggle = event.target.closest("[data-toggle-device]");
    if (!toggle) return;
    const name = toggle.dataset.toggleDevice;
    const enabled = toggle.getAttribute("aria-checked") !== "true";
    toggle.classList.toggle("checked", enabled);
    toggle.setAttribute("aria-checked", enabled ? "true" : "false");
    await toggleConnectionActive(name, enabled);
  });

  connectionsEdit.addEventListener("click", (event) => {
    if (event.target.classList.contains("remove-connection-btn")) {
      if (editorContext.mode === "manage" && editorContext.selectedName) {
        const name = editorContext.selectedName;
        const ok = window.confirm(`Delete connection "${name}"?`);
        if (!ok) return;
        removeConnectionByName(name).catch((err) => {
          console.error("Failed to delete connection:", err);
          alert("Failed to delete connection.");
        });
        return;
      }

      event.target.closest(".connection-edit-item")?.remove();
      return;
    }
  });

  connectionsEdit.addEventListener("change", (event) => {
    if (!event.target.classList.contains("device-type")) return;
    const row = event.target.closest(".connection-edit-item");
    if (!row) return;
    const type = event.target.value;
    const protocolSelect = row.querySelector(".device-protocol");
    if (!protocolSelect.disabled) {
      protocolSelect.value = defaultProtocolByType[type] || protocolSelect.value;
    }
    applyTypeUi(row, type);
  });

  if (window.socket) {
    window.socket.on("deviceStatusUpdate", (statuses) => {
      const indicators = document.querySelectorAll(".status-indicator");
      indicators.forEach((indicator) => {
        indicator.className = "status-indicator unknown";
        indicator.title = "Status: unknown";
      });

      for (const [name, statusData] of Object.entries(statuses || {})) {
        const selectorName = escapeSelector(name);
        const indicator = document.querySelector(
          `[data-indicator-for="${selectorName}"]`,
        );
        if (!indicator) continue;
        indicator.className = `status-indicator ${statusData.status || "unknown"}`;
        indicator.title = `Status: ${statusData.status || "unknown"} (${statusData.protocol || "n/a"})`;
      }
    });
  }

  window.connectionsUi = {
    openAddEditor() {
      openAddEditorMode();
    },
    promptManage() {
      setManageMode(!manageMode);
    },
    // Backward-compatible alias for older callers.
    openEditor(addBlank = false) {
      if (addBlank) {
        openAddEditorMode();
      } else {
        setManageMode(true);
      }
    },
    // Backward-compatible alias for older callers.
    promptDelete() {
      setManageMode(!manageMode);
    },
    toggleManageMode() {
      setManageMode(!manageMode);
    },
  };

  loadConnections();
});

