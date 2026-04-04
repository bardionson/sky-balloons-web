import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "#0b141a",
        surface_bright: "#313a41",
        surface_container: "#182127",
        surface_container_high: "#222b32",
        surface_container_highest: "#2d363d",
        surface_container_low: "#141d23",
        surface_container_lowest: "#060f15",
        surface_variant: "#2d363d",
        primary: "#87CEEB",
        primary_container: "#b4e8ff",
        on_primary: "#003544",
        secondary: "#c6c6c7",
        tertiary: "#39FF14",
        outline: "#899297",
        outline_variant: "#3f484c",
        error: "#ffb4ab",
        error_container: "#93000a",
        on_surface_variant: "#b0bec5",
        overlay_variant: "#dae4ec",
      },
      fontFamily: {
        sans: ["var(--font-inter)"],
        display: ["var(--font-space-grotesk)"],
        mono: ["var(--font-roboto-mono)"],
      },
    },
  },
  plugins: [],
};
export default config;
