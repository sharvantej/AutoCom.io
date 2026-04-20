# AutoCom - Desktop Control Dashboard

## Overview
AutoCom is a high-performance dashboard for live production and stage lighting control. It supports multiple protocols: OSC, Art-Net, DMX, RossTalk, UDP, TCP, WebSocket, and HTTP.

## Architecture
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS v4 + Radix UI (shadcn/ui)
- **Original Backend**: Rust (Tauri v2) - desktop app only; not available in web mode
- **Routing**: React Router 7
- **Animations**: Framer Motion

## Running in Replit
This project runs as a web-only frontend (the Rust/Tauri backend is not available in this environment). The frontend gracefully handles missing Tauri internals via the `isTauri()` check in `src/app/services/tauri.ts`.

## Development
- **Start**: `npm run web:dev` (runs Vite on port 5000)
- **Build**: `npm run web:build`
- **Test**: `npm run test:run`
- **Lint**: `npm run lint`

## Key Files
- `vite.config.js` - Vite configuration (port 5000, host 0.0.0.0, allowedHosts: true)
- `src/app/` - Main React app (routes, layout, pages, services, components)
- `src/app/pages/UserGuide.tsx` - Full User Guide with 9 sections (Overview, Projects, Connections, Dashboard Editor, Tasks, Button Mapping, Logs, Settings, Shortcuts)
- `src/app/pages/Projects.tsx` - Projects list with improved empty state when no projects exist
- `src/app/context/AppContext.tsx` - Global state with localStorage persistence (no Tauri needed)
- `src/app/services/tauri.ts` - Tauri IPC bridge with graceful web fallback
- `src-tauri/` - Rust/Tauri source (desktop only, not used in Replit)

## Web-Mode Data Persistence
All data is persisted to browser localStorage with these keys:
- `autocom.projects` - project list
- `autocom.connections` - device connections
- `autocom.logs` - application logs
- `autocom.project.dashboard.{id}` - per-project dashboard layouts
- `autocom.button-mapping.v1` - Stream Deck key mappings
- `autocom.theme`, `autocom.font`, `autocom.sidebarOpen` - UI preferences

## Deployment
Configured as a static site deployment:
- Build command: `npm run web:build`
- Public directory: `dist`
