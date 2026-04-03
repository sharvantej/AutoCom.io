import { Suspense, lazy } from "react";
import { createBrowserRouter, Outlet } from "react-router";
import { AppProvider } from "./context/AppContext";
const Layout = lazy(() => import("./Layout"));
const Projects = lazy(() => import("./pages/Projects"));
const Connections = lazy(() => import("./pages/Connections"));
const Logs = lazy(() => import("./pages/Logs"));
const Settings = lazy(() => import("./pages/Settings"));
const Placeholder = lazy(() => import("./pages/Placeholder"));
const ProjectDashboard = lazy(() => import("./pages/ProjectDashboard"));

function UserGuidePage() { return <Placeholder title="User Guide" />; }
function RouteLoading() {
  return (
    <div className="h-full w-full flex items-center justify-center text-sm opacity-80">
      Loading...
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
          { path: "logs",             Component: Logs             },
          { path: "user-guide",       Component: UserGuidePage    },
          { path: "settings",         Component: Settings         },
        ],
      },
    ],
  },
]);
