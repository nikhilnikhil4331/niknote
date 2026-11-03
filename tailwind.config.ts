import type { Config } from "tailwindcss";

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
        brand: {

            coral: 'hsl(var(--brand-coral))',
            'coral-deep': 'hsl(var(--brand-coral-deep))',
            blue: 'hsl(var(--brand-blue))',
            'blue-deep': 'hsl(var(--brand-blue-deep))',
            yellow: 'hsl(var(--brand-yellow))',
            'yellow-deep': 'hsl(var(--brand-yellow-deep))',
            cream: 'hsl(var(--brand-cream))',
            ink: 'hsl(var(--brand-ink))',
            'pink-wash': 'hsl(var(--brand-pink-wash))',
            'blue-wash': 'hsl(var(--brand-blue-wash))',
            'yellow-wash': 'hsl(var(--brand-yellow-wash))',
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        paper: {
          DEFAULT: "hsl(var(--paper))",
          ruled: "hsl(var(--paper-ruled))",
          foreground: "hsl(var(--paper-foreground))",
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
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
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
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Lilita One"', 'Inter', 'system-ui', 'sans-serif'],
        brand: ['"Lilita One"', 'Inter', 'system-ui', 'sans-serif'],
        handwriting: {
          1: ['Caveat', 'cursive'],
          2: ['Kalam', 'cursive'],
          3: ['Patrick Hand', 'cursive'],
          4: ['Shadows Into Light', 'cursive'],
          5: ['Indie Flower', 'cursive'],
          6: ['Dancing Script', 'cursive'],
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
