/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef4ff',
          100: '#dce8ff',
          500: '#4a8df8',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.4)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.5)',
        modal: '0 20px 60px rgba(0,0,0,0.8)',
      },
      animation: {
        'fade-in':    'fadeIn 0.15s ease',
        'slide-up':   'slideUp 0.2s ease',
        'slide-down': 'slideDown 0.2s ease',
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 },                to: { opacity: 1 } },
        slideUp:   { from: { transform: 'translateY(8px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
        slideDown: { from: { transform: 'translateY(-8px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
      },
    },
  },
  plugins: [],
};
