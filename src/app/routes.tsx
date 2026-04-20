import { Suspense, lazy } from "react";
import { createBrowserRouter, Outlet } from "react-router";
import { AppProvider } from "./context/AppContext";

const importLayout = () => import("./Layout");
const importProjects = () => import("./pages/Projects");
const importConnections = () => import("./pages/Connections");
const importButtonMapping = () => import("./pages/ButtonMapping");
const importLogs = () => import("./pages/Logs");
const importSettings = () => import("./pages/Settings");
const importPlaceholder = () => import("./pages/Placeholder");
const importProjectDashboard = () => import("./pages/ProjectDashboard");

const Layout = lazy(importLayout);
const Projects = lazy(importProjects);
const Connections = lazy(importConnections);
const ButtonMapping = lazy(importButtonMapping);
const Logs = lazy(importLogs);
const Settings = lazy(importSettings);
const Placeholder = lazy(importPlaceholder);
const ProjectDashboard = lazy(importProjectDashboard);

let preloadPromise: Promise<unknown[]> | null = null;

export function preloadRouteChunks(): Promise<unknown[]> {
  if (!preloadPromise) {
    preloadPromise = Promise.allSettled([
      importLayout(),
      importProjects(),
      importConnections(),
      importButtonMapping(),
      importLogs(),
      importSettings(),
      importPlaceholder(),
      importProjectDashboard(),
    ]);
  }
  return preloadPromise;
}

function UserGuidePage() { return <Placeholder title="User Guide" />; }
function RouteLoading() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-sm opacity-80">
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-full animate-pulse rounded-full bg-white/30" />
      </div>
      <span>Loading dashboard...</span>
    </div>
  );
}

/**
 * AppRoot wraps the entire router tree with AppProvider.
 * This is the correct pattern for React Router Data mode — placing
 * the provider inside the router tree guarantees every route component
 * (including Layout) is always a descendant of the provider.
 */
function AppRoot() {
  return (
    <AppProvider>
      <Suspense fallback={<RouteLoading />}>
        <Outlet />
      </Suspense>
    </AppProvider>
  );
}

export const router = createBrowserRouter([
  {
    // Provider wrapper — no path, just wraps everything
    Component: AppRoot,
    children: [
      {
        path: "/",
        Component: Layout,
        children: [
          { index: true,              Component: Projects         },
          { path: "project/:id",      Component: ProjectDashboard },
          { path: "connections",      Component: Connections      },
          { path: "button-mapping",   Component: ButtonMapping    },
          { path: "logs",             Component: Logs             },
          { path: "user-guide",       Component: UserGuidePage    },
          { path: "settings",         Component: Settings         },
        ],
      },
    ],
  },
]);
