/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        secondary: '#4F46E5',
        background: '#F8FAFC',
        surface: '#FFFFFF',
        border: '#E2E8F0',
        textMain: '#0F172A',
        textMuted: '#64748B',
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
