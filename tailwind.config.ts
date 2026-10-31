import type { Config } from "tailwindcss";

/**
 * NikNote — Tailwind theme
 * All colour values resolve from CSS variables defined in
 * `src/styles/theme.css`. Components should use these semantic
 * classes instead of raw palette utilities.
 */
export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: {
          DEFAULT: "hsl(var(--border) / <alpha-value>)",
          subtle: "hsl(var(--border-subtle-hsl) / <alpha-value>)",
          active: "hsl(var(--border-active-hsl) / <alpha-value>)",
          strong: "hsl(var(--border-strong-hsl) / <alpha-value>)",
        },
        /* top-level aliases so border-subtle / ring-active / divide-subtle resolve */
        subtle: "hsl(var(--border-subtle-hsl) / <alpha-value>)",
        active: "hsl(var(--border-active-hsl) / <alpha-value>)",
        strong: "hsl(var(--border-strong-hsl) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: {
          DEFAULT: "hsl(var(--background) / <alpha-value>)",
          primary: "hsl(var(--background-primary-hsl) / <alpha-value>)",
          secondary: "hsl(var(--background-secondary-hsl) / <alpha-value>)",
          tertiary: "hsl(var(--background-tertiary-hsl) / <alpha-value>)",
        },
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        surface: {
          DEFAULT: "hsl(var(--surface-primary-hsl) / <alpha-value>)",
          primary: "hsl(var(--surface-primary-hsl) / <alpha-value>)",
          secondary: "hsl(var(--surface-secondary-hsl) / <alpha-value>)",
          elevated: "hsl(var(--surface-elevated-hsl) / <alpha-value>)",
          hover: "hsl(var(--surface-hover-hsl) / <alpha-value>)",
        },
        /* Text tokens — use text-fg-* / text-ink-* instead of gray-* */
        fg: {
          primary: "hsl(var(--text-primary-hsl) / <alpha-value>)",
          secondary: "hsl(var(--text-secondary-hsl) / <alpha-value>)",
          muted: "hsl(var(--text-muted-hsl) / <alpha-value>)",
          inverse: "hsl(var(--text-inverse-hsl) / <alpha-value>)",
        },
        paper: {
          DEFAULT: "hsl(var(--paper))",
          ruled: "hsl(var(--paper-ruled))",
          foreground: "hsl(var(--paper-foreground))",
          muted: "hsl(var(--paper-muted))",
          rule: "hsl(var(--paper-rule))",
        },
        ink: {
          blue: "hsl(var(--ink-blue))",
          black: "hsl(var(--ink-black))",
          "blue-light": "hsl(var(--ink-blue-light))",
          red: "hsl(var(--ink-red))",
          green: "hsl(var(--ink-green))",
          purple: "hsl(var(--ink-purple))",
          brown: "hsl(var(--ink-brown))",
          teal: "hsl(var(--ink-teal))",
          orange: "hsl(var(--ink-orange))",
        },
        line: "hsl(var(--line-color))",
        margin: "hsl(var(--margin-color))",
        toolbar: {
          DEFAULT: "hsl(var(--toolbar))",
          foreground: "hsl(var(--toolbar-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          hover: "hsl(var(--primary-hover-hsl) / <alpha-value>)",
          active: "hsl(var(--primary-active-hsl) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          primary: {
            DEFAULT: "hsl(var(--accent-primary-hsl) / <alpha-value>)",
            foreground: "hsl(var(--accent-primary-foreground-hsl) / <alpha-value>)",
          },
          secondary: {
            DEFAULT: "hsl(var(--accent-secondary-hsl) / <alpha-value>)",
            foreground: "hsl(var(--accent-secondary-foreground-hsl) / <alpha-value>)",
          },
          rose: "hsl(var(--accent-rose-hsl) / <alpha-value>)",
          warm: "hsl(var(--accent-warm-hsl) / <alpha-value>)",
          cool: "hsl(var(--accent-cool-hsl) / <alpha-value>)",
          "cool-solid": "hsl(var(--accent-cool-solid-hsl) / <alpha-value>)",
        },
        /* Sunset Plum raw palette — for gradients and brand moments */
        nk: {
          midnight: "#1B1931",
          purple: "#44174E",
          burgundy: "#662249",
          rose: "#A34054",
          amber: "#ED9E59",
          blush: "#E9BCB9",
          cream: "#FBF6F4",
          plum: {
            50: "#FDF7F5",
            100: "#F7E9E6",
            200: "#E9BCB9",
            300: "#D8A3A6",
            400: "#BF8590",
            500: "#A34054",
            600: "#8C3149",
            700: "#662249",
            800: "#44174E",
            900: "#2A1235",
            950: "#1B1931",
          },
          warm: {
            100: "#FBEAD7",
            200: "#F6D5B4",
            300: "#F2B987",
            400: "#ED9E59",
            500: "#D9822F",
            600: "#C4762F",
            700: "#9A5A14",
          },
          lilac: {
            100: "#F1E8F5",
            200: "#E0CDE8",
            300: "#C0A6DE",
            400: "#A688C9",
            500: "#7C5F9E",
            600: "#5C3A6E",
          },
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
        },
        error: {
          DEFAULT: "hsl(var(--error) / <alpha-value>)",
          foreground: "hsl(var(--error-foreground) / <alpha-value>)",
        },
        info: "hsl(var(--info) / <alpha-value>)",
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        sans: ["Inter", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
        handwriting: {
          1: ["Caveat", "cursive"],
          2: ["Kalam", "cursive"],
          3: ["Patrick Hand", "cursive"],
          4: ["Shadows Into Light", "cursive"],
          5: ["Indie Flower", "cursive"],
          6: ["Dancing Script", "cursive"],
        },
      },
      borderRadius: {
        xs: "6px",
        sm: "10px",
        DEFAULT: "12px",
        md: "14px",
        lg: "18px",
        xl: "24px",
        "2xl": "30px",
      },
      boxShadow: {
        "nk-xs": "var(--nk-shadow-xs)",
        "nk-sm": "var(--nk-shadow-sm)",
        "nk-md": "var(--nk-shadow-md)",
        "nk-lg": "var(--nk-shadow-lg)",
        "nk-focus": "var(--nk-shadow-focus)",
        "nk-glow": "0 0 0 1px hsl(var(--accent-primary-hsl) / 0.25), 0 10px 30px -12px hsl(var(--accent-primary-hsl) / 0.45)",
      },
      backgroundImage: {
        "nk-primary": "var(--nk-grad-primary)",
        "nk-secondary": "var(--nk-grad-secondary)",
        "nk-accent": "var(--nk-grad-accent)",
        "nk-soft": "var(--nk-grad-soft)",
        "nk-hero": "var(--nk-grad-hero)",
        "nk-sheen": "var(--nk-grad-sheen)",
      },
      transitionTimingFunction: {
        "nk-out": "cubic-bezier(0.22, 1, 0.36, 1)",
        "nk-in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        nk: "220ms",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "nk-shimmer": {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "nk-shimmer": "nk-shimmer 2s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
