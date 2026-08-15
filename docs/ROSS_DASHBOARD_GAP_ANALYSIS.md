# AutoCom vs Ross DashBoard: Implementation Gap Analysis

## Goal
Make AutoCom competitive with Ross DashBoard in reliability, workflow depth, and operator productivity, without cloning the legacy platform.

## What We Learned From `DashBoard/`
- Ross DashBoard is a packaged Eclipse RCP + Java/SWT application with large plugin architecture (`plugins/`, `features/`, OSGi bundles).
- It includes a broad device/plugin ecosystem (camera control, XPression, routing, NDI, keymaps, touch UI, etc).
- It has a visual-logic/block model (`VisualLanguage/blocks/*.xml`) where blocks define:
  - typed arguments/widgets,
  - flow control (`top_flow`, `bottom_flow`, statements),
  - protocol/action translation strings.
- It ships as a heavy runtime (embedded JRE + Chromium + plugin stack), not a lightweight modern desktop shell.

## Current AutoCom Strengths (already solid)
- Modern native stack: Tauri + React + Rust.
- Strong protocol core in Rust (`osc`, `udp`, `tcp`, `http`, `ws`, `artnet`, `rosstalk`, `swp08`, `videohub`).
- Good connection model and per-device forms for key production devices.
- Rich task editor and per-device task catalogs (ATEM, vMix, OBS, RossTalk/XPression, Resolume, GrandMA2/3, X32, SWP08, Videohub, Companion Remote).
- Project dashboard editor with task list UX and button mapping.

## Main Gaps vs Ross (priority order)

## 1) Extensibility Model (Highest)
- Ross: plugin-first architecture with modular feature packages.
- AutoCom gap: device/task support is mostly hardcoded in app code.
- Impact: adding new device families is expensive and slower than Ross ecosystem growth.

Implementation target:
- Introduce a declarative **Device Capability Manifest** layer (JSON/YAML) for:
  - connection schema,
  - task catalog,
  - command builder templates,
  - validation rules.
- Keep Rust transport execution core; move UI/task metadata out of hardcoded TS branches.

## 2) Visual Logic / Automation Depth
- Ross: full visual block language including control flow and reusable logic blocks.
- AutoCom gap: task sequencing exists, but no generalized flow graph with conditions/branches/variables.
- Impact: less advanced automation and fewer reusable logic components.

Implementation target:
- Add **Workflow Graph v1**:
  - nodes: Trigger, Delay, Condition, HTTP/OSC/TCP action, Variable Set/Get.
  - edges: success/failure branch.
  - runtime: deterministic executor in Rust with step-level logging.

## 3) Enterprise Operations Features
- Ross includes licensing, update/site mechanisms, and broad workstation deployment behavior.
- AutoCom gap: no robust multi-user/project governance model (roles, approvals, audit trail).
- Impact: weaker fit for broadcast ops teams at scale.

Implementation target:
- Add **Ops Layer v1**:
  - immutable action log,
  - project export/import versioning,
  - optional role controls (operator/admin mode),
  - health dashboards for all active connections.

## 4) Device Ecosystem Breadth
- Ross has very wide integrations (camera vendor families, switchers, graphics, routing, etc).
- AutoCom currently covers key targets but fewer total families.
- Impact: some mixed environments still need Ross for niche endpoints.

Implementation target:
- Add integration packs by market demand:
  1. Camera PTZ common APIs (Sony/Panasonic baseline).
  2. Additional switcher/router adapters.
  3. Graphics rundown integration extensions.

## 5) Pro Operator UX Parity
- Ross has mature touch/operator workflows built over years.
- AutoCom gap: UserGuide is placeholder, onboarding and operator shortcuts are not yet “broadcast-grade complete”.
- Impact: steeper learning curve for new operators.

Implementation target:
- Complete in-app docs + guided setup:
  - device templates,
  - one-click connection test wizard,
  - failure diagnostics panel,
  - curated starter dashboards.

## Recommended Execution Plan

## Phase 1 (2-3 weeks): Foundation Refactor
1. Device Capability Manifest schema + loader.
2. Migrate 2 devices (e.g., `ross_talk`, `videohub`) from hardcoded UI rules to manifest-driven definitions.
3. Standardize command preview + validation API for all task types.

## Phase 2 (3-4 weeks): Workflow Graph v1
1. Graph data model + editor surface.
2. Rust graph executor (serial + conditional branching).
3. Per-step telemetry and execution replay in Logs page.

## Phase 3 (2-3 weeks): Ops Reliability
1. Connection health matrix page.
2. Action/audit timeline for task execution.
3. Project version snapshots + rollback.

## Phase 4 (ongoing): Integration Expansion
1. Build integration packs from manifest templates.
2. Add adapter test harness (simulated endpoints + protocol fixtures).
3. Publish compatibility matrix.

## Success Metrics
- Time to add a new device type reduced by >50%.
- Mean time to diagnose failed task reduced by >40%.
- 95th percentile task execution latency stable under production load.
- Operator onboarding: first successful automation setup in <15 minutes.

