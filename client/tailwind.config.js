/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // brand color channels as rgb triplets — see :root in index.css
      colors: {
        brand: {
          bg: 'rgb(var(--color-bg) / <alpha-value>)',
          section: 'rgb(var(--color-section) / <alpha-value>)',
          header: 'rgb(var(--color-header) / <alpha-value>)',
          text: 'rgb(var(--color-text) / <alpha-value>)',
          primary: 'rgb(var(--color-primary) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'system-ui',
          'ui-sans-serif',
          'sans-serif',
        ],
      },

      // shared motion tokens — all transitions use these values for consistency
      transitionDuration: {
        fast: '60ms',
        base: '75ms',
        slow: '100ms',
        DEFAULT: '75ms',
      },
      transitionTimingFunction: {
        // smooth deceleration used for every interactive transition in the app
        brand: 'cubic-bezier(0.4, 0, 0.2, 1)',
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      // panel entrance animation — used when switching selected device
      keyframes: {
        panelEnter: {
          '0%': { opacity: '0', transform: 'translateY(5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        panelEnterDelayed: {
          '0%, 33%': { opacity: '0', transform: 'translateY(3px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        // section 1 — enters at t=0
        'panel-enter': 'panelEnter 75ms cubic-bezier(0.4, 0, 0.2, 1) both',
        // section 2 — starts 25ms after the panel opens
        'panel-enter-delay': 'panelEnterDelayed 100ms cubic-bezier(0.4, 0, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};
