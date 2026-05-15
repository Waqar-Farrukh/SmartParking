/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['Outfit', 'sans-serif'],
      },
      colors: {
        v3: {
          teal: '#00ced1',
          emerald: '#10b981',
          ruby: '#e11d48',
          gold: '#D9A13B',
          indigo: '#C26A5A',       // Terracotta (primary accent light mode)
          slate: '#0f172a',
          rose: '#f43f5e',
          violet: '#8b5cf6',
        },
        light: {
          bg: '#F9F6F0',           // Warm Oyster page background
          surface: '#FFFFFF',
          textPrimary: '#2C2A29',  // Primary text
          textSecondary: '#6B6259',// Secondary text
          tertiary: '#A39B93',     // Tertiary text
          accentPrimary: '#C26A5A',// Terracotta
          accentSecondary: '#6C8B8A',// Muted teal-sage
          card: '#FFFFFF',
          border: '#E5DFD7',       // Card border / dividers
          secured: '#F1E4DF',      // Secured badge background
          liveFeed: '#F0EBE3',     // Live feed background
        },
        dark: {
          bg: '#050505',
          surface: '#0f172a',
          textPrimary: '#ffffff',
          textSecondary: '#94a3b8',
          accentPrimary: '#00ced1',
          accentSecondary: '#10b981',
        },
        login: {
          bg: '#F4F2F5',           // Login page background
          container: '#FFFFFF',
          border: '#E8E2EA',       // Container border
          accent: '#C26A5A',       // Terracotta (Replaced Dusty Mauve)
          secondary: '#7C7A85',    // Labels / hints
          inputBorder: '#E0D9E2',  // Input border
          text: '#2A282F',         // Primary text
          textSecondary: '#6B6872',// Helper text
          placeholder: '#B0ABB5',  // Placeholder
          error: '#C26A5A',        // Terracotta
          divider: '#E8E2EA',      // Divider lines
        }
      },
      boxShadow: {
        'aesthetic': '0 8px 40px -8px rgba(194, 106, 90, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.04)',
        'vibrant': '0 20px 40px -10px rgba(194, 106, 90, 0.25)',
        'glow-indigo': '0 0 60px -10px rgba(194, 106, 90, 0.15)',
        'glow-teal': '0 0 60px -10px rgba(0, 206, 209, 0.15)',
      },
      animation: {
        'vibrant-pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-up': 'fadeUp 0.6s ease-out forwards',
        'scale-in': 'scaleIn 0.5s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(15px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}
