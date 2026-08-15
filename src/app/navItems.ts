// Single source of truth for the app's primary navigation — used by the
// title-bar tabs (WindowStrip) and by Layout's page-heading lookup, so the
// heading shown per page can never drift out of sync with its tab label.

export type NavItem = {
  label: string;
  path: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Connections",    path: "/connections"    },
  { label: "Button Mapping", path: "/button-mapping" },
  { label: "Logs",           path: "/logs"           },
  { label: "User Guide",     path: "/user-guide"     },
  { label: "Settings",       path: "/settings"       },
];

export const DASHBOARD_LABEL = "Dashboard";
