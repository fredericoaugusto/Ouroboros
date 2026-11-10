const { fontFamily } = require("tailwindcss/defaultTheme")

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './public/**/*.html'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", ...fontFamily.sans],
        mono: ["var(--font-geist-mono)", ...fontFamily.mono],
      },
      gridTemplateColumns: {
        '15': 'repeat(15, minmax(0, 1fr))',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'bright-pulse': {
          '0%, 100%': {
            filter: 'drop-shadow(0 0 2px #10b981)',
            transform: 'scale(1)'
          },
          '50%': {
            filter: 'drop-shadow(0 0 6px #10b981)',
            transform: 'scale(1.08)'
          }
        }
      },
      animation: {
        float: 'float 3s ease-in-out infinite',
        'bright-pulse': 'bright-pulse 2s ease-in-out infinite',
      },
      colors: {
        // Nova Identidade Visual Estudei / Bússola Notes
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981', // Verde esmeralda primário
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        indigoBrand: {
          500: '#6366f1',
          600: '#4f46e5',
        },
        // Tokens de Dark Mode Profundo
        darkCanvas: '#0b1320',  // Fundo principal
        darkCard: '#131f33',    // Cartões e painéis
        darkCardHover: '#182740',
        darkBorder: '#1f304a',  // Linhas sutis
        darkBorderSubtle: '#18263c',
        // Mapeamento de retrocompatibilidade para componentes que ainda usam gold-
        gold: {
          '50': '#ecfdf5',
          '100': '#d1fae5',
          '200': '#a7f3d0',
          '300': '#6ee7b7',
          '400': '#34d399',
          '500': '#10b981', // Mapeado para o Emerald limpo
          '600': '#059669',
          '700': '#047857',
          '800': '#065f46',
          '900': '#064e3b',
          '950': '#022c22',
        },
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}
