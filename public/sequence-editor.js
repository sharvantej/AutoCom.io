(function () {
  let rowCounter = 0;
  const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

  function nextId(prefix) {
    rowCounter += 1;
    return `${prefix}_${Date.now()}_${rowCounter}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function pathKey(path) {
    return path.join(".");
  }

  function parsePathKey(key) {
    if (!key) return null;
    return key.split(".").map((item) => Number(item));
  }

  function samePath(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  const PRESETS = [
    {
      id: "resolume_clip_1",
      label: "Resolume: Clip L1 C1",
      build(editor) {
        return editor.createTaskRowByType("resolume", "clip", {
          layer: 1,
          clip: 1,
        });
      },
    },
    {
      id: "resolume_clip_2",
      label: "Resolume: Clip L1 C2",
      build(editor) {
        return editor.createTaskRowByType("resolume", "clip", {
          layer: 1,
          clip: 2,
        });
      },
    },
    {
      id: "grandma3_go_1",
      label: "grandMA3: Go+ Cue 1",
      build(editor) {
        return editor.createTaskRowByType("grandma3", "command", {
          command: "Go+ Cue 1",
        });
      },
    },
    {
      id: "grandma3_go_2",
      label: "grandMA3: Go+ Cue 2",
      build(editor) {
        return editor.createTaskRowByType("grandma3", "command", {
          command: "Go+ Cue 2",
        });
      },
    },
    {
      id: "vmix_cut",
      label: "vMix: FUNCTION CutDirect",
      build(editor) {
        return editor.createTaskRowByType("vmix", "command", {
          command: "FUNCTION CutDirect",
        });
      },
    },
    {
      id: "vmix_fade",
      label: "vMix: FUNCTION Fade",
      build(editor) {
        return editor.createTaskRowByType("vmix", "command", {
          command: "FUNCTION Fade",
        });
      },
    },
    {
      id: "http_get",
      label: "HTTP: GET /",
      build(editor) {
        return editor.createTaskRowByProtocol("http", "http", {
          method: "GET",
          path: "/",
          bodyText: "",
        });
      },
    },
    {
      id: "http_post",
      label: "HTTP: POST /api/trigger",
      build(editor) {
        return editor.createTaskRowByProtocol("http", "http", {
          method: "POST",
          path: "/api/trigger",
          bodyText: "{\"value\":1}",
        });
      },
    },
    {
      id: "tcp_plain",
      label: "TCP: PLAIN_COMMAND",
      build(editor) {
        return editor.createTaskRowByType("generic_tcp", "command", {
          command: "PLAIN_COMMAND",
        });
      },
    },
  ];

  class SequenceEditor {
    constructor() {
      this.modal = document.getElementById("sequenceEditorModal");
      if (!this.modal) return;

      this.elements = {
        label: document.getElementById("seq-button-label"),
        color: document.getElementById("seq-button-color"),
        x: document.getElementById("seq-button-x"),
        y: document.getElementById("seq-button-y"),
        w: document.getElementById("seq-button-w"),
        h: document.getElementById("seq-button-h"),
        fontSize: document.getElementById("seq-button-font-size"),
        preset: document.getElementById("seq-preset-select"),
        insertPreset: document.getElementById("seq-insert-preset-btn"),
        addTaskRoot: document.getElementById("seq-add-task-root-btn"),
        addDelayRoot: document.getElementById("seq-add-delay-root-btn"),
        addParallelRoot: document.getElementById("seq-add-parallel-root-btn"),
        rows: document.getElementById("seq-rows"),
        form: document.getElementById("seq-form"),
        errors: document.getElementById("seq-errors"),
        apply: document.getElementById("seq-apply-btn"),
        applyClose: document.getElementById("seq-apply-close-btn"),
        cancel: document.getElementById("seq-cancel-btn"),
        deleteButton: document.getElementById("seq-delete-btn"),
      };

      this.button = null;
      this.connections = {};
      this.rows = [];
      this.selectedPath = null;
      this.errors = {};
      this.drag = null;
      this.onApply = null;
      this.onDelete = null;
      this.label = "";
      this.color = "#2ecc71";
      this.x = 0;
      this.y = 0;
      this.w = 160;
      this.h = 80;
      this.fontSize = 20;

      this.bind();
      this.loadPresetOptions();
    }

    bind() {
      this.modal.addEventListener("click", (event) => {
        if (event.target.matches("[data-seq-close='true']")) {
          this.close();
        }
      });

      this.elements.cancel.addEventListener("click", () => this.close());
      this.elements.apply.addEventListener("click", () => this.apply(false));
      this.elements.applyClose.addEventListener("click", () => this.apply(true));
      this.elements.deleteButton.addEventListener("click", () => {
        if (!this.button) return;
        if (window.confirm(`Delete button "${this.label}"?`)) {
          this.onDelete?.(this.button);
          this.close();
        }
      });

      this.elements.addTaskRoot.addEventListener("click", () => {
        this.insertRow([], this.createTaskRowByType("generic_tcp", "command", { command: "" }));
      });
      this.elements.addDelayRoot.addEventListener("click", () => {
        this.insertRow([], this.createDelayRow(300));
      });
      this.elements.addParallelRoot.addEventListener("click", () => {
        this.insertRow([], this.createParallelRow());
      });

      this.elements.insertPreset.addEventListener("click", () => {
        const presetId = this.elements.preset.value;
        const preset = PRESETS.find((item) => item.id === presetId);
        if (!preset) return;
        this.insertRow([], preset.build(this));
      });

      this.elements.label.addEventListener("input", () => {
        this.label = this.elements.label.value;
      });
      this.elements.color.addEventListener("input", () => {
        this.color = this.elements.color.value;
      });
      this.elements.x.addEventListener("input", () => {
        this.x = Math.max(0, Number(this.elements.x.value || 0));
      });
      this.elements.y.addEventListener("input", () => {
        this.y = Math.max(0, Number(this.elements.y.value || 0));
      });
      this.elements.w.addEventListener("input", () => {
        this.w = Math.max(60, Number(this.elements.w.value || 160));
      });
      this.elements.h.addEventListener("input", () => {
        this.h = Math.max(40, Number(this.elements.h.value || 80));
      });
      this.elements.fontSize.addEventListener("input", () => {
        this.fontSize = Math.max(8, Number(this.elements.fontSize.value || 20));
      });
    }

    loadPresetOptions() {
      this.elements.preset.innerHTML = PRESETS.map(
        (preset) => `<option value="${preset.id}">${preset.label}</option>`,
      ).join("");
    }

    open({ button, connections, onApply, onDelete }) {
      this.button = button;
      this.connections = connections || {};
      this.onApply = onApply;
      this.onDelete = onDelete;
      this.errors = {};
      this.drag = null;

      this.label = button.label || "Button";
      this.color = button.color || "#2ecc71";
      this.x = Math.max(0, Number(button.x || 0));
      this.y = Math.max(0, Number(button.y || 0));
      this.w = Math.max(60, Number(button.w || 160));
      this.h = Math.max(40, Number(button.h || 80));
      this.fontSize = Math.max(8, Number(button.fontSize || 20));
      this.rows = this.normalizeRows(button.tasks || []);
      this.selectedPath = this.rows.length ? [0] : null;

      this.elements.label.value = this.label;
      this.elements.color.value = this.color;
      this.elements.x.value = String(this.x);
      this.elements.y.value = String(this.y);
      this.elements.w.value = String(this.w);
      this.elements.h.value = String(this.h);
      this.elements.fontSize.value = String(this.fontSize);

      this.modal.classList.remove("hidden");
      this.modal.setAttribute("aria-hidden", "false");
      this.refresh();
    }

    close() {
      this.modal.classList.add("hidden");
      this.modal.setAttribute("aria-hidden", "true");

      this.rows = [];
      this.selectedPath = null;
      this.errors = {};
      this.drag = null;
      this.button = null;

      this.elements.rows.innerHTML = "";
      this.elements.form.innerHTML = "";
      this.elements.errors.textContent = "";
    }

    connectionByName(name) {
      return this.connections[name] || null;
    }

    connectionType(name) {
      return this.connectionByName(name)?.type || "";
    }

    findConnectionByType(type) {
      return (
        Object.keys(this.connections).find(
          (name) =>
            String(this.connections[name]?.type || "").toLowerCase() ===
            String(type || "").toLowerCase(),
        ) || ""
      );
    }

    findConnectionByProtocol(protocol) {
      return (
        Object.keys(this.connections).find(
          (name) =>
            String(this.connections[name]?.protocol || "").toLowerCase() ===
            String(protocol || "").toLowerCase(),
        ) || ""
      );
    }

    defaultActionFor(connectionType, protocol) {
      const type = String(connectionType || "").toLowerCase();
      const proto = String(protocol || "").toLowerCase();

      if (type === "resolume") return "clip";
      if (["grandma3", "lighting", "vmix"].includes(type)) return "command";
      if (["audio", "audio_mixer"].includes(type)) return "track";
      if (["http", "https"].includes(proto) || type === "http_api") return "http";
      return "command";
    }

    ensureTaskDefaults(row) {
      if (!row.params || typeof row.params !== "object") {
        row.params = {};
      }

      if (!row.action) {
        const connection = this.connectionByName(row.device);
        row.action = this.defaultActionFor(row.deviceType, connection?.protocol);
      }

      if (row.action === "clip") {
        row.params.layer = Number.isFinite(Number(row.params.layer))
          ? Number(row.params.layer)
          : 1;
        row.params.clip = Number.isFinite(Number(row.params.clip))
          ? Number(row.params.clip)
          : 1;
        return;
      }

      if (row.action === "cue") {
        row.params.cue = row.params.cue ?? "1";
        return;
      }

      if (row.action === "track") {
        row.params.track = row.params.track ?? "";
        return;
      }

      if (row.action === "http") {
        row.params.method = String(row.params.method || "GET").toUpperCase();
        row.params.path = String(row.params.path || "/");
        row.params.bodyText = String(row.params.bodyText || "");
        return;
      }

      row.params.command = row.params.command ?? "";
    }

    createTaskRowByType(type, action, params) {
      const device = this.findConnectionByType(type);
      const row = {
        id: nextId("task"),
        kind: "task",
        enabled: true,
        device,
        deviceType: type || this.connectionType(device),
        action,
        params: clone(params || {}),
      };
      this.ensureTaskDefaults(row);
      return row;
    }

    createTaskRowByProtocol(protocol, action, params) {
      const device = this.findConnectionByProtocol(protocol);
      const row = {
        id: nextId("task"),
        kind: "task",
        enabled: true,
        device,
        deviceType: this.connectionType(device),
        action,
        params: clone(params || {}),
      };
      this.ensureTaskDefaults(row);
      return row;
    }

    createDelayRow(ms) {
      return {
        id: nextId("delay"),
        kind: "delay",
        enabled: true,
        ms: Number(ms || 0),
      };
    }

    createParallelRow() {
      return {
        id: nextId("parallel"),
        kind: "parallel",
        enabled: true,
        steps: [],
      };
    }

    normalizeRows(rows) {
      if (!Array.isArray(rows)) return [];
      return rows.map((row) => this.normalizeRow(row));
    }

    normalizeRow(row) {
      if (!row || typeof row !== "object") {
        return {
          id: nextId("invalid"),
          kind: "invalid",
          enabled: true,
          reason: "Row is not an object",
          raw: row,
        };
      }

      if (row.kind === "parallel") {
        return {
          id: row.id || nextId("parallel"),
          kind: "parallel",
          enabled: row.enabled !== false,
          steps: this.normalizeRows(row.steps || []),
        };
      }

      if (row.kind === "delay") {
        return {
          id: row.id || nextId("delay"),
          kind: "delay",
          enabled: row.enabled !== false,
          ms: Number(row.ms ?? row.delay ?? 0),
        };
      }

      if (row.kind === "task") {
        const normalized = {
          id: row.id || nextId("task"),
          kind: "task",
          enabled: row.enabled !== false,
          device: row.device || "",
          deviceType: row.deviceType || this.connectionType(row.device),
          action: String(row.action || "").toLowerCase(),
          params: clone(row.params || {}),
        };
        this.ensureTaskDefaults(normalized);
        return normalized;
      }

      if (row.type === "parallel" && Array.isArray(row.steps)) {
        return {
          id: row.id || nextId("parallel"),
          kind: "parallel",
          enabled: row.enabled !== false,
          steps: this.normalizeRows(row.steps),
        };
      }

      if (row.action === "delay" || row.type === "delay") {
        return {
          id: row.id || nextId("delay"),
          kind: "delay",
          enabled: row.enabled !== false,
          ms: Number(row.ms ?? row.delay ?? row.delayMs ?? 0),
        };
      }

      if (row.type === "resolume_clip") {
        return this.createTaskRowByType("resolume", "clip", {
          layer: Number(row.layer ?? 1),
          clip: Number(row.clip ?? 1),
        });
      }

      if (row.type === "lighting_cue") {
        return this.createTaskRowByType("grandma3", "cue", {
          cue: String(row.cue ?? "1"),
        });
      }

      if (row.type === "audio_track") {
        return this.createTaskRowByType("audio_mixer", "track", {
          track: String(row.track ?? ""),
        });
      }

      if (row.action) {
        const params = clone(row.params || {});
        Object.entries(row).forEach(([key, value]) => {
          if (
            [
              "id",
              "kind",
              "enabled",
              "device",
              "deviceName",
              "deviceType",
              "action",
              "params",
            ].includes(key)
          ) {
            return;
          }
          params[key] = value;
        });

        if (params.body && typeof params.body !== "string") {
          params.bodyText = JSON.stringify(params.body, null, 2);
          delete params.body;
        }

        const normalized = {
          id: row.id || nextId("task"),
          kind: "task",
          enabled: row.enabled !== false,
          device: row.device || row.deviceName || "",
          deviceType:
            row.deviceType || this.connectionType(row.device || row.deviceName),
          action: String(row.action || "").toLowerCase(),
          params,
        };
        this.ensureTaskDefaults(normalized);
        return normalized;
      }

      return {
        id: nextId("invalid"),
        kind: "invalid",
        enabled: row.enabled !== false,
        reason: "Unknown legacy row shape",
        raw: clone(row),
      };
    }

    getArrayAtPath(parentPath) {
      let rows = this.rows;
      for (const index of parentPath) {
        const row = rows[index];
        if (!row || row.kind !== "parallel") return null;
        rows = row.steps;
      }
      return rows;
    }

    getRow(path) {
      const parent = this.getArrayAtPath(path.slice(0, -1));
      if (!parent) return null;
      return parent[path[path.length - 1]] || null;
    }

    insertRow(parentPath, row, atIndex = null) {
      const parent = this.getArrayAtPath(parentPath);
      if (!parent) return;
      const index =
        atIndex == null
          ? parent.length
          : Math.max(0, Math.min(parent.length, atIndex));
      parent.splice(index, 0, row);
      this.selectedPath = [...parentPath, index];
      this.refresh();
    }

    removeRow(path) {
      const parent = this.getArrayAtPath(path.slice(0, -1));
      if (!parent) return;
      parent.splice(path[path.length - 1], 1);
      this.selectedPath = null;
      this.refresh();
    }

    assignNewIds(row) {
      row.id = nextId(row.kind || "row");
      if (row.kind === "parallel") {
        row.steps = (row.steps || []).map((item) => this.assignNewIds(item));
      }
      return row;
    }

    duplicateRow(path) {
      const parent = this.getArrayAtPath(path.slice(0, -1));
      if (!parent) return;
      const row = parent[path[path.length - 1]];
      if (!row) return;
      const copy = this.assignNewIds(clone(row));
      parent.splice(path[path.length - 1] + 1, 0, copy);
      this.selectedPath = [...path.slice(0, -1), path[path.length - 1] + 1];
      this.refresh();
    }

    moveRow(path, delta) {
      const parent = this.getArrayAtPath(path.slice(0, -1));
      if (!parent) return;
      const from = path[path.length - 1];
      const to = from + delta;
      if (to < 0 || to >= parent.length) return;
      const [item] = parent.splice(from, 1);
      parent.splice(to, 0, item);
      this.selectedPath = [...path.slice(0, -1), to];
      this.refresh();
    }

    reorderWithinParent(parentPath, fromIndex, toIndex) {
      const rows = this.getArrayAtPath(parentPath);
      if (!rows || fromIndex === toIndex) return;
      const [item] = rows.splice(fromIndex, 1);
      const targetIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
      rows.splice(targetIndex, 0, item);
      this.selectedPath = [...parentPath, targetIndex];
      this.refresh();
    }

    rowSummary(row) {
      if (row.kind === "delay") {
        return `Delay ${row.ms || 0}ms`;
      }
      if (row.kind === "parallel") {
        return `Parallel (${Array.isArray(row.steps) ? row.steps.length : 0} steps)`;
      }
      if (row.kind === "invalid") {
        return `Invalid: ${row.reason || "unsupported row"}`;
      }
      const device = row.device || "No Device";
      if (row.action === "clip") {
        return `${device} -> Clip L${row.params.layer ?? "?"} C${row.params.clip ?? "?"}`;
      }
      if (row.action === "cue") {
        return `${device} -> Cue ${row.params.cue || "?"}`;
      }
      if (row.action === "track") {
        return `${device} -> Track ${row.params.track || "?"}`;
      }
      if (row.action === "http") {
        return `${device} -> ${row.params.method || "GET"} ${row.params.path || "/"}`;
      }
      return `${device} -> ${row.params.command || row.action || "task"}`;
    }

    refresh() {
      this.renderRows();
      this.renderForm();
      this.elements.errors.textContent = Object.values(this.errors)[0] || "";
    }

    renderRows() {
      this.elements.rows.innerHTML = "";
      this.renderRowsRecursive(this.rows, [], this.elements.rows);
    }

    renderRowsRecursive(rows, parentPath, root) {
      rows.forEach((row, index) => {
        const path = [...parentPath, index];
        const key = pathKey(path);

        const container = document.createElement("div");
        container.className = "seq-row";
        if (samePath(this.selectedPath, path)) container.classList.add("selected");
        if (row.enabled === false) container.classList.add("disabled");
        if (this.errors[key]) container.classList.add("has-error");
        container.draggable = true;

        container.addEventListener("dragstart", (event) => {
          this.drag = {
            path: [...path],
            parentPath: [...parentPath],
          };
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", key);
        });
        container.addEventListener("dragover", (event) => {
          event.preventDefault();
        });
        container.addEventListener("drop", (event) => {
          event.preventDefault();
          if (!this.drag) return;
          if (!samePath(this.drag.parentPath, parentPath)) return;
          this.reorderWithinParent(
            parentPath,
            this.drag.path[this.drag.path.length - 1],
            index,
          );
          this.drag = null;
        });

        container.innerHTML = `<div class="seq-row-head"><span class="seq-drag">::</span><input type="checkbox" ${row.enabled !== false ? "checked" : ""} /><div class="seq-row-title"></div><div class="seq-row-actions"></div></div>`;

        const toggle = container.querySelector("input");
        const title = container.querySelector(".seq-row-title");
        const actions = container.querySelector(".seq-row-actions");

        title.textContent = this.rowSummary(row);
        title.onclick = () => {
          this.selectedPath = [...path];
          this.renderRows();
          this.renderForm();
        };

        toggle.onchange = () => {
          row.enabled = toggle.checked;
          this.refresh();
        };

        [
          ["UP", () => this.moveRow(path, -1)],
          ["DN", () => this.moveRow(path, 1)],
          ["DUP", () => this.duplicateRow(path)],
        ].forEach(([label, handler]) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = label;
          button.onclick = handler;
          actions.appendChild(button);
        });

        if (row.kind === "parallel") {
          [
            ["+T", () => this.insertRow(path, this.createTaskRowByType("generic_tcp", "command", { command: "" }))],
            ["+D", () => this.insertRow(path, this.createDelayRow(300))],
            ["+P", () => this.insertRow(path, this.createParallelRow())],
          ].forEach(([label, handler]) => {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = label;
            button.onclick = handler;
            actions.appendChild(button);
          });
        }

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "X";
        deleteButton.onclick = () => this.removeRow(path);
        actions.appendChild(deleteButton);

        if (row.kind === "parallel") {
          const children = document.createElement("div");
          children.className = "seq-children";
          this.renderRowsRecursive(row.steps || [], path, children);
          container.appendChild(children);
        }

        root.appendChild(container);
      });
    }

    allowedActions(row) {
      const connection = this.connectionByName(row.device);
      const type = String(row.deviceType || connection?.type || "").toLowerCase();
      const protocol = String(connection?.protocol || "").toLowerCase();

      if (type === "resolume") return ["clip"];
      if (["grandma3", "lighting"].includes(type)) return ["command", "cue"];
      if (type === "vmix") return ["command"];
      if (["audio", "audio_mixer"].includes(type)) return ["track"];
      if (["http", "https"].includes(protocol) || type === "http_api") return ["http"];
      return ["command", "http"];
    }

    renderForm() {
      this.elements.form.innerHTML = "";
      if (!this.selectedPath) {
        this.elements.form.innerHTML = "<p>Select a row to edit.</p>";
        return;
      }

      const row = this.getRow(this.selectedPath);
      if (!row) return;

      const key = pathKey(this.selectedPath);
      const wrapper = document.createElement("div");
      wrapper.className = "seq-form";
      wrapper.innerHTML = `<h3>Edit ${row.kind}</h3>`;
      if (this.errors[key]) {
        wrapper.innerHTML += `<div class="seq-inline-error">${this.errors[key]}</div>`;
      }

      if (row.kind === "invalid") {
        const message = document.createElement("p");
        message.textContent = row.reason || "Invalid row";
        wrapper.appendChild(message);

        const raw = document.createElement("textarea");
        raw.readOnly = true;
        raw.value = JSON.stringify(row.raw || {}, null, 2);
        wrapper.appendChild(raw);

        this.elements.form.appendChild(wrapper);
        return;
      }

      if (row.kind === "delay") {
        const field = document.createElement("div");
        field.className = "seq-form-row";
        field.innerHTML = "<label>Delay (ms)</label>";
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.value = Number(row.ms || 0);
        input.oninput = () => {
          row.ms = Number(input.value);
          this.renderRows();
        };
        field.appendChild(input);
        wrapper.appendChild(field);
        this.elements.form.appendChild(wrapper);
        return;
      }

      if (row.kind === "parallel") {
        wrapper.innerHTML += "<p>Parallel block executes nested rows simultaneously.</p>";

        const controls = document.createElement("div");
        controls.className = "seq-form-row two";
        controls.innerHTML = "<button type='button'>Add Task</button><button type='button'>Add Delay</button>";

        const addTaskBtn = controls.children[0];
        const addDelayBtn = controls.children[1];
        addTaskBtn.onclick = () => {
          this.insertRow(this.selectedPath, this.createTaskRowByType("generic_tcp", "command", { command: "" }));
        };
        addDelayBtn.onclick = () => {
          this.insertRow(this.selectedPath, this.createDelayRow(300));
        };
        wrapper.appendChild(controls);

        const addParallel = document.createElement("button");
        addParallel.type = "button";
        addParallel.textContent = "Add Nested Parallel";
        addParallel.onclick = () => {
          this.insertRow(this.selectedPath, this.createParallelRow());
        };
        wrapper.appendChild(addParallel);

        this.elements.form.appendChild(wrapper);
        return;
      }

      row.params = row.params || {};
      this.ensureTaskDefaults(row);

      const deviceField = document.createElement("div");
      deviceField.className = "seq-form-row";
      deviceField.innerHTML = "<label>Device</label>";
      const deviceSelect = document.createElement("select");
      const names = Object.keys(this.connections);
      deviceSelect.innerHTML = `<option value="">Select device</option>${names
        .map(
          (name) =>
            `<option value="${name}" ${name === row.device ? "selected" : ""}>${name}</option>`,
        )
        .join("")}`;
      deviceSelect.onchange = () => {
        row.device = deviceSelect.value;
        row.deviceType = this.connectionType(row.device);
        const actions = this.allowedActions(row);
        if (!actions.includes(row.action)) {
          row.action = actions[0];
        }
        row.params = {};
        this.ensureTaskDefaults(row);
        this.refresh();
      };
      deviceField.appendChild(deviceSelect);
      wrapper.appendChild(deviceField);

      const actionField = document.createElement("div");
      actionField.className = "seq-form-row";
      actionField.innerHTML = "<label>Action</label>";
      const actionSelect = document.createElement("select");
      const options = this.allowedActions(row);
      actionSelect.innerHTML = options
        .map(
          (action) =>
            `<option value="${action}" ${action === row.action ? "selected" : ""}>${action}</option>`,
        )
        .join("");
      actionSelect.onchange = () => {
        row.action = actionSelect.value;
        row.params = {};
        this.ensureTaskDefaults(row);
        this.refresh();
      };
      actionField.appendChild(actionSelect);
      wrapper.appendChild(actionField);

      if (row.action === "clip") {
        const fields = document.createElement("div");
        fields.className = "seq-form-row two";
        fields.innerHTML = "<label>Layer</label><label>Clip</label>";

        const layerInput = document.createElement("input");
        layerInput.type = "number";
        layerInput.value = Number(row.params.layer || 1);
        layerInput.oninput = () => {
          row.params.layer = Number(layerInput.value);
          this.renderRows();
        };

        const clipInput = document.createElement("input");
        clipInput.type = "number";
        clipInput.value = Number(row.params.clip || 1);
        clipInput.oninput = () => {
          row.params.clip = Number(clipInput.value);
          this.renderRows();
        };

        fields.appendChild(layerInput);
        fields.appendChild(clipInput);
        wrapper.appendChild(fields);
      } else if (row.action === "cue") {
        const field = document.createElement("div");
        field.className = "seq-form-row";
        field.innerHTML = "<label>Cue</label>";
        const input = document.createElement("input");
        input.value = row.params.cue || "";
        input.oninput = () => {
          row.params.cue = input.value;
          this.renderRows();
        };
        field.appendChild(input);
        wrapper.appendChild(field);
      } else if (row.action === "track") {
        const field = document.createElement("div");
        field.className = "seq-form-row";
        field.innerHTML = "<label>Track</label>";
        const input = document.createElement("input");
        input.value = row.params.track || "";
        input.oninput = () => {
          row.params.track = input.value;
          this.renderRows();
        };
        field.appendChild(input);
        wrapper.appendChild(field);
      } else if (row.action === "http") {
        const methodPath = document.createElement("div");
        methodPath.className = "seq-form-row two";
        methodPath.innerHTML = "<label>Method</label><label>Path</label>";

        const method = document.createElement("select");
        method.innerHTML = HTTP_METHODS.map(
          (item) =>
            `<option value="${item}" ${item === row.params.method ? "selected" : ""}>${item}</option>`,
        ).join("");
        method.onchange = () => {
          row.params.method = method.value;
          this.renderRows();
        };

        const pathInput = document.createElement("input");
        pathInput.value = row.params.path || "/";
        pathInput.oninput = () => {
          row.params.path = pathInput.value;
          this.renderRows();
        };

        methodPath.appendChild(method);
        methodPath.appendChild(pathInput);
        wrapper.appendChild(methodPath);

        const body = document.createElement("div");
        body.className = "seq-form-row";
        body.innerHTML = "<label>JSON Body (optional)</label>";
        const bodyText = document.createElement("textarea");
        bodyText.value = row.params.bodyText || "";
        bodyText.oninput = () => {
          row.params.bodyText = bodyText.value;
        };
        body.appendChild(bodyText);
        wrapper.appendChild(body);
      } else {
        const field = document.createElement("div");
        field.className = "seq-form-row";
        field.innerHTML = "<label>Command / Payload</label>";
        const input = document.createElement("input");
        input.value = row.params.command || "";
        input.oninput = () => {
          row.params.command = input.value;
          this.renderRows();
        };
        field.appendChild(input);
        wrapper.appendChild(field);
      }

      this.elements.form.appendChild(wrapper);
    }

    validateAll() {
      this.errors = {};
      this.validateRowsRecursive(this.rows, []);
      const first = Object.keys(this.errors)[0];
      if (first) {
        this.selectedPath = parsePathKey(first);
      }
      return !first;
    }

    validateRowsRecursive(rows, parentPath) {
      rows.forEach((row, index) => {
        const path = [...parentPath, index];
        const key = pathKey(path);

        if (row.kind === "invalid") {
          this.errors[key] = row.reason || "Invalid row";
          return;
        }

        if (row.kind === "delay") {
          if (!Number.isFinite(Number(row.ms)) || Number(row.ms) < 0) {
            this.errors[key] = "Delay must be >= 0";
          }
          return;
        }

        if (row.kind === "parallel") {
          if (!Array.isArray(row.steps) || !row.steps.length) {
            this.errors[key] = "Parallel block must contain at least one step";
          } else {
            this.validateRowsRecursive(row.steps, path);
          }
          return;
        }

        const connection = this.connectionByName(row.device);
        if (!row.device || !connection) {
          this.errors[key] = "Select a valid connection";
          return;
        }

        const type = String(row.deviceType || connection.type || "").toLowerCase();
        const protocol = String(connection.protocol || "").toLowerCase();
        const action = String(row.action || "").toLowerCase();
        const params = row.params || {};

        if (type === "resolume" || action === "clip") {
          if (
            !Number.isFinite(Number(params.layer)) ||
            !Number.isFinite(Number(params.clip))
          ) {
            this.errors[key] = "Resolume task requires numeric layer and clip";
          }
          return;
        }

        if (["grandma3", "lighting"].includes(type)) {
          if (action === "cue" && !String(params.cue || "").trim()) {
            this.errors[key] = "Cue is required";
          } else if (action !== "cue" && !String(params.command || "").trim()) {
            this.errors[key] = "Command is required";
          }
          return;
        }

        if (type === "vmix") {
          if (!String(params.command || "").trim()) {
            this.errors[key] = "vMix command is required";
          }
          return;
        }

        if (["audio", "audio_mixer"].includes(type)) {
          if (!String(params.track || "").trim()) {
            this.errors[key] = "Audio track is required";
          }
          return;
        }

        if (
          protocol === "http" ||
          protocol === "https" ||
          type === "http_api" ||
          action === "http"
        ) {
          const method = String(params.method || "").toUpperCase();
          if (!HTTP_METHODS.includes(method)) {
            this.errors[key] = "Invalid HTTP method";
            return;
          }
          if (!String(params.path || "").trim()) {
            this.errors[key] = "HTTP path is required";
            return;
          }
          if (String(params.bodyText || "").trim()) {
            try {
              JSON.parse(params.bodyText);
            } catch {
              this.errors[key] = "HTTP body must be valid JSON";
            }
          }
          return;
        }

        if (!String(params.command || "").trim()) {
          this.errors[key] = "Command / payload is required";
        }
      });
    }

    serializeRows(rows) {
      return rows.map((row) => this.serializeRow(row));
    }

    serializeRow(row) {
      if (row.kind === "delay") {
        return {
          id: row.id || nextId("delay"),
          kind: "delay",
          enabled: row.enabled !== false,
          ms: Number(row.ms || 0),
        };
      }

      if (row.kind === "parallel") {
        return {
          id: row.id || nextId("parallel"),
          kind: "parallel",
          enabled: row.enabled !== false,
          steps: this.serializeRows(row.steps || []),
        };
      }

      if (row.kind !== "task") {
        throw new Error("Cannot serialize invalid row");
      }

      const params = clone(row.params || {});
      if (row.action === "http") {
        params.method = String(params.method || "GET").toUpperCase();
        params.path = String(params.path || "/");
        const bodyText = String(params.bodyText || "").trim();
        delete params.bodyText;
        if (bodyText) {
          params.body = JSON.parse(bodyText);
        }
      }

      return {
        id: row.id || nextId("task"),
        kind: "task",
        enabled: row.enabled !== false,
        device: row.device || "",
        deviceType: row.deviceType || this.connectionType(row.device),
        action: row.action,
        params,
      };
    }

    apply(closeAfterApply) {
      if (!this.validateAll()) {
        this.refresh();
        return;
      }

      let tasks = [];
      try {
        tasks = this.serializeRows(this.rows);
      } catch (err) {
        this.elements.errors.textContent = err.message;
        return;
      }

      this.onApply?.({
        label: this.label || "Button",
        color: this.color || "#2ecc71",
        x: Math.max(0, Number(this.x || 0)),
        y: Math.max(0, Number(this.y || 0)),
        w: Math.max(60, Number(this.w || 160)),
        h: Math.max(40, Number(this.h || 80)),
        fontSize: Math.max(8, Number(this.fontSize || 20)),
        tasks,
      });
      if (closeAfterApply) {
        this.close();
      }
    }
  }

  window.SequenceEditor = SequenceEditor;
})();
