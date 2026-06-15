/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0f',
        card: '#111118',
        border: '#1e1e2e',
        teal: '#14b8a6',
        muted: '#94a3b8',
      },
    },
  },
  plugins: [],
};
