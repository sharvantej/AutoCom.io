/** @type {import("tailwindcss").Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "app-bg": "var(--color-background)",
        "sidebar-bg": "var(--color-sidebar)",
        "main-bg": "var(--color-card)",
        "button-bg": "var(--color-secondary)",
        "primary-text": "var(--color-foreground)",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
      },
      transitionDuration: {
        250: "250ms",
      },
    },
  },
  plugins: [],
};
