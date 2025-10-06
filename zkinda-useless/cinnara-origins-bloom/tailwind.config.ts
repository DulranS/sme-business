/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        
        // Custom Cinnara Origins colors
        "cinnamon-brown": "hsl(var(--cinnamon-brown))",
        "cinnamon-light": "hsl(var(--cinnamon-light))",
        "warm-cream": "hsl(var(--warm-cream))",
        "golden-accent": "hsl(var(--golden-accent))",
        "golden-light": "hsl(var(--golden-light))",
        "earth-tone": "hsl(var(--earth-tone))",
        "natural-green": "hsl(var(--natural-green))",
        "spice-amber": "hsl(var(--spice-amber))",
        "ceylon-gold": "hsl(var(--ceylon-gold))",
        "exotic-bronze": "hsl(var(--exotic-bronze))",
        cinnamon: "hsl(var(--cinnamon-brown))", // Alias for cinnamon-brown
      },
      fontFamily: {
        heading: ["var(--font-heading)", "serif"],
        subheading: ["var(--font-subheading)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        exotic: "var(--shadow-exotic)",
        luxury: "var(--shadow-luxury)",
        premium: "var(--shadow-premium)",
        glow: "var(--shadow-glow)",
      },
      backgroundImage: {
        "gradient-exotic": "var(--gradient-exotic)",
        "gradient-premium": "var(--gradient-premium)",
        "gradient-luxury": "var(--gradient-luxury)",
        "gradient-golden": "var(--gradient-golden)",
        "gradient-spice": "var(--gradient-spice)",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 3s infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
}