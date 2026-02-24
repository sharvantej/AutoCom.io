(function () {
  let rowCounter = 0;
  const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  const LINE_END_OPTIONS = [
    { value: "crlf", label: "CRLF (\\r\\n)" },
    { value: "lf", label: "LF (\\n)" },
    { value: "cr", label: "CR (\\r)" },
    { value: "none", label: "None" },
  ];
  const DEFAULT_BUTTON_COLOR = "#12151b";
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

  function defaultResolumeCommand(target = "clip") {
    return target === "column"
      ? "/composition/columns/1/connect"
      : "composition/layers/1/clips/1/connect";
  }

  function parseVmixCommand(commandText) {
    const raw = String(commandText || "").trim();
    if (!raw) return null;
    const match = raw.match(/^FUNCTION\s+([^\s]+)(?:\s+(.+))?$/i);
    if (!match) return null;

    const functionName = String(match[1] || "").trim();
    const query = String(match[2] || "").trim();
    const args = {};
    if (query) {
      for (const pair of query.split("&")) {
        if (!pair) continue;
        const [rawKey, ...rest] = pair.split("=");
        const key = decodeURIComponent(String(rawKey || "").trim());
        if (!key) continue;
        const value = decodeURIComponent(rest.join("="));
        args[key] = value;
      }
    }
    return {
      functionName,
      args,
      query,
    };
  }

  function buildVmixCommand(functionName, args = {}) {
    const fn = String(functionName || "").trim();
    if (!fn) return "";

    const query = Object.entries(args || {})
      .map(([key, value]) => [String(key || "").trim(), String(value ?? "").trim()])
      .filter(([key, value]) => key && value)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");

    return query ? `FUNCTION ${fn} ${query}` : `FUNCTION ${fn}`;
  }

  const ROSSTALK_PRESETS = [
    { id: "none", label: "None", command: "", fields: [] },
    {
      id: "seq_take_layer",
      label: "SEQ [take ID]:[layer ID]",
      command: "SEQ {takeId}:{layerId}",
      fields: [
        { key: "takeId", label: "take ID", placeholder: "1" },
        { key: "layerId", label: "layer ID", placeholder: "1" },
      ],
    },
    {
      id: "take_take_buffer_layer",
      label: "TAKE [take ID]:[buffer ID]:[layer ID]",
      command: "TAKE {takeId}:{bufferId}:{layerId}",
      fields: [
        { key: "takeId", label: "take ID", placeholder: "1" },
        { key: "bufferId", label: "buffer ID", placeholder: "1" },
        { key: "layerId", label: "layer ID", placeholder: "1" },
      ],
    },
    {
      id: "seqo_take",
      label: "SEQO [take ID]",
      command: "SEQO {takeId}",
      fields: [{ key: "takeId", label: "take ID", placeholder: "1" }],
    },
    {
      id: "clfb_buffer",
      label: "CLFB [buffer ID]",
      command: "CLFB {bufferId}",
      fields: [{ key: "bufferId", label: "buffer ID", placeholder: "1" }],
    },
    {
      id: "clfb_buffer_layer",
      label: "CLFB [buffer ID]:[layer ID]",
      command: "CLFB {bufferId}:{layerId}",
      fields: [
        { key: "bufferId", label: "buffer ID", placeholder: "1" },
        { key: "layerId", label: "layer ID", placeholder: "1" },
      ],
    },
    {
      id: "resume_buffer",
      label: "RESUME [buffer ID]",
      command: "RESUME {bufferId}",
      fields: [{ key: "bufferId", label: "buffer ID", placeholder: "1" }],
    },
    {
      id: "resume_buffer_layer",
      label: "RESUME [buffer ID]:[layer ID]",
      command: "RESUME {bufferId}:{layerId}",
      fields: [
        { key: "bufferId", label: "buffer ID", placeholder: "1" },
        { key: "layerId", label: "layer ID", placeholder: "1" },
      ],
    },
    { id: "clra", label: "CLRA", command: "CLRA", fields: [] },
    { id: "read", label: "READ", command: "READ", fields: [] },
    { id: "next", label: "NEXT", command: "NEXT", fields: [] },
    { id: "up", label: "UP", command: "UP", fields: [] },
    { id: "down", label: "DOWN", command: "DOWN", fields: [] },
    {
      id: "focus_take",
      label: "FOCUS [take ID]",
      command: "FOCUS {takeId}",
      fields: [{ key: "takeId", label: "take ID", placeholder: "1" }],
    },
    {
      id: "cc_bcc",
      label: "CC [bcc]",
      command: "CC {bcc}",
      fields: [{ key: "bcc", label: "bcc", placeholder: "1:1" }],
    },
    {
      id: "mem_bm",
      label: "MEM [bm]",
      command: "MEM {bm}",
      fields: [{ key: "bm", label: "bm", placeholder: "1" }],
    },
    {
      id: "keycut",
      label: "KEYCUT [MLE]:[keyer]",
      command: "KEYCUT {mle}:{keyer}",
      fields: [
        { key: "mle", label: "MLE", placeholder: "1" },
        { key: "keyer", label: "keyer", placeholder: "1" },
      ],
    },
    {
      id: "keyauto",
      label: "KEYAUTO [MLE]:[keyer]",
      command: "KEYAUTO {mle}:{keyer}",
      fields: [
        { key: "mle", label: "MLE", placeholder: "1" },
        { key: "keyer", label: "keyer", placeholder: "1" },
      ],
    },
    {
      id: "mlecut",
      label: "MLECUT [MLE]",
      command: "MLECUT {mle}",
      fields: [{ key: "mle", label: "MLE", placeholder: "1" }],
    },
    {
      id: "mleauto",
      label: "MLEAUTO [MLE]",
      command: "MLEAUTO {mle}",
      fields: [{ key: "mle", label: "MLE", placeholder: "1" }],
    },
    {
      id: "xpt",
      label: "XPT [bus]:[source]",
      command: "XPT {bus}:{source}",
      fields: [
        { key: "bus", label: "bus", placeholder: "PGM" },
        { key: "source", label: "source", placeholder: "1" },
      ],
    },
    {
      id: "mvbox",
      label: "MVBOX [MultiViewer]:[box]:[source]",
      command: "MVBOX {multiViewer}:{box}:{source}",
      fields: [
        { key: "multiViewer", label: "MultiViewer", placeholder: "1" },
        { key: "box", label: "box", placeholder: "1" },
        { key: "source", label: "source", placeholder: "1" },
      ],
    },
    {
      id: "ms",
      label: "MS [channel]:[location]:[mediaID]",
      command: "MS {channel}:{location}:{mediaId}",
      fields: [
        { key: "channel", label: "channel", placeholder: "1" },
        { key: "location", label: "location", placeholder: "1" },
        { key: "mediaId", label: "mediaID", placeholder: "1" },
      ],
    },
    { id: "ftb", label: "FTB", command: "FTB", fields: [] },
    {
      id: "saveset",
      label: "SAVESET [name]",
      command: "SAVESET {name}",
      fields: [{ key: "name", label: "name", placeholder: "Preset1" }],
    },
    {
      id: "loadset",
      label: "LOADSET [name]",
      command: "LOADSET {name}",
      fields: [{ key: "name", label: "name", placeholder: "Preset1" }],
    },
    {
      id: "transincl",
      label: "TRANSINCL [MLE]:[incl]:[incl]:[incl]",
      command: "TRANSINCL {mle}:{incl1}:{incl2}:{incl3}",
      fields: [
        { key: "mle", label: "MLE", placeholder: "1" },
        { key: "incl1", label: "incl 1", placeholder: "1" },
        { key: "incl2", label: "incl 2", placeholder: "1" },
        { key: "incl3", label: "incl 3", placeholder: "1" },
      ],
    },
    {
      id: "transrate",
      label: "TRANSRATE [MLE]:[rate]",
      command: "TRANSRATE {mle}:{rate}",
      fields: [
        { key: "mle", label: "MLE", placeholder: "1" },
        { key: "rate", label: "rate", placeholder: "30" },
      ],
    },
    {
      id: "transtype",
      label: "TRANSTYPE [MLE]:[type]",
      command: "TRANSTYPE {mle}:{type}",
      fields: [
        { key: "mle", label: "MLE", placeholder: "1" },
        { key: "type", label: "type", placeholder: "CUT" },
      ],
    },
    { id: "custom", label: "Custom", command: "", fields: [] },
  ];

  const ROSSTALK_PRESET_BY_ID = new Map(
    ROSSTALK_PRESETS.map((preset) => [preset.id, preset]),
  );

  function buildRossTalkPresetCommand(presetId, values = {}, customCommand = "") {
    const preset = ROSSTALK_PRESET_BY_ID.get(String(presetId || ""));
    if (!preset) return "";
    if (preset.id === "none") return "";
    if (preset.id === "custom") {
      return String(customCommand || "").trim();
    }
    return preset.command.replace(/\{([^}]+)\}/g, (_, key) =>
      String(values?.[key] ?? "").trim(),
    );
  }

  const BUILTIN_PRESETS = [
    {
      id: "resolume_clip_1",
      label: "Resolume: Clip Trigger",
      build(editor) {
        return editor.createTaskRowByType("resolume", "clip", {
          target: "clip",
          command: defaultResolumeCommand("clip"),
        });
      },
    },
    {
      id: "resolume_clip_2",
      label: "Resolume: Column Trigger",
      build(editor) {
        return editor.createTaskRowByType("resolume", "clip", {
          target: "column",
          command: defaultResolumeCommand("column"),
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
      id: "vmix_browser",
      label: "vMix: Function Browser Row",
      build(editor) {
        return editor.createTaskRowByType("vmix", "command", {
          vmixMode: "builder",
          vmixCategory: "General",
          vmixFunction: "ActivatorRefresh",
          vmixArgs: {},
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
      id: "companion_tcp_press",
      label: "Companion TCP: PRESS 1 1",
      build(editor) {
        return editor.createTaskRowByProtocol("tcp", "command", {
          command: "PRESS 1 1",
          lineEnd: "lf",
        });
      },
    },
    {
      id: "companion_udp_press",
      label: "Companion UDP: PRESS 1 1",
      build(editor) {
        return editor.createTaskRowByProtocol("udp", "command", {
          command: "PRESS 1 1",
          lineEnd: "none",
        });
      },
    },
    {
      id: "companion_osc_press",
      label: "Companion OSC: /press/bank/1/1",
      build(editor) {
        return editor.createTaskRowByProtocol("osc", "osc", {
          address: "/press/bank/1/1",
          argsText: "",
        });
      },
    },
    {
      id: "rosstalk_cc",
      label: "RossTalk: CC 1:1",
      build(editor) {
        return editor.createTaskRowByType("ross_talk", "rosstalk", {
          rosstalkMode: "cc_index",
          page: 1,
          button: 1,
          lineEnd: "crlf",
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
      this.color = DEFAULT_BUTTON_COLOR;
      this.x = 0;
      this.y = 0;
      this.w = 160;
      this.h = 80;
      this.fontSize = 20;
      this.vmixCatalog = null;
      this.vmixCatalogByName = new Map();
      this.catalogPresets = [];
      this.presetMap = new Map();

      this.bind();
      this.loadPresetOptions();
      this.loadVmixCatalog();
      this.loadCompanionShortcutCatalog();
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
        const preset = this.presetMap.get(presetId);
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
      const presetOptions = [...BUILTIN_PRESETS, ...(this.catalogPresets || [])];
      this.presetMap = new Map(
        presetOptions.map((preset) => [String(preset.id), preset]),
      );
      this.elements.preset.innerHTML = presetOptions.map(
        (preset) =>
          `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.label)}</option>`,
      ).join("");
    }

    createTaskRowFromCatalogShortcut(shortcut, moduleMeta = {}) {
      const item = shortcut && typeof shortcut === "object" ? shortcut : {};
      const params = clone(item.params || {});
      const connectionType = String(
        item.connectionType || moduleMeta.connectionType || "",
      ).trim();
      const protocol = String(item.protocol || moduleMeta.protocol || "")
        .trim()
        .toLowerCase();
      const action = String(
        item.action ||
          this.defaultActionFor(connectionType, protocol) ||
          "command",
      )
        .trim()
        .toLowerCase();

      if (connectionType) {
        return this.createTaskRowByType(connectionType, action, params);
      }
      if (protocol) {
        return this.createTaskRowByProtocol(protocol, action, params);
      }
      return this.createTaskRowByType("generic_tcp", action, params);
    }

    async loadCompanionShortcutCatalog() {
      try {
        let data = null;
        for (const url of ["/shortuts.json", "/shortcuts.json"]) {
          const res = await fetch(url, { cache: "no-cache" });
          if (!res.ok) continue;
          data = await res.json();
          break;
        }
        if (!data) return;
        const modules = Array.isArray(data?.modules) ? data.modules : [];
        const catalogPresets = [];

        for (const moduleEntry of modules) {
          const moduleId = String(moduleEntry?.id || "").trim();
          const moduleName = String(moduleEntry?.name || moduleId || "Module").trim();
          if (!moduleId) continue;

          const moduleMeta = {
            connectionType: String(moduleEntry?.connectionType || "").trim(),
            protocol: String(moduleEntry?.protocol || "").trim().toLowerCase(),
          };
          const shortcuts = Array.isArray(moduleEntry?.shortcuts)
            ? moduleEntry.shortcuts
            : [];

          for (const shortcut of shortcuts) {
            const shortcutId = String(shortcut?.id || "").trim();
            const shortcutLabel = String(shortcut?.label || shortcutId).trim();
            if (!shortcutId || !shortcutLabel) continue;

            const shortcutClone = clone(shortcut);
            catalogPresets.push({
              id: `catalog_${moduleId}_${shortcutId}`,
              label: `${moduleName}: ${shortcutLabel}`,
              build: (editor) =>
                editor.createTaskRowFromCatalogShortcut(shortcutClone, moduleMeta),
            });
          }
        }

        this.catalogPresets = catalogPresets;
        this.loadPresetOptions();
      } catch {
        // Keep editor usable even if companion catalog fetch fails.
      }
    }

    async loadVmixCatalog() {
      try {
        const res = await fetch("/vmix-shortcuts.json", { cache: "no-cache" });
        if (!res.ok) return;
        const data = await res.json();
        const functions = Array.isArray(data?.functions) ? data.functions : [];
        const categories = Array.isArray(data?.categories) ? data.categories : [];
        if (!functions.length || !categories.length) return;

        this.vmixCatalog = {
          source: String(data.source || ""),
          categories: categories.map((c) => ({
            name: String(c?.name || ""),
            count: Number(c?.count || 0),
          })),
          functions: functions.map((fn) => ({
            name: String(fn?.name || ""),
            category: String(fn?.category || "General"),
            description: String(fn?.description || ""),
            parameters: String(fn?.parameters || ""),
            paramKeys: Array.isArray(fn?.paramKeys)
              ? fn.paramKeys.map((k) => String(k))
              : [],
          })),
        };

        this.vmixCatalogByName = new Map();
        for (const fn of this.vmixCatalog.functions) {
          this.vmixCatalogByName.set(fn.name.toLowerCase(), fn);
        }

        if (!this.modal.classList.contains("hidden")) {
          this.refresh();
        }
      } catch {
        // Keep editor usable even if catalog fetch fails.
      }
    }

    open({ button, connections, onApply, onDelete }) {
      this.button = button;
      this.connections = connections || {};
      this.onApply = onApply;
      this.onDelete = onDelete;
      this.errors = {};
      this.drag = null;

      this.label = button.label == null ? "Button" : String(button.label);
      this.color = button.color || DEFAULT_BUTTON_COLOR;
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

    connectionProtocol(name) {
      return String(this.connectionByName(name)?.protocol || "").toLowerCase();
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

    actionLabel(action) {
      const map = {
        command: "Command / Payload",
        http: "HTTP Request",
        osc: "OSC Message",
        rosstalk: "RossTalk",
        clip: "Resolume Clip/Column",
        cue: "Cue",
        track: "Track",
      };
      return map[action] || action;
    }

    isVmixCommandRow(row) {
      if (!row || row.kind !== "task") return false;
      const connection = this.connectionByName(row.device);
      const type = String(row.deviceType || connection?.type || "").toLowerCase();
      return type === "vmix" && row.action === "command";
    }

    vmixMetaByName(functionName) {
      const key = String(functionName || "").trim().toLowerCase();
      if (!key) return null;
      return this.vmixCatalogByName.get(key) || null;
    }

    vmixCategories() {
      const fromCatalog = this.vmixCatalog?.categories || [];
      const names = fromCatalog
        .map((entry) => String(entry?.name || "").trim())
        .filter(Boolean);
      if (names.length) return names;
      return ["General"];
    }

    vmixFunctionsInCategory(categoryName) {
      const target = String(categoryName || "").trim().toLowerCase();
      const list = (this.vmixCatalog?.functions || []).filter(
        (fn) => String(fn?.category || "").trim().toLowerCase() === target,
      );
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }

    syncVmixCategoryForFunction(row) {
      if (!this.isVmixCommandRow(row)) return;
      const meta = this.vmixMetaByName(row.params.vmixFunction);
      if (meta?.category) {
        row.params.vmixCategory = meta.category;
      }
    }

    refreshVmixCommand(row) {
      if (!this.isVmixCommandRow(row)) return;
      const mode = String(row.params.vmixMode || "builder").toLowerCase();
      if (mode !== "builder") return;
      row.params.command = buildVmixCommand(
        row.params.vmixFunction,
        row.params.vmixArgs || {},
      );
    }

    isRossTalkRow(row) {
      if (!row || row.kind !== "task" || row.action !== "rosstalk") return false;
      const connection = this.connectionByName(row.device);
      const type = String(row.deviceType || connection?.type || "").toLowerCase();
      return ["ross_talk", "ross_carbonite", "ross_xpression"].includes(type);
    }

    rosstalkPresetById(presetId) {
      return ROSSTALK_PRESET_BY_ID.get(String(presetId || "")) || null;
    }

    refreshRossTalkPresetCommand(row) {
      if (!this.isRossTalkRow(row)) return;
      const mode = String(row.params.rosstalkMode || "raw").toLowerCase();
      if (mode !== "preset") return;
      row.params.command = buildRossTalkPresetCommand(
        row.params.rosstalkPreset,
        row.params.rosstalkValues || {},
        row.params.customCommand || "",
      );
    }

    defaultActionFor(connectionType, protocol) {
      const type = String(connectionType || "").toLowerCase();
      const proto = String(protocol || "").toLowerCase();

      if (type === "resolume") return "clip";
      if (type === "obs") return "command";
      if (["grandma3", "lighting", "vmix", "atem"].includes(type))
        return "command";
      if (["ross_talk", "ross_carbonite", "ross_xpression"].includes(type))
        return "rosstalk";
      if (["audio", "audio_mixer"].includes(type)) return "track";
      if (["http", "https"].includes(proto) || type === "http_api") return "http";
      if (proto === "osc") return "osc";
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

      const protocol = this.connectionProtocol(row.device);

      if (
        row.action === "command" &&
        protocol === "osc" &&
        !String(row.params.address || "").trim() &&
        String(row.params.command || "").trim().startsWith("/")
      ) {
        row.action = "osc";
        row.params.address = String(row.params.command || "").trim();
      }

      if (row.action === "clip") {
        const hasLegacyLayerClip =
          Number.isFinite(Number(row.params.layer)) &&
          Number.isFinite(Number(row.params.clip));
        const target =
          row.params.target === "column" || row.params.target === "clip"
            ? row.params.target
            : "clip";
        row.params.target = target;

        if (!String(row.params.command || "").trim() && hasLegacyLayerClip) {
          row.params.command = `composition/layers/${Number(row.params.layer)}/clips/${Number(row.params.clip)}/connect`;
        }
        row.params.command = String(row.params.command || "").trim();
        if (!row.params.command) {
          row.params.command = defaultResolumeCommand(target);
        }
        return;
      }

      if (this.isVmixCommandRow(row)) {
        row.params.command = String(row.params.command || "");
        const parsed = parseVmixCommand(row.params.command);

        if (!row.params.vmixMode) {
          row.params.vmixMode = parsed || !row.params.command ? "builder" : "raw";
        }
        row.params.vmixMode =
          String(row.params.vmixMode || "").toLowerCase() === "raw"
            ? "raw"
            : "builder";

        if (!row.params.vmixFunction && parsed?.functionName) {
          row.params.vmixFunction = parsed.functionName;
        }

        if (
          !row.params.vmixArgs ||
          typeof row.params.vmixArgs !== "object" ||
          Array.isArray(row.params.vmixArgs)
        ) {
          row.params.vmixArgs = {};
        }
        if (parsed && !Object.keys(row.params.vmixArgs).length) {
          row.params.vmixArgs = { ...parsed.args };
        }

        const categories = this.vmixCategories();
        if (!String(row.params.vmixCategory || "").trim()) {
          const fnMeta = this.vmixMetaByName(row.params.vmixFunction);
          row.params.vmixCategory = fnMeta?.category || categories[0] || "General";
        }

        const choices = this.vmixFunctionsInCategory(row.params.vmixCategory);
        if (!String(row.params.vmixFunction || "").trim()) {
          row.params.vmixFunction = choices[0]?.name || "Cut";
        } else {
          this.syncVmixCategoryForFunction(row);
        }

        if (row.params.lineEnd == null) {
          row.params.lineEnd = "crlf";
        }
        row.params.lineEnd = String(row.params.lineEnd || "crlf").toLowerCase();

        this.refreshVmixCommand(row);
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
        if (
          row.params.headersText == null &&
          row.params.headers &&
          typeof row.params.headers === "object"
        ) {
          row.params.headersText = JSON.stringify(row.params.headers, null, 2);
        }
        row.params.headersText = String(row.params.headersText || "");
        row.params.timeoutMs = row.params.timeoutMs ?? "";
        delete row.params.headers;
        return;
      }

      if (row.action === "osc") {
        row.params.address = String(
          row.params.address || row.params.oscAddress || row.params.path || "/",
        );
        if (
          row.params.argsText == null &&
          Array.isArray(row.params.args)
        ) {
          row.params.argsText = JSON.stringify(row.params.args, null, 2);
        }
        row.params.argsText = String(row.params.argsText || "");
        delete row.params.args;
        delete row.params.oscAddress;
        return;
      }

      if (row.action === "rosstalk") {
        let mode = String(row.params.rosstalkMode || row.params.mode || "").toLowerCase();
        if (!mode) {
          mode = String(row.params.command || "").trim() ? "raw" : "preset";
        }
        row.params.rosstalkMode = ["raw", "cc_index", "cc_grid", "preset"].includes(mode)
          ? mode
          : "raw";

        row.params.page = Number(row.params.page || 1);
        row.params.button = Number(row.params.button || 1);
        row.params.row = Number(row.params.row || 1);
        row.params.column = Number(row.params.column || 1);
        row.params.rosstalkPreset = String(row.params.rosstalkPreset || "none");
        if (!this.rosstalkPresetById(row.params.rosstalkPreset)) {
          row.params.rosstalkPreset = "custom";
        }
        if (
          !row.params.rosstalkValues ||
          typeof row.params.rosstalkValues !== "object" ||
          Array.isArray(row.params.rosstalkValues)
        ) {
          row.params.rosstalkValues = {};
        }
        row.params.customCommand = String(row.params.customCommand || "");

        if (row.params.rosstalkMode === "preset") {
          const existingCommand = String(row.params.command || "").trim();
          if (
            row.params.rosstalkPreset === "none" &&
            existingCommand
          ) {
            row.params.rosstalkPreset = "custom";
            row.params.customCommand = existingCommand;
          }
          if (
            row.params.rosstalkPreset === "custom" &&
            !String(row.params.customCommand || "").trim() &&
            existingCommand
          ) {
            row.params.customCommand = existingCommand;
          }
          this.refreshRossTalkPresetCommand(row);
        } else if (row.params.rosstalkMode === "raw") {
          row.params.command = String(row.params.command || row.params.customCommand || "");
        } else {
          row.params.command = String(row.params.command || "");
        }

        row.params.lineEnd = String(row.params.lineEnd || "crlf").toLowerCase();
        delete row.params.mode;
        return;
      }

      row.params.command = row.params.command ?? "";
      if (row.params.lineEnd == null) {
        row.params.lineEnd = protocol === "udp" ? "none" : "crlf";
      }
      row.params.lineEnd = String(row.params.lineEnd || "").toLowerCase();
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
          target: "clip",
          command: `composition/layers/${Number(row.layer ?? 1)}/clips/${Number(row.clip ?? 1)}/connect`,
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
        const mode = String(row.params.target || "clip");
        const command = String(row.params.command || "").trim();
        return `${device} -> Resolume ${mode}: ${command || "command"}`;
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
      if (row.action === "osc") {
        return `${device} -> OSC ${row.params.address || "/"}`;
      }
      if (row.action === "rosstalk") {
        const mode = String(row.params.rosstalkMode || "raw").toLowerCase();
        if (mode === "preset") {
          const preset = this.rosstalkPresetById(row.params.rosstalkPreset);
          const command = String(row.params.command || "").trim();
          if (preset?.id === "none") {
            return `${device} -> RossTalk preset: None`;
          }
          return `${device} -> RossTalk ${command || (preset?.label || "preset")}`;
        }
        if (mode === "cc_grid") {
          return `${device} -> CC ${row.params.page || 1}/${row.params.row || 1}/${row.params.column || 1}`;
        }
        if (mode === "cc_index") {
          return `${device} -> CC ${row.params.page || 1}:${row.params.button || 1}`;
        }
        return `${device} -> RossTalk ${row.params.command || "command"}`;
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
      if (type === "obs") return ["command"];
      if (["grandma3", "lighting"].includes(type)) return ["command", "cue"];
      if (["vmix", "atem"].includes(type)) return ["command"];
      if (["ross_talk", "ross_carbonite", "ross_xpression"].includes(type))
        return ["rosstalk", "command"];
      if (["audio", "audio_mixer"].includes(type)) return ["track"];
      if (["http", "https"].includes(protocol) || type === "http_api") return ["http"];
      if (protocol === "osc") return ["osc"];
      if (protocol === "udp") return ["command", "osc"];
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
            `<option value="${escapeHtml(name)}" ${name === row.device ? "selected" : ""}>${escapeHtml(name)}</option>`,
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
      const actions = this.allowedActions(row);
      actionSelect.innerHTML = actions
        .map(
          (action) =>
            `<option value="${action}" ${action === row.action ? "selected" : ""}>${this.actionLabel(action)}</option>`,
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
        const targetField = document.createElement("div");
        targetField.className = "seq-form-row";
        targetField.innerHTML = "<label>Resolume Trigger Type</label>";
        const targetSelect = document.createElement("select");
        const selectedTarget =
          row.params.target === "column" ? "column" : "clip";
        targetSelect.innerHTML = `
          <option value="clip" ${selectedTarget === "clip" ? "selected" : ""}>Clip</option>
          <option value="column" ${selectedTarget === "column" ? "selected" : ""}>Column</option>
        `;
        targetSelect.onchange = () => {
          row.params.target = targetSelect.value;
          row.params.command = defaultResolumeCommand(targetSelect.value);
          this.refresh();
        };
        targetField.appendChild(targetSelect);
        wrapper.appendChild(targetField);

        const commandField = document.createElement("div");
        commandField.className = "seq-form-row";
        commandField.innerHTML = "<label>Custom Command</label>";
        const commandInput = document.createElement("input");
        commandInput.value = String(
          row.params.command || defaultResolumeCommand(selectedTarget),
        );
        commandInput.placeholder =
          selectedTarget === "column"
            ? "/composition/columns/1/connect"
            : "composition/layers/1/clips/1/connect";
        commandInput.oninput = () => {
          row.params.command = commandInput.value;
          this.renderRows();
        };
        commandField.appendChild(commandInput);
        wrapper.appendChild(commandField);
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

        const headers = document.createElement("div");
        headers.className = "seq-form-row";
        headers.innerHTML = "<label>Headers JSON (optional)</label>";
        const headersText = document.createElement("textarea");
        headersText.value = row.params.headersText || "";
        headersText.oninput = () => {
          row.params.headersText = headersText.value;
        };
        headers.appendChild(headersText);
        wrapper.appendChild(headers);

        const timeoutField = document.createElement("div");
        timeoutField.className = "seq-form-row";
        timeoutField.innerHTML = "<label>Timeout (ms, optional)</label>";
        const timeoutInput = document.createElement("input");
        timeoutInput.type = "number";
        timeoutInput.min = "1";
        timeoutInput.value = row.params.timeoutMs || "";
        timeoutInput.oninput = () => {
          row.params.timeoutMs = timeoutInput.value;
        };
        timeoutField.appendChild(timeoutInput);
        wrapper.appendChild(timeoutField);
      } else if (row.action === "osc") {
        const addressField = document.createElement("div");
        addressField.className = "seq-form-row";
        addressField.innerHTML = "<label>OSC Address</label>";
        const addressInput = document.createElement("input");
        addressInput.value = row.params.address || "/";
        addressInput.placeholder = "/press/bank/1/1";
        addressInput.oninput = () => {
          row.params.address = addressInput.value;
          this.renderRows();
        };
        addressField.appendChild(addressInput);
        wrapper.appendChild(addressField);

        const argsField = document.createElement("div");
        argsField.className = "seq-form-row";
        argsField.innerHTML = "<label>Args JSON Array (optional)</label>";
        const argsInput = document.createElement("textarea");
        argsInput.value = row.params.argsText || "";
        argsInput.placeholder = "[1, \"text\", true]";
        argsInput.oninput = () => {
          row.params.argsText = argsInput.value;
        };
        argsField.appendChild(argsInput);
        wrapper.appendChild(argsField);
      } else if (row.action === "rosstalk") {
        const modeField = document.createElement("div");
        modeField.className = "seq-form-row";
        modeField.innerHTML = "<label>RossTalk Mode</label>";
        const modeSelect = document.createElement("select");
        modeSelect.innerHTML = `
          <option value="preset" ${row.params.rosstalkMode === "preset" ? "selected" : ""}>Preset Commands</option>
          <option value="cc_index" ${row.params.rosstalkMode === "cc_index" ? "selected" : ""}>CC page:button</option>
          <option value="cc_grid" ${row.params.rosstalkMode === "cc_grid" ? "selected" : ""}>CC page/row/column</option>
          <option value="raw" ${row.params.rosstalkMode === "raw" ? "selected" : ""}>Raw Command</option>
        `;
        modeSelect.onchange = () => {
          row.params.rosstalkMode = modeSelect.value;
          this.refresh();
        };
        modeField.appendChild(modeSelect);
        wrapper.appendChild(modeField);

        if (row.params.rosstalkMode === "preset") {
          const presetField = document.createElement("div");
          presetField.className = "seq-form-row";
          presetField.innerHTML = "<label>Command Preset</label>";
          const presetSelect = document.createElement("select");
          presetSelect.innerHTML = ROSSTALK_PRESETS.map(
            (preset) =>
              `<option value="${preset.id}" ${preset.id === row.params.rosstalkPreset ? "selected" : ""}>${preset.label}</option>`,
          ).join("");
          presetSelect.onchange = () => {
            row.params.rosstalkPreset = presetSelect.value;
            if (presetSelect.value !== "custom") {
              row.params.customCommand = "";
            }
            this.refreshRossTalkPresetCommand(row);
            this.refresh();
          };
          presetField.appendChild(presetSelect);
          wrapper.appendChild(presetField);

          const preset = this.rosstalkPresetById(row.params.rosstalkPreset);
          const presetFields = preset?.fields || [];
          row.params.rosstalkValues =
            row.params.rosstalkValues && typeof row.params.rosstalkValues === "object"
              ? row.params.rosstalkValues
              : {};

          if (preset?.id === "custom") {
            const field = document.createElement("div");
            field.className = "seq-form-row";
            field.innerHTML = "<label>Custom RossTalk Command</label>";
            const input = document.createElement("input");
            input.value = row.params.customCommand || row.params.command || "";
            input.placeholder = "CC 1:1";
            input.oninput = () => {
              row.params.customCommand = input.value;
              this.refreshRossTalkPresetCommand(row);
              this.renderRows();
            };
            field.appendChild(input);
            wrapper.appendChild(field);
          } else if (presetFields.length) {
            for (const fieldDef of presetFields) {
              const field = document.createElement("div");
              field.className = "seq-form-row";
              field.innerHTML = `<label>${fieldDef.label}</label>`;
              const input = document.createElement("input");
              input.value = String(row.params.rosstalkValues[fieldDef.key] || "");
              input.placeholder = fieldDef.placeholder || fieldDef.key;
              input.oninput = () => {
                row.params.rosstalkValues[fieldDef.key] = input.value;
                this.refreshRossTalkPresetCommand(row);
                this.renderRows();
              };
              field.appendChild(input);
              wrapper.appendChild(field);
            }
          }

          const previewField = document.createElement("div");
          previewField.className = "seq-form-row";
          previewField.innerHTML = "<label>Generated Command</label>";
          const preview = document.createElement("input");
          preview.readOnly = true;
          preview.value = row.params.command || "";
          preview.placeholder = "Select a preset and fill values";
          previewField.appendChild(preview);
          wrapper.appendChild(previewField);
        } else if (row.params.rosstalkMode === "cc_index") {
          const ccField = document.createElement("div");
          ccField.className = "seq-form-row two";
          ccField.innerHTML = "<label>Page</label><label>Button</label>";

          const pageInput = document.createElement("input");
          pageInput.type = "number";
          pageInput.min = "1";
          pageInput.value = String(row.params.page || 1);
          pageInput.oninput = () => {
            row.params.page = Number(pageInput.value || 1);
            this.renderRows();
          };

          const buttonInput = document.createElement("input");
          buttonInput.type = "number";
          buttonInput.min = "1";
          buttonInput.value = String(row.params.button || 1);
          buttonInput.oninput = () => {
            row.params.button = Number(buttonInput.value || 1);
            this.renderRows();
          };

          ccField.appendChild(pageInput);
          ccField.appendChild(buttonInput);
          wrapper.appendChild(ccField);
        } else if (row.params.rosstalkMode === "cc_grid") {
          const ccField = document.createElement("div");
          ccField.className = "seq-form-row three";
          ccField.innerHTML = "<label>Page</label><label>Row</label><label>Column</label>";

          const pageInput = document.createElement("input");
          pageInput.type = "number";
          pageInput.min = "1";
          pageInput.value = String(row.params.page || 1);
          pageInput.oninput = () => {
            row.params.page = Number(pageInput.value || 1);
            this.renderRows();
          };

          const rowInput = document.createElement("input");
          rowInput.type = "number";
          rowInput.min = "1";
          rowInput.value = String(row.params.row || 1);
          rowInput.oninput = () => {
            row.params.row = Number(rowInput.value || 1);
            this.renderRows();
          };

          const columnInput = document.createElement("input");
          columnInput.type = "number";
          columnInput.min = "1";
          columnInput.value = String(row.params.column || 1);
          columnInput.oninput = () => {
            row.params.column = Number(columnInput.value || 1);
            this.renderRows();
          };

          ccField.appendChild(pageInput);
          ccField.appendChild(rowInput);
          ccField.appendChild(columnInput);
          wrapper.appendChild(ccField);
        } else {
          const field = document.createElement("div");
          field.className = "seq-form-row";
          field.innerHTML = "<label>Raw RossTalk Command</label>";
          const input = document.createElement("input");
          input.value = row.params.command || "";
          input.placeholder = "CC 1:1";
          input.oninput = () => {
            row.params.command = input.value;
            this.renderRows();
          };
          field.appendChild(input);
          wrapper.appendChild(field);
        }

        const lineEndField = document.createElement("div");
        lineEndField.className = "seq-form-row";
        lineEndField.innerHTML = "<label>Line Ending</label>";
        const lineEndSelect = document.createElement("select");
        lineEndSelect.innerHTML = LINE_END_OPTIONS.map(
          (opt) =>
            `<option value="${opt.value}" ${opt.value === row.params.lineEnd ? "selected" : ""}>${opt.label}</option>`,
        ).join("");
        lineEndSelect.onchange = () => {
          row.params.lineEnd = lineEndSelect.value;
        };
        lineEndField.appendChild(lineEndSelect);
        wrapper.appendChild(lineEndField);
      } else if (this.isVmixCommandRow(row)) {
        const modeField = document.createElement("div");
        modeField.className = "seq-form-row";
        modeField.innerHTML = "<label>vMix Command Mode</label>";
        const modeSelect = document.createElement("select");
        modeSelect.innerHTML = `
          <option value="builder" ${row.params.vmixMode !== "raw" ? "selected" : ""}>Function Browser</option>
          <option value="raw" ${row.params.vmixMode === "raw" ? "selected" : ""}>Raw Command</option>
        `;
        modeSelect.onchange = () => {
          row.params.vmixMode = modeSelect.value;
          this.ensureTaskDefaults(row);
          this.refresh();
        };
        modeField.appendChild(modeSelect);
        wrapper.appendChild(modeField);

        if (row.params.vmixMode !== "raw") {
          if (this.vmixCatalog) {
            const categoryField = document.createElement("div");
            categoryField.className = "seq-form-row";
            categoryField.innerHTML = "<label>vMix Category</label>";
            const categorySelect = document.createElement("select");
            const categories = this.vmixCategories();
            categorySelect.innerHTML = categories
              .map(
                (name) =>
                  `<option value=\"${name}\" ${name === row.params.vmixCategory ? "selected" : ""}>${name}</option>`,
              )
              .join("");
            categorySelect.onchange = () => {
              row.params.vmixCategory = categorySelect.value;
              const list = this.vmixFunctionsInCategory(row.params.vmixCategory);
              row.params.vmixFunction = list[0]?.name || "";
              row.params.vmixArgs = {};
              this.refreshVmixCommand(row);
              this.refresh();
            };
            categoryField.appendChild(categorySelect);
            wrapper.appendChild(categoryField);

            const functionField = document.createElement("div");
            functionField.className = "seq-form-row";
            functionField.innerHTML = "<label>vMix Function</label>";
            const functionInput = document.createElement("input");
            const listId = `vmix-fn-list-${row.id}`;
            const functions = this.vmixFunctionsInCategory(row.params.vmixCategory);
            functionInput.setAttribute("list", listId);
            functionInput.value = row.params.vmixFunction || "";
            functionInput.placeholder = "vMix function name";
            functionInput.oninput = () => {
              row.params.vmixFunction = functionInput.value.trim();
              this.syncVmixCategoryForFunction(row);
              row.params.vmixArgs = row.params.vmixArgs || {};
              this.refreshVmixCommand(row);
              this.renderRows();
            };
            const functionList = document.createElement("datalist");
            functionList.id = listId;
            functionList.innerHTML = functions
              .map((fn) => `<option value=\"${fn.name}\"></option>`)
              .join("");

            functionField.appendChild(functionInput);
            functionField.appendChild(functionList);
            wrapper.appendChild(functionField);

            const selectedMeta = this.vmixMetaByName(row.params.vmixFunction);
            if (selectedMeta?.description) {
              const description = document.createElement("p");
              description.className = "typography-muted";
              description.textContent = selectedMeta.description;
              wrapper.appendChild(description);
            }

            const paramKeys = selectedMeta?.paramKeys || [];
            if (paramKeys.length) {
              row.params.vmixArgs =
                row.params.vmixArgs && typeof row.params.vmixArgs === "object"
                  ? row.params.vmixArgs
                  : {};

              const paramsWrap = document.createElement("div");
              paramsWrap.className = "seq-form-row";
              paramsWrap.innerHTML = "<label>Function Parameters</label>";
              wrapper.appendChild(paramsWrap);

              for (const key of paramKeys) {
                const field = document.createElement("div");
                field.className = "seq-form-row";
                field.innerHTML = `<label>${key}</label>`;
                const input = document.createElement("input");
                input.value = String(row.params.vmixArgs[key] || "");
                input.placeholder = key;
                input.oninput = () => {
                  row.params.vmixArgs[key] = input.value;
                  this.refreshVmixCommand(row);
                  this.renderRows();
                };
                field.appendChild(input);
                wrapper.appendChild(field);
              }
            } else {
              const noParams = document.createElement("p");
              noParams.className = "typography-muted";
              noParams.textContent = "This function does not require parameters.";
              wrapper.appendChild(noParams);
            }
          } else {
            const loading = document.createElement("p");
            loading.className = "typography-muted";
            loading.textContent = "Loading vMix function catalog...";
            wrapper.appendChild(loading);
          }
        }

        const field = document.createElement("div");
        field.className = "seq-form-row";
        field.innerHTML = `<label>${row.params.vmixMode === "raw" ? "Raw Command / Payload" : "Generated Command"}</label>`;
        const input = document.createElement("input");
        input.value = row.params.command || "";
        input.readOnly = row.params.vmixMode !== "raw";
        input.oninput = () => {
          row.params.command = input.value;
          this.renderRows();
        };
        field.appendChild(input);
        wrapper.appendChild(field);

        const lineEndField = document.createElement("div");
        lineEndField.className = "seq-form-row";
        lineEndField.innerHTML = "<label>Line Ending</label>";
        const lineEndSelect = document.createElement("select");
        lineEndSelect.innerHTML = LINE_END_OPTIONS.map(
          (opt) =>
            `<option value="${opt.value}" ${opt.value === row.params.lineEnd ? "selected" : ""}>${opt.label}</option>`,
        ).join("");
        lineEndSelect.onchange = () => {
          row.params.lineEnd = lineEndSelect.value;
        };
        lineEndField.appendChild(lineEndSelect);
        wrapper.appendChild(lineEndField);
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

        const lineEndField = document.createElement("div");
        lineEndField.className = "seq-form-row";
        lineEndField.innerHTML = "<label>Line Ending</label>";
        const lineEndSelect = document.createElement("select");
        lineEndSelect.innerHTML = LINE_END_OPTIONS.map(
          (opt) =>
            `<option value="${opt.value}" ${opt.value === row.params.lineEnd ? "selected" : ""}>${opt.label}</option>`,
        ).join("");
        lineEndSelect.onchange = () => {
          row.params.lineEnd = lineEndSelect.value;
        };
        lineEndField.appendChild(lineEndSelect);
        wrapper.appendChild(lineEndField);
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
          const target = String(params.target || "").toLowerCase();
          if (!["clip", "column"].includes(target)) {
            this.errors[key] = "Resolume trigger type must be clip or column";
            return;
          }
          if (!String(params.command || "").trim()) {
            this.errors[key] = "Resolume custom command is required";
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
          if (String(params.vmixMode || "").toLowerCase() !== "raw") {
            if (!String(params.vmixFunction || "").trim()) {
              this.errors[key] = "Select a vMix function";
              return;
            }
          }
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

        if (action === "rosstalk") {
          const mode = String(params.rosstalkMode || "raw").toLowerCase();
          if (mode === "preset") {
            const presetId = String(params.rosstalkPreset || "none");
            const preset = this.rosstalkPresetById(presetId);
            if (!preset || preset.id === "none") {
              this.errors[key] = "Select a RossTalk preset command";
              return;
            }
            if (preset.id === "custom") {
              const custom = String(params.customCommand || params.command || "").trim();
              if (!custom) {
                this.errors[key] = "Custom RossTalk command is required";
                return;
              }
            } else {
              const values =
                params.rosstalkValues && typeof params.rosstalkValues === "object"
                  ? params.rosstalkValues
                  : {};
              for (const field of preset.fields || []) {
                if (!String(values[field.key] || "").trim()) {
                  this.errors[key] = `${field.label} is required`;
                  return;
                }
              }
            }
            if (!String(params.command || "").trim()) {
              this.errors[key] = "RossTalk command is required";
            }
            return;
          }
          if (mode === "cc_index") {
            if (!Number.isInteger(Number(params.page)) || Number(params.page) < 1) {
              this.errors[key] = "RossTalk page must be >= 1";
              return;
            }
            if (!Number.isInteger(Number(params.button)) || Number(params.button) < 1) {
              this.errors[key] = "RossTalk button must be >= 1";
            }
            return;
          }
          if (mode === "cc_grid") {
            if (!Number.isInteger(Number(params.page)) || Number(params.page) < 1) {
              this.errors[key] = "RossTalk page must be >= 1";
              return;
            }
            if (!Number.isInteger(Number(params.row)) || Number(params.row) < 1) {
              this.errors[key] = "RossTalk row must be >= 1";
              return;
            }
            if (!Number.isInteger(Number(params.column)) || Number(params.column) < 1) {
              this.errors[key] = "RossTalk column must be >= 1";
              return;
            }
            return;
          }
          if (!String(params.command || "").trim()) {
            this.errors[key] = "RossTalk command is required";
          }
          return;
        }

        if (action === "osc" || protocol === "osc") {
          if (!String(params.address || "").trim()) {
            this.errors[key] = "OSC address is required";
            return;
          }
          if (String(params.argsText || "").trim()) {
            try {
              const parsed = JSON.parse(params.argsText);
              if (!Array.isArray(parsed)) {
                this.errors[key] = "OSC args must be a JSON array";
              }
            } catch {
              this.errors[key] = "OSC args must be valid JSON";
            }
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
          if (String(params.headersText || "").trim()) {
            try {
              const headers = JSON.parse(params.headersText);
              if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
                this.errors[key] = "HTTP headers must be a JSON object";
              }
            } catch {
              this.errors[key] = "HTTP headers must be valid JSON";
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
        const headersText = String(params.headersText || "").trim();
        const timeoutText = String(params.timeoutMs || "").trim();
        delete params.bodyText;
        delete params.headersText;
        if (bodyText) {
          params.body = JSON.parse(bodyText);
        }
        if (headersText) {
          params.headers = JSON.parse(headersText);
        }
        if (timeoutText) {
          params.timeoutMs = Number(timeoutText);
        } else {
          delete params.timeoutMs;
        }
      }

      if (row.action === "osc") {
        params.address = String(params.address || "/");
        const argsText = String(params.argsText || "").trim();
        delete params.argsText;
        if (argsText) {
          params.args = JSON.parse(argsText);
        } else {
          params.args = [];
        }
      }

      if (row.action === "rosstalk") {
        params.rosstalkMode = String(params.rosstalkMode || "raw").toLowerCase();
        if (!["raw", "cc_index", "cc_grid", "preset"].includes(params.rosstalkMode)) {
          params.rosstalkMode = "raw";
        }
        if (params.rosstalkMode === "cc_grid") {
          params.page = Number(params.page || 1);
          params.row = Number(params.row || 1);
          params.column = Number(params.column || 1);
          delete params.button;
          delete params.command;
          delete params.customCommand;
        } else if (params.rosstalkMode === "cc_index") {
          params.page = Number(params.page || 1);
          params.button = Number(params.button || 1);
          delete params.row;
          delete params.column;
          delete params.command;
          delete params.customCommand;
        } else if (params.rosstalkMode === "preset") {
          params.rosstalkPreset = String(params.rosstalkPreset || "none");
          if (!this.rosstalkPresetById(params.rosstalkPreset)) {
            params.rosstalkPreset = "none";
          }
          if (
            !params.rosstalkValues ||
            typeof params.rosstalkValues !== "object" ||
            Array.isArray(params.rosstalkValues)
          ) {
            params.rosstalkValues = {};
          }
          params.customCommand = String(params.customCommand || "");
          params.command = buildRossTalkPresetCommand(
            params.rosstalkPreset,
            params.rosstalkValues,
            params.customCommand,
          );
          delete params.page;
          delete params.button;
          delete params.row;
          delete params.column;
        } else {
          params.command = String(params.command || "");
          params.customCommand = params.command;
        }
      }

      if (this.isVmixCommandRow(row)) {
        params.vmixMode =
          String(params.vmixMode || "").toLowerCase() === "raw"
            ? "raw"
            : "builder";
        if (
          !params.vmixArgs ||
          typeof params.vmixArgs !== "object" ||
          Array.isArray(params.vmixArgs)
        ) {
          params.vmixArgs = {};
        }
        if (params.vmixMode === "builder") {
          params.command = buildVmixCommand(params.vmixFunction, params.vmixArgs);
        }
      }

      if (row.action === "command" || row.action === "rosstalk") {
        params.lineEnd = String(params.lineEnd || "").trim().toLowerCase();
        if (!params.lineEnd) {
          delete params.lineEnd;
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
        label: this.label == null ? "Button" : String(this.label),
        color: this.color || DEFAULT_BUTTON_COLOR,
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

