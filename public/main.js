let layout = { buttons: [] };
let editMode = false;
let activeButtonId = localStorage.getItem("activeButtonId") || null;
let selectedEditButtonId = null;
let systemRunning = false;
let clickLock = false;
let layoutBaseline = "";
let layoutDirty = false;
let manipulatingLayout = false;
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

function normalizeButton(btn) {
  btn.x = clampInt(btn.x, 0, 0);
  btn.y = clampInt(btn.y, 0, 0);
  btn.w = clampInt(btn.w, 60, 160);
  btn.h = clampInt(btn.h, 40, 80);
  btn.fontSize = clampInt(btn.fontSize, 8, 20);
  btn.label = String(btn.label || "Button");
}

function selectedButton() {
  if (!selectedEditButtonId) return null;
  return (
    layout.buttons.find((btn) => String(btn.id) === String(selectedEditButtonId)) ||
    null
  );
}

function syncInspector() {
  const xInput = document.getElementById("btnXInput");
  const yInput = document.getElementById("btnYInput");
  const wInput = document.getElementById("btnWInput");
  const hInput = document.getElementById("btnHInput");
  const fsInput = document.getElementById("btnFsInput");
  if (!xInput || !yInput || !wInput || !hInput || !fsInput) return;

  const btn = selectedButton();
  const disabled = !editMode || !btn;
  [xInput, yInput, wInput, hInput, fsInput].forEach((input) => {
    input.disabled = disabled;
  });

  if (!btn) {
    xInput.value = "";
    yInput.value = "";
    wInput.value = "";
    hInput.value = "";
    fsInput.value = "";
    return;
  }

  normalizeButton(btn);
  xInput.value = String(btn.x);
  yInput.value = String(btn.y);
  wInput.value = String(btn.w);
  hInput.value = String(btn.h);
  fsInput.value = String(btn.fontSize || 20);
}

function bindInspector() {
  const xInput = document.getElementById("btnXInput");
  const yInput = document.getElementById("btnYInput");
  const wInput = document.getElementById("btnWInput");
  const hInput = document.getElementById("btnHInput");
  const fsInput = document.getElementById("btnFsInput");
  if (!xInput || !yInput || !wInput || !hInput || !fsInput) return;

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
    btn[field] = clampInt(source?.value, min, fallback);
    refreshDirtyState();
    render();
  };

  xInput.addEventListener("input", () => applyField("x", 0, 0));
  yInput.addEventListener("input", () => applyField("y", 0, 0));
  wInput.addEventListener("input", () => applyField("w", 60, 160));
  hInput.addEventListener("input", () => applyField("h", 40, 80));
  fsInput.addEventListener("input", () => applyField("fontSize", 8, 20));
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

function focusDashboard(target = "top") {
  const viewport = document.getElementById("dashboardViewport");
  if (!viewport) return;

  const btn = target === "selected" ? selectedButton() : null;
  if (btn) {
    viewport.scrollTo({
      left: Math.max(0, btn.x - 120),
      top: Math.max(0, btn.y - 120),
      behavior: "smooth",
    });
    return;
  }

  viewport.scrollTo({ left: 0, top: 0, behavior: "smooth" });
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

  const step = event.shiftKey ? 10 : 1;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    selected.x = Math.max(0, selected.x - step);
    refreshDirtyState();
    render();
    return;
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    selected.x = selected.x + step;
    refreshDirtyState();
    render();
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    selected.y = Math.max(0, selected.y - step);
    refreshDirtyState();
    render();
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    selected.y = selected.y + step;
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
  document.getElementById("editBar").style.display = editMode ? "flex" : "none";
  syncInspector();
  refreshDirtyState();
  render();
}

async function loadLayout() {
  const res = await fetch("/api/layout");
  layout = await res.json();
  layout.buttons = Array.isArray(layout.buttons) ? layout.buttons : [];
  layout.buttons.forEach((btn) => normalizeButton(btn));
  layoutBaseline = JSON.stringify(layout);
  refreshDirtyState();
  render();
}

function render() {
  const canvas = document.getElementById("canvas");
  canvas.innerHTML = "";

  for (const btn of layout.buttons) {
    normalizeButton(btn);
    const el = document.createElement("div");
    el.className = "tile";
    el.dataset.btnId = String(btn.id);
    el.innerText = btn.label;
    el.style.left = `${btn.x}px`;
    el.style.top = `${btn.y}px`;
    el.style.width = `${btn.w}px`;
    el.style.height = `${btn.h}px`;
    el.style.fontSize = `${btn.fontSize || 20}px`;

    const defaultColor = "#2ecc71";
    const activeColor = "#e74c3c";

    if (String(btn.id) === String(activeButtonId)) {
      el.style.background = activeColor;
      el.classList.add("active");
      if (systemRunning) el.classList.add("active-running");
    } else {
      el.style.background = btn.color || defaultColor;
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
        startDrag(event, btn, el);
      }
    };

    el.ondblclick = () => {
      if (editMode) editButton(btn);
    };

    const resizer = document.createElement("div");
    resizer.className = "resizer";
    resizer.onmousedown = (event) => startResize(event, btn, el);
    el.appendChild(resizer);

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
    label,
    x: 140,
    y: 140,
    w: 160,
    h: 80,
    fontSize: 20,
    color: "#2ecc71",
    tasks: [],
  });

  refreshDirtyState();
  selectedEditButtonId = String(layout.buttons[layout.buttons.length - 1].id);
  render();
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
      btn.label = updated.label;
      btn.color = updated.color;
      btn.x = clampInt(updated.x, 0, btn.x || 0);
      btn.y = clampInt(updated.y, 0, btn.y || 0);
      btn.w = clampInt(updated.w, 60, btn.w || 160);
      btn.h = clampInt(updated.h, 40, btn.h || 80);
      btn.fontSize = clampInt(updated.fontSize, 8, btn.fontSize || 20);
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
    btn.x = Math.max(0, Math.round(btn.x + (next.clientX - sx)));
    btn.y = Math.max(0, Math.round(btn.y + (next.clientY - sy)));
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

function startResize(event, btn, el) {
  event.stopPropagation();
  event.preventDefault();
  manipulatingLayout = true;
  let sx = event.clientX;
  let sy = event.clientY;

  function move(next) {
    btn.w = Math.max(60, Math.round(btn.w + (next.clientX - sx)));
    btn.h = Math.max(40, Math.round(btn.h + (next.clientY - sy)));
    el.style.width = `${btn.w}px`;
    el.style.height = `${btn.h}px`;
    sx = next.clientX;
    sy = next.clientY;
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
    alert(`Failed to save layout: ${text}`);
    return;
  }

  layoutBaseline = JSON.stringify(layout);
  refreshDirtyState();
  alert("Layout saved");
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

function initTopbarActions() {
  const topbar = document.getElementById("appTopbar");
  if (!topbar) return;

  topbar.addEventListener("click", (event) => {
    const actionItem = event.target.closest("[data-top-action]");
    if (!actionItem) return;

    const action = actionItem.dataset.topAction;
    if (action === "add") addButton();
    if (action === "save") saveLayout();
    if (action === "toggle-edit") toggleEdit(!editMode);
    if (action === "clear-active") {
      activeButtonId = null;
      localStorage.removeItem("activeButtonId");
      render();
    }
    if (action === "toggle-connections") {
      document.getElementById("connections-panel")?.classList.toggle("panel-hidden");
    }
    if (action === "toggle-logs") {
      document.getElementById("logPanel")?.classList.toggle("panel-hidden");
    }
    if (action === "focus-dashboard") {
      focusDashboard(editMode ? "selected" : "top");
    }
    if (action === "shortcuts") {
      alert("Shortcuts:\nG = Toggle Edit\nC = Clear Active\nCtrl+N = New Button\nCtrl+S = Save Layout");
    }
  });
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
loadLayout();
initTopbarActions();
