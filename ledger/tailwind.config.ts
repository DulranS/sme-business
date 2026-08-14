import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: {
        'xs': '480px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
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
      spacing: {
        'fluid-sm': 'clamp(8px, 1.5vw, 12px)',
        'fluid-md': 'clamp(12px, 2vw, 20px)',
        'fluid-lg': 'clamp(16px, 3vw, 24px)',
        'fluid-xl': 'clamp(24px, 4vw, 32px)',
      },
      fontSize: {
        'fluid-xs': 'clamp(12px, 1vw, 14px)',
        'fluid-sm': 'clamp(14px, 1.5vw, 16px)',
        'fluid-base': 'clamp(16px, 2vw, 18px)',
        'fluid-lg': 'clamp(18px, 2.5vw, 24px)',
        'fluid-xl': 'clamp(20px, 3vw, 28px)',
        'fluid-2xl': 'clamp(24px, 4vw, 32px)',
      },
    },
  },
  plugins: [],
};
export default config;
