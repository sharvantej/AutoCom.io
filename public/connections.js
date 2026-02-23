document.addEventListener("DOMContentLoaded", () => {
  const connectionsPanel = document.getElementById("connections-panel");
  const connectionsView = document.getElementById("connections-view");
  const connectionsEdit = document.getElementById("connections-edit");

  const editButton = document.createElement("button");
  editButton.id = "edit-connections-btn";
  editButton.className = "button ui-btn btn-secondary btn-md";
  editButton.textContent = "Manage Connections";

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
    "http_api",
    "audio_mixer",
    "ross_carbonite",
    "ross_xpression",
    "generic_tcp",
  ];

  const protocols = ["osc", "tcp", "http", "https"];

  const defaultProtocolByType = {
    resolume: "osc",
    grandma3: "osc",
    vmix: "tcp",
    http_api: "http",
    audio_mixer: "osc",
    ross_carbonite: "tcp",
    ross_xpression: "tcp",
    generic_tcp: "tcp",
  };

  let currentConnections = {};

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

      item.innerHTML = `
        <div class="connection-main-left">
          <div class="connection-main-title-row">
            <span class="connection-main-title">${deviceName}</span>
            <span class="status-indicator unknown" data-indicator-for="${deviceName}" title="Status: unknown"></span>
          </div>
          <div class="connection-main-meta">
            <span class="connection-pill">${type}</span>
            <span class="connection-pill">${protocol}</span>
            <span class="connection-endpoint">${endpoint}</span>
          </div>
        </div>
        <div class="connection-main-right">
          <label class="switch-label">
            <span class="typography-muted">Active</span>
            <button class="switch ${enabled ? "checked" : ""}" type="button" role="switch" aria-checked="${enabled ? "true" : "false"}" data-toggle-device="${deviceName}">
              <span class="switch-thumb"></span>
            </button>
          </label>
        </div>
      `;
      wrapper.appendChild(item);
    }

    connectionsView.innerHTML = "";
    connectionsView.appendChild(wrapper);
    connectionsView.appendChild(editButton);
  }

  function createEditRow(deviceName = "", config = {}) {
    const type = config.type || "generic_tcp";
    const protocol = config.protocol || defaultProtocolByType[type] || "tcp";
    const path = config.path || "";
    const enabled = config.enabled !== false;

    const row = document.createElement("div");
    row.className = "connection-edit-item connection-edit-simple";
    row.innerHTML = `
      <div class="connection-edit-row row-main">
        <div class="field">
          <label class="field-label">Name</label>
          <input type="text" value="${deviceName}" class="device-name" placeholder="Name">
        </div>
        <div class="field">
          <label class="field-label">Host / IP</label>
          <input type="text" value="${config.host || ""}" class="device-host" placeholder="Host IP">
        </div>
        <div class="field">
          <label class="field-label">Port</label>
          <input type="number" value="${config.port || ""}" class="device-port" placeholder="Port">
        </div>
      </div>
      <div class="connection-edit-row row-conn">
        <div class="field">
          <label class="field-label">Type</label>
          <select class="device-type">${typeOptions(type)}</select>
        </div>
        <div class="field">
          <label class="field-label">Protocol</label>
          <select class="device-protocol">${protocolOptions(protocol)}</select>
        </div>
        <div class="field">
          <label class="field-label">Path (optional)</label>
          <input type="text" value="${path}" class="device-path" placeholder="/api">
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

  async function saveConnections() {
    const rows = connectionsEdit.querySelectorAll(".connection-edit-item");
    const payload = {};

    for (const row of rows) {
      const name = row.querySelector(".device-name").value.trim();
      const host = row.querySelector(".device-host").value.trim();
      const port = Number(row.querySelector(".device-port").value);
      const type = row.querySelector(".device-type").value;
      const protocol = row.querySelector(".device-protocol").value;
      const path = row.querySelector(".device-path").value.trim();
      const enabled = row.querySelector(".device-enabled").checked;

      if (!name && !host && !port) continue;
      if (!name || !host || !port) {
        alert(`Invalid row "${name || "(new)"}". Name, host and port are required.`);
        return;
      }
      if (payload[name]) {
        alert(`Duplicate connection name: "${name}"`);
        return;
      }

      payload[name] = { host, port, type, protocol, enabled };
      if (path) payload[name].path = path;
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

  editButton.addEventListener("click", switchToEditMode);
  saveButton.addEventListener("click", saveConnections);
  cancelButton.addEventListener("click", () => {
    buildEdit(currentConnections);
    switchToViewMode();
  });

  connectionsView.addEventListener("click", async (event) => {
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
    protocolSelect.value = defaultProtocolByType[type] || protocolSelect.value;
  });

  if (window.socket) {
    window.socket.on("deviceStatusUpdate", (statuses) => {
      const indicators = document.querySelectorAll(".status-indicator");
      indicators.forEach((indicator) => {
        indicator.className = "status-indicator unknown";
        indicator.title = "Status: unknown";
      });

      for (const [name, statusData] of Object.entries(statuses || {})) {
        const indicator = document.querySelector(
          `[data-indicator-for="${name}"]`,
        );
        if (!indicator) continue;
        indicator.className = `status-indicator ${statusData.status || "unknown"}`;
        indicator.title = `Status: ${statusData.status || "unknown"} (${statusData.protocol || "n/a"})`;
      }
    });
  }

  window.connectionsUi = {
    openEditor(addBlank = false) {
      switchToEditMode();
      if (addBlank) appendBlankConnectionRow();
    },
    promptDelete() {
      const names = Object.keys(currentConnections || {});
      if (!names.length) {
        alert("No connections available to delete.");
        return;
      }

      const list = names.map((name, idx) => `${idx + 1}. ${name}`).join("\n");
      const input = window.prompt(
        `Delete connection:\n${list}\n\nType number or name:`,
        "1",
      );
      if (!input || !String(input).trim()) return;

      const resolved = resolveConnectionName(input);
      if (!resolved) {
        alert("Connection not found. Please enter a valid number or exact name.");
        return;
      }

      const ok = window.confirm(`Delete connection "${resolved}"?`);
      if (!ok) return;

      removeConnectionByName(resolved).catch((err) => {
        console.error("Failed to delete connection:", err);
        alert("Failed to delete connection.");
      });
    },
  };

  loadConnections();
});

