import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0E14",
        panel: "#12161F",
        panel2: "#171C28",
        line: "#262C3A",
        muted: "#8A92A6",
        fg: "#E8E6E1",
        amber: {
          DEFAULT: "#C97C3D",
          soft: "#E0A467",
          dim: "#8A5A34",
        },
        good: "#4C9A6A",
        bad: "#C0525A",
        info: "#5B87C9",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "10px",
      },
    },
  },
  plugins: [],
};
export default config;
