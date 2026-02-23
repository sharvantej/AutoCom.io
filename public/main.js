let layout = { buttons: [] };
let editMode = false;
let activeButtonId = localStorage.getItem("activeButtonId") || null;
let selectedEditButtonId = null;
let systemRunning = false;
let clickLock = false;
let layoutBaseline = "";
let layoutDirty = false;
let manipulatingLayout = false;
let saveToastTimer = null;
let scrollMode = "true";
let editToolMode = "move";
let snapToGrid = false;
let showBorders = true;
let borderColor = "#576172";
const GRID_SIZE = 20;
const sequenceEditor = window.SequenceEditor ? new window.SequenceEditor() : null;
const WORKSPACE_MIN_W = 2400;
const WORKSPACE_MIN_H = 1400;

function refreshDirtyState() {
  layoutDirty = JSON.stringify(layout) !== layoutBaseline;
  const badge = document.getElementById("dirtyBadge");
  if (!badge) return;
  badge.classList.toggle("visible", layoutDirty);
}

function clampInt(value, min, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.round(n));
}

function snapValue(value) {
  if (!snapToGrid) return value;
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function normalizeButton(btn) {
  const kind = String(btn.kind || "button").toLowerCase();
  btn.kind = ["label", "image"].includes(kind) ? kind : "button";
  btn.x = clampInt(btn.x, 0, 0);
  btn.y = clampInt(btn.y, 0, 0);
  btn.w = clampInt(btn.w, 60, 160);
  btn.h = clampInt(btn.h, 40, 80);
  btn.fontSize = clampInt(btn.fontSize, 8, 20);
  btn.label = String(btn.label || "Button");
  btn.textColor = String(btn.textColor || "#e5e7eb");
  btn.src = String(btn.src || "");
}

function normalizeLayout() {
  layout.buttons = Array.isArray(layout.buttons) ? layout.buttons : [];
  layout.buttons.forEach((btn) => normalizeButton(btn));
  layout.backgroundColor = normalizeColorValue(layout.backgroundColor, "#252c36");
}

function applyCanvasAppearance() {
  const viewport = document.getElementById("dashboardViewport");
  if (!viewport) return;
  viewport.style.backgroundColor = layout.backgroundColor || "#252c36";
}

function applyBorderVisibility() {
  document.body.classList.toggle("no-tile-borders", !showBorders);
  document.documentElement.style.setProperty(
    "--tile-border-color",
    normalizeColorValue(borderColor, "#576172"),
  );
}

function selectedButton() {
  if (!selectedEditButtonId) return null;
  return (
    layout.buttons.find((btn) => String(btn.id) === String(selectedEditButtonId)) ||
    null
  );
}

function syncInspector() {
  const labelInput = document.getElementById("btnLabelInput");
  const xInput = document.getElementById("btnXInput");
  const yInput = document.getElementById("btnYInput");
  const wInput = document.getElementById("btnWInput");
  const hInput = document.getElementById("btnHInput");
  const fsInput = document.getElementById("btnFsInput");
  const bgInput = document.getElementById("btnBgInput");
  const textColorInput = document.getElementById("btnTextColorInput");
  if (!labelInput || !xInput || !yInput || !wInput || !hInput || !fsInput || !bgInput || !textColorInput) return;

  const btn = selectedButton();
  const disabled = !editMode || !btn;
  [labelInput, xInput, yInput, wInput, hInput, fsInput, bgInput, textColorInput].forEach((input) => {
    input.disabled = disabled;
  });

  if (!btn) {
    labelInput.value = "";
    xInput.value = "";
    yInput.value = "";
    wInput.value = "";
    hInput.value = "";
    fsInput.value = "";
    bgInput.value = "#2ecc71";
    textColorInput.value = "#e5e7eb";
    return;
  }

  normalizeButton(btn);
  const isImage = btn.kind === "image";
  labelInput.value = String(btn.label || "");
  xInput.value = String(btn.x);
  yInput.value = String(btn.y);
  wInput.value = String(btn.w);
  hInput.value = String(btn.h);
  fsInput.value = String(btn.fontSize || 20);
  bgInput.value = normalizeColorValue(btn.color, "#2ecc71");
  textColorInput.value = normalizeColorValue(btn.textColor, "#e5e7eb");

  labelInput.disabled = disabled || isImage;
  bgInput.disabled = disabled || isImage;
  textColorInput.disabled = disabled || isImage;
}

function normalizeColorValue(value, fallback) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  return fallback;
}

function bindInspector() {
  const labelInput = document.getElementById("btnLabelInput");
  const xInput = document.getElementById("btnXInput");
  const yInput = document.getElementById("btnYInput");
  const wInput = document.getElementById("btnWInput");
  const hInput = document.getElementById("btnHInput");
  const fsInput = document.getElementById("btnFsInput");
  const bgInput = document.getElementById("btnBgInput");
  const textColorInput = document.getElementById("btnTextColorInput");
  if (!labelInput || !xInput || !yInput || !wInput || !hInput || !fsInput || !bgInput || !textColorInput) return;

  const applyField = (field, min, fallback) => {
    const btn = selectedButton();
    if (!btn) return;
    const sourceMap = {
      x: xInput,
      y: yInput,
      w: wInput,
      h: hInput,
      fontSize: fsInput,
    };
    const source = sourceMap[field];
    let value = clampInt(source?.value, min, fallback);
    if (["x", "y", "w", "h"].includes(field)) {
      value = Math.max(min, snapValue(value));
    }
    btn[field] = value;
    refreshDirtyState();
    render();
  };

  xInput.addEventListener("input", () => applyField("x", 0, 0));
  yInput.addEventListener("input", () => applyField("y", 0, 0));
  wInput.addEventListener("input", () => applyField("w", 60, 160));
  hInput.addEventListener("input", () => applyField("h", 40, 80));
  fsInput.addEventListener("input", () => applyField("fontSize", 8, 20));
  labelInput.addEventListener("input", () => {
    const btn = selectedButton();
    if (!btn) return;
    btn.label = String(labelInput.value || "");
    refreshDirtyState();
    render();
  });
  bgInput.addEventListener("input", () => {
    const btn = selectedButton();
    if (!btn) return;
    btn.color = bgInput.value;
    refreshDirtyState();
    render();
  });
  textColorInput.addEventListener("input", () => {
    const btn = selectedButton();
    if (!btn) return;
    btn.textColor = textColorInput.value;
    refreshDirtyState();
    render();
  });
}

function ensureCanvasBounds() {
  const viewport = document.getElementById("dashboardViewport");
  const canvas = document.getElementById("canvas");
  if (!canvas) return;

  let maxX = WORKSPACE_MIN_W;
  let maxY = WORKSPACE_MIN_H;

  for (const btn of layout.buttons) {
    normalizeButton(btn);
    maxX = Math.max(maxX, btn.x + btn.w + 220);
    maxY = Math.max(maxY, btn.y + btn.h + 220);
  }

  if (viewport) {
    maxX = Math.max(maxX, viewport.clientWidth + 40);
    maxY = Math.max(maxY, viewport.clientHeight + 40);
  }

  canvas.style.width = `${maxX}px`;
  canvas.style.height = `${maxY}px`;
}

function restoreDockPosition() {
  const dock = document.getElementById("editBar");
  if (!dock) return;
  const x = Number(localStorage.getItem("dockX"));
  const y = Number(localStorage.getItem("dockY"));
  if (Number.isFinite(x) && Number.isFinite(y)) {
    dock.style.left = `${Math.max(0, x)}px`;
    dock.style.top = `${Math.max(0, y)}px`;
  }
}

function initDockOptions() {
  const snapBox = document.getElementById("snapGridCheckbox");
  const borderBox = document.getElementById("showBorderCheckbox");
  const borderColorInput = document.getElementById("borderColorInput");
  if (!snapBox || !borderBox) return;

  snapToGrid = localStorage.getItem("snapToGrid") === "true";
  const borderStored = localStorage.getItem("showBorders");
  showBorders = borderStored == null ? true : borderStored === "true";
  borderColor = normalizeColorValue(
    localStorage.getItem("borderColor"),
    "#576172",
  );

  snapBox.checked = snapToGrid;
  borderBox.checked = showBorders;
  if (borderColorInput) {
    borderColorInput.value = borderColor;
  }
  applyBorderVisibility();

  snapBox.addEventListener("change", () => {
    snapToGrid = snapBox.checked;
    localStorage.setItem("snapToGrid", String(snapToGrid));
  });

  borderBox.addEventListener("change", () => {
    showBorders = borderBox.checked;
    localStorage.setItem("showBorders", String(showBorders));
    applyBorderVisibility();
  });

  borderColorInput?.addEventListener("input", () => {
    borderColor = normalizeColorValue(borderColorInput.value, "#576172");
    localStorage.setItem("borderColor", borderColor);
    applyBorderVisibility();
  });
}

function initDockDrag() {
  const dock = document.getElementById("editBar");
  const head = dock?.querySelector(".tool-dock-head");
  if (!dock || !head) return;

  head.addEventListener("mousedown", (event) => {
    if (event.target.closest("button")) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = dock.getBoundingClientRect();
    const baseLeft = rect.left;
    const baseTop = rect.top;

    function move(next) {
      const nx = Math.max(0, Math.round(baseLeft + (next.clientX - startX)));
      const ny = Math.max(0, Math.round(baseTop + (next.clientY - startY)));
      dock.style.left = `${nx}px`;
      dock.style.top = `${ny}px`;
      localStorage.setItem("dockX", String(nx));
      localStorage.setItem("dockY", String(ny));
    }

    function up() {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    }

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  });
}

function showSaveToast(message, isError = false) {
  const toast = document.getElementById("saveToast");
  if (!toast) return;

  toast.textContent = message;
  toast.style.borderColor = isError ? "#b91c1c" : "#475569";
  toast.style.background = isError ? "#3f1d1d" : "#111827";
  toast.classList.add("visible");

  if (saveToastTimer) clearTimeout(saveToastTimer);
  saveToastTimer = setTimeout(() => {
    toast.classList.remove("visible");
  }, 1800);
}

function setEditToolMode(mode) {
  editToolMode = mode === "resize" ? "resize" : "move";
  document.body.classList.toggle("edit-mode-move", editToolMode === "move");
  document.body.classList.toggle("edit-mode-resize", editToolMode === "resize");
  const buttons = document.querySelectorAll(".tool-mode-btn[data-tool-mode]");
  buttons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.toolMode === editToolMode);
  });
}

function normalizeScrollMode(mode) {
  const value = String(mode || "").toLowerCase();
  if (["true", "false", "vertical", "horizontal", "always"].includes(value)) {
    return value;
  }
  return "true";
}

function applyScrollMode(mode) {
  const viewport = document.getElementById("dashboardViewport");
  if (!viewport) return;

  scrollMode = normalizeScrollMode(mode);
  localStorage.setItem("dashboardScrollMode", scrollMode);

  if (scrollMode === "false") {
    viewport.style.overflowX = "hidden";
    viewport.style.overflowY = "hidden";
    return;
  }
  if (scrollMode === "vertical") {
    viewport.style.overflowX = "hidden";
    viewport.style.overflowY = "auto";
    return;
  }
  if (scrollMode === "horizontal") {
    viewport.style.overflowX = "auto";
    viewport.style.overflowY = "hidden";
    return;
  }
  if (scrollMode === "always") {
    viewport.style.overflowX = "scroll";
    viewport.style.overflowY = "scroll";
    return;
  }

  viewport.style.overflowX = "auto";
  viewport.style.overflowY = "auto";
}

function initScrollControl() {
  const select = document.getElementById("scrollModeSelect");
  if (!select) return;
  const stored = normalizeScrollMode(localStorage.getItem("dashboardScrollMode"));
  select.value = stored;
  applyScrollMode(stored);
  select.addEventListener("change", () => {
    applyScrollMode(select.value);
  });
}

document.addEventListener("keydown", (event) => {
  const targetTag = String(event.target?.tagName || "").toLowerCase();
  const isTypingTarget =
    targetTag === "input" || targetTag === "textarea" || targetTag === "select";
  const sequenceModalOpen = !document
    .getElementById("sequenceEditorModal")
    ?.classList.contains("hidden");

  if (event.key.toLowerCase() === "g") {
    toggleEdit(!editMode);
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
    event.preventDefault();
    addButton();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveLayout();
  }
  if (event.key.toLowerCase() === "c") {
    activeButtonId = null;
    localStorage.removeItem("activeButtonId");
    render();
  }

  if (!editMode || isTypingTarget || sequenceModalOpen) return;

  const selected = layout.buttons.find(
    (btn) => String(btn.id) === String(selectedEditButtonId),
  );
  if (!selected) return;
  if (editToolMode !== "move") return;

  const step = event.shiftKey ? 10 : 1;
  const moveStep = snapToGrid ? GRID_SIZE : step;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    selected.x = Math.max(0, selected.x - moveStep);
    if (snapToGrid) selected.x = Math.max(0, snapValue(selected.x));
    refreshDirtyState();
    render();
    return;
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    selected.x = selected.x + moveStep;
    if (snapToGrid) selected.x = Math.max(0, snapValue(selected.x));
    refreshDirtyState();
    render();
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    selected.y = Math.max(0, selected.y - moveStep);
    if (snapToGrid) selected.y = Math.max(0, snapValue(selected.y));
    refreshDirtyState();
    render();
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    selected.y = selected.y + moveStep;
    if (snapToGrid) selected.y = Math.max(0, snapValue(selected.y));
    refreshDirtyState();
    render();
    return;
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    deleteSelectedButton();
  }
});

function toggleEdit(state) {
  editMode = state;
  if (!editMode) {
    selectedEditButtonId = null;
  }
  document.body.classList.toggle("editing", editMode);
  const dock = document.getElementById("editBar");
  const toggleBtn = dock?.querySelector("[data-tool-action='toggle-edit']");
  if (dock) {
    dock.style.display = editMode ? "flex" : "none";
  }
  if (dock) dock.classList.toggle("is-editing", editMode);
  if (toggleBtn) toggleBtn.textContent = editMode ? "x" : "o";
  syncInspector();
  refreshDirtyState();
  render();
}

async function loadLayout() {
  const res = await fetch("/api/layout");
  layout = await res.json();
  normalizeLayout();
  layoutBaseline = JSON.stringify(layout);
  refreshDirtyState();
  applyCanvasAppearance();
  syncCanvasSettings();
  render();
}

function render() {
  const canvas = document.getElementById("canvas");
  canvas.innerHTML = "";

  for (const btn of layout.buttons) {
    normalizeButton(btn);
    const isLabel = btn.kind === "label";
    const isImage = btn.kind === "image";
    const el = document.createElement("div");
    el.className = `tile ${isLabel ? "tile-label" : ""} ${isImage ? "tile-image" : ""}`;
    el.dataset.btnId = String(btn.id);
    el.innerText = isImage ? "" : btn.label;
    el.style.left = `${btn.x}px`;
    el.style.top = `${btn.y}px`;
    el.style.width = `${btn.w}px`;
    el.style.height = `${btn.h}px`;
    el.style.fontSize = `${btn.fontSize || 20}px`;
    el.style.color = btn.textColor || "#e5e7eb";

    const defaultColor = "#2ecc71";
    const activeColor = "#e74c3c";

    if (!isLabel && !isImage && String(btn.id) === String(activeButtonId)) {
      el.style.background = activeColor;
      el.classList.add("active");
      if (systemRunning) el.classList.add("active-running");
    } else {
      el.style.background = btn.color || defaultColor;
    }

    if (isImage) {
      const img = document.createElement("img");
      img.className = "tile-image-media";
      img.src = btn.src || "";
      img.alt = btn.label || "image";
      img.draggable = false;
      el.appendChild(img);
    }

    if (editMode && String(btn.id) === String(selectedEditButtonId)) {
      el.classList.add("selected-edit");
    }

    el.onclick = async () => {
      if (editMode) {
        selectedEditButtonId = String(btn.id);
        applyEditSelectionVisual();
        return;
      }
      if (isLabel || isImage) return;
      if (clickLock) return;

      clickLock = true;
      setTimeout(() => {
        clickLock = false;
      }, 200);

      activeButtonId = String(btn.id);
      localStorage.setItem("activeButtonId", String(btn.id));
      addLog(`Button pressed: ${btn.label}`);
      render();

      try {
        if (btn.tasks?.length) {
          const response = await fetch(`/api/button/${btn.id}`, { method: "POST" });
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            addLog(`Button sequence failed: ${data.error || response.statusText}`);
          }
        }
        if (btn.cue) {
          const cueResponse = await fetch(`/api/cue/${btn.cue}`, { method: "POST" });
          if (!cueResponse.ok) {
            const cueData = await cueResponse.json().catch(() => ({}));
            addLog(`Cue failed: ${cueData.error || cueResponse.statusText}`);
          }
        }
      } catch (err) {
        addLog(`Trigger error: ${err.message}`);
      }
    };

    el.onmousedown = (event) => {
      if (editMode) {
        selectedEditButtonId = String(btn.id);
        applyEditSelectionVisual();
        if (editToolMode === "move") {
          startDrag(event, btn, el);
        } else if (editToolMode === "resize") {
          const dir = getResizeDirection(el, event);
          if (dir) {
            startResizeByEdge(event, btn, el, dir);
          }
        }
      }
    };

    el.onmousemove = (event) => {
      if (
        !editMode ||
        editToolMode !== "resize" ||
        String(btn.id) !== String(selectedEditButtonId)
      ) {
        el.style.cursor = editMode ? "pointer" : "pointer";
        return;
      }
      const dir = getResizeDirection(el, event);
      el.style.cursor = dir ? `${dir}-resize` : "default";
    };
    el.onmouseleave = () => {
      el.style.cursor = editMode ? "pointer" : "pointer";
    };

    el.ondblclick = () => {
      if (!editMode) return;
      if (isLabel) {
        const next = window.prompt("Label text", btn.label || "");
        if (typeof next === "string" && next.trim()) {
          btn.label = next.trim();
          refreshDirtyState();
          render();
        }
        return;
      }
      if (isImage) return;
      editButton(btn);
    };

    canvas.appendChild(el);
  }
  ensureCanvasBounds();
  syncInspector();
}

function applyEditSelectionVisual() {
  const tiles = document.querySelectorAll(".tile");
  for (const tile of tiles) {
    const isSelected =
      editMode && String(tile.dataset.btnId) === String(selectedEditButtonId);
    tile.classList.toggle("selected-edit", isSelected);
  }
}

function addButton() {
  const defaultLabel = `Button ${layout.buttons.length + 1}`;
  let label = defaultLabel;
  try {
    const entered = window.prompt("Button Label?", defaultLabel);
    if (typeof entered === "string" && entered.trim()) {
      label = entered.trim();
    }
  } catch {}

  layout.buttons.push({
    id: Date.now(),
    kind: "button",
    label,
    x: 140,
    y: 140,
    w: 160,
    h: 80,
    fontSize: 20,
    color: "#2ecc71",
    textColor: "#f5f5f5",
    tasks: [],
  });

  refreshDirtyState();
  selectedEditButtonId = String(layout.buttons[layout.buttons.length - 1].id);
  render();
}

function addLabelBox() {
  const defaultLabel = "Label";
  let label = defaultLabel;
  try {
    const entered = window.prompt("Label text?", defaultLabel);
    if (typeof entered === "string" && entered.trim()) {
      label = entered.trim();
    }
  } catch {}

  layout.buttons.push({
    id: Date.now() + 1,
    kind: "label",
    label,
    x: 180,
    y: 180,
    w: 220,
    h: 44,
    fontSize: 18,
    color: "#232933",
    textColor: "#d1d5db",
    tasks: [],
  });

  refreshDirtyState();
  selectedEditButtonId = String(layout.buttons[layout.buttons.length - 1].id);
  render();
}

function addImageBox(src) {
  if (!src) return;
  layout.buttons.push({
    id: Date.now() + 2,
    kind: "image",
    label: "Image",
    src,
    x: 220,
    y: 220,
    w: 320,
    h: 180,
    fontSize: 16,
    color: "#000000",
    textColor: "#e5e7eb",
    tasks: [],
  });

  refreshDirtyState();
  selectedEditButtonId = String(layout.buttons[layout.buttons.length - 1].id);
  render();
}

function initImagePicker() {
  const picker = document.getElementById("imagePicker");
  if (!picker) return;
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      addImageBox(String(reader.result || ""));
      picker.value = "";
    };
    reader.readAsDataURL(file);
  });
}

function syncCanvasSettings() {
  const canvasBgInput = document.getElementById("canvasBgInput");
  if (!canvasBgInput) return;
  canvasBgInput.value = normalizeColorValue(layout.backgroundColor, "#252c36");
}

function initCanvasSettings() {
  const canvasBgInput = document.getElementById("canvasBgInput");
  if (!canvasBgInput) return;
  canvasBgInput.addEventListener("input", () => {
    layout.backgroundColor = normalizeColorValue(canvasBgInput.value, "#252c36");
    applyCanvasAppearance();
    refreshDirtyState();
  });
}

async function editButton(btn) {
  if (!sequenceEditor) {
    alert("Sequence editor failed to load.");
    return;
  }

  let connections = {};
  try {
    const res = await fetch("/api/connections");
    connections = await res.json();
  } catch {
    alert("Could not load connections.");
    return;
  }

  sequenceEditor.open({
    button: btn,
    connections,
    onApply: (updated) => {
      if (btn.kind === "label") return;
      btn.label = updated.label;
      btn.color = updated.color;
      btn.x = clampInt(updated.x, 0, btn.x || 0);
      btn.y = clampInt(updated.y, 0, btn.y || 0);
      btn.w = clampInt(updated.w, 60, btn.w || 160);
      btn.h = clampInt(updated.h, 40, btn.h || 80);
      btn.fontSize = clampInt(updated.fontSize, 8, btn.fontSize || 20);
      btn.textColor = String(updated.textColor || btn.textColor || "#f5f5f5");
      btn.tasks = updated.tasks;
      refreshDirtyState();
      render();
    },
    onDelete: () => {
      layout.buttons = layout.buttons.filter((item) => String(item.id) !== String(btn.id));
      refreshDirtyState();
      render();
    },
  });
}

function startDrag(event, btn, el) {
  event.preventDefault();
  manipulatingLayout = true;
  let sx = event.clientX;
  let sy = event.clientY;

  function move(next) {
    let nx = Math.max(0, Math.round(btn.x + (next.clientX - sx)));
    let ny = Math.max(0, Math.round(btn.y + (next.clientY - sy)));
    if (snapToGrid) {
      nx = Math.max(0, snapValue(nx));
      ny = Math.max(0, snapValue(ny));
    }
    btn.x = nx;
    btn.y = ny;
    el.style.left = `${btn.x}px`;
    el.style.top = `${btn.y}px`;
    sx = next.clientX;
    sy = next.clientY;
    syncInspector();
  }

  function up() {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    manipulatingLayout = false;
    refreshDirtyState();
  }

  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}

function getResizeDirection(el, event) {
  const rect = el.getBoundingClientRect();
  const edge = 8;
  const left = event.clientX - rect.left <= edge;
  const right = rect.right - event.clientX <= edge;
  const top = event.clientY - rect.top <= edge;
  const bottom = rect.bottom - event.clientY <= edge;

  if (top && left) return "nw";
  if (top && right) return "ne";
  if (bottom && left) return "sw";
  if (bottom && right) return "se";
  if (top) return "n";
  if (bottom) return "s";
  if (left) return "w";
  if (right) return "e";
  return "";
}

function startResizeByEdge(event, btn, el, dir) {
  event.stopPropagation();
  event.preventDefault();
  manipulatingLayout = true;

  const start = {
    sx: event.clientX,
    sy: event.clientY,
    x: btn.x,
    y: btn.y,
    w: btn.w,
    h: btn.h,
  };

  function move(next) {
    const dx = next.clientX - start.sx;
    const dy = next.clientY - start.sy;
    let x = start.x;
    let y = start.y;
    let w = start.w;
    let h = start.h;

    if (dir.includes("e")) w = Math.max(60, Math.round(start.w + dx));
    if (dir.includes("s")) h = Math.max(40, Math.round(start.h + dy));
    if (dir.includes("w")) {
      w = Math.max(60, Math.round(start.w - dx));
      x = Math.round(start.x + (start.w - w));
    }
    if (dir.includes("n")) {
      h = Math.max(40, Math.round(start.h - dy));
      y = Math.round(start.y + (start.h - h));
    }

    if (x < 0) {
      w = Math.max(60, w + x);
      x = 0;
    }
    if (y < 0) {
      h = Math.max(40, h + y);
      y = 0;
    }

    if (snapToGrid) {
      x = Math.max(0, snapValue(x));
      y = Math.max(0, snapValue(y));
      w = Math.max(60, snapValue(w));
      h = Math.max(40, snapValue(h));
    }

    btn.x = x;
    btn.y = y;
    btn.w = w;
    btn.h = h;
    el.style.left = `${btn.x}px`;
    el.style.top = `${btn.y}px`;
    el.style.width = `${btn.w}px`;
    el.style.height = `${btn.h}px`;
    ensureCanvasBounds();
    syncInspector();
  }

  function up() {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    manipulatingLayout = false;
    refreshDirtyState();
  }

  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}

function addLog(text) {
  const list = document.getElementById("logList");
  if (!list) return;

  const el = document.createElement("div");
  el.className = "logItem";
  el.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
  list.prepend(el);

  while (list.children.length > 100) {
    list.removeChild(list.lastChild);
  }
}

async function saveLayout() {
  const res = await fetch("/api/layout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout),
  });

  if (!res.ok) {
    const text = await res.text();
    showSaveToast(`Save failed: ${text}`, true);
    return;
  }

  layoutBaseline = JSON.stringify(layout);
  refreshDirtyState();
  showSaveToast("Layout saved (Ctrl+S)");
}

function deleteSelectedButton() {
  if (!editMode || !selectedEditButtonId) return;
  const selected = layout.buttons.find(
    (btn) => String(btn.id) === String(selectedEditButtonId),
  );
  if (!selected) return;

  const ok = window.confirm(`Delete "${selected.label}"?`);
  if (!ok) return;

  layout.buttons = layout.buttons.filter(
    (btn) => String(btn.id) !== String(selectedEditButtonId),
  );
  if (String(activeButtonId) === String(selectedEditButtonId)) {
    activeButtonId = null;
    localStorage.removeItem("activeButtonId");
  }
  selectedEditButtonId = null;
  refreshDirtyState();
  render();
}

function initDockActions() {
  const dock = document.getElementById("editBar");
  if (!dock) return;

  dock.addEventListener("click", (event) => {
    const actionItem = event.target.closest("[data-tool-action]");
    if (!actionItem) return;

    const action = actionItem.dataset.toolAction;
    if (action === "add") addButton();
    if (action === "add-label") addLabelBox();
    if (action === "add-image") document.getElementById("imagePicker")?.click();
    if (action === "set-mode-move") setEditToolMode("move");
    if (action === "set-mode-resize") setEditToolMode("resize");
    if (action === "save") saveLayout();
    if (action === "delete") deleteSelectedButton();
    if (action === "toggle-edit") toggleEdit(!editMode);
    if (action === "clear-active") {
      activeButtonId = null;
      localStorage.removeItem("activeButtonId");
      render();
    }
    if (action === "toggle-connections") {
      setSidebarTab("connections");
    }
    if (action === "toggle-logs") {
      setSidebarTab("logs");
    }
    if (action === "shortcuts") {
      alert("Shortcuts:\nG = Toggle Edit\nC = Clear Active\nCtrl+N = New Button\nCtrl+S = Save Layout");
    }
  });
}

function setSidebarTab(tab) {
  const showLogs = tab !== "connections";
  const connectionsPane = document.getElementById("connections-panel");
  const logsPane = document.getElementById("logPanel");
  const tabConnections = document.getElementById("tabConnections");
  const tabLogs = document.getElementById("tabLogs");
  const footer = document.querySelector(".right-footer");
  if (!connectionsPane || !logsPane || !tabConnections || !tabLogs) return;

  connectionsPane.classList.toggle("active", !showLogs);
  logsPane.classList.toggle("active", showLogs);
  tabConnections.classList.toggle("active", !showLogs);
  tabLogs.classList.toggle("active", showLogs);
  tabConnections.setAttribute("aria-selected", showLogs ? "false" : "true");
  tabLogs.setAttribute("aria-selected", showLogs ? "true" : "false");
  footer?.classList.toggle("hidden", showLogs);
}

function initSidebarTabs() {
  const tabConnections = document.getElementById("tabConnections");
  const tabLogs = document.getElementById("tabLogs");
  const addDeviceBtn = document.getElementById("addDeviceBtn");
  const deleteDeviceBtn = document.getElementById("deleteDeviceBtn");

  tabConnections?.addEventListener("click", () => setSidebarTab("connections"));
  tabLogs?.addEventListener("click", () => setSidebarTab("logs"));

  addDeviceBtn?.addEventListener("click", () => {
    setSidebarTab("connections");
    window.connectionsUi?.openEditor?.(true);
  });

  deleteDeviceBtn?.addEventListener("click", () => {
    setSidebarTab("connections");
    window.connectionsUi?.promptDelete?.();
  });

  // Default first load state per requirement: logs tab visible.
  setSidebarTab("logs");
}

setInterval(async () => {
  try {
    const res = await fetch("/api/status");
    const status = await res.json();
    const nextRunning = !!status.running;
    if (!manipulatingLayout && nextRunning !== systemRunning) {
      systemRunning = nextRunning;
      render();
    } else {
      systemRunning = nextRunning;
    }
  } catch {}
}, 700);

if (window.socket) {
  window.socket.on("cueTriggered", (data) => {
    addLog(`Cue running: ${data.cue}`);
  });

  window.socket.on("buttonTriggered", (data) => {
    addLog(`Button triggered: ${data.label}`);
  });

  window.socket.on("deviceLog", (data) => {
    addLog(`${String(data.device || "").toUpperCase()}: ${data.message}`);
  });
}

bindInspector();
restoreDockPosition();
initDockDrag();
initDockOptions();
initDockActions();
initSidebarTabs();
initScrollControl();
initCanvasSettings();
initImagePicker();
setEditToolMode("move");
toggleEdit(false);
loadLayout();
