/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        sidebar: "var(--color-sidebar)",
        surface: "var(--color-surface)",
        elevated: "var(--color-elevated)",
        primary: "var(--color-primary)",
        secondary: "var(--color-secondary)",
        green: "var(--color-green)",
        orange: "var(--color-orange)",
        text: "var(--color-text)",
        "text-secondary": "var(--color-text-secondary)",
        "text-muted": "var(--color-text-muted)",
        border: "var(--color-border)",
        hover: "var(--color-hover)",
        ai: "var(--color-ai)",
        "ai-glow": "var(--color-ai-glow)",
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        sparkle: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(0.95)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeInUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0, 200, 255, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 200, 255, 0.6)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s ease-in-out infinite',
        sparkle: 'sparkle 2s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
