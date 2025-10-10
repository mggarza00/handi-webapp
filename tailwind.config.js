/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        homaid: {
          primary: '#11304A',
          green: '#3e9554',
        },
        brand: {
          primary: '#2563EB',
          accent: '#F59E0B',
          gray900: '#111827',
          gray500: '#6B7280',
        },
      },
      keyframes: {
        'fade-pulse': {
          '0%': { opacity: '0.6', transform: 'scale(1)' },
          '20%': { opacity: '1', transform: 'scale(1.01)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '40%': { opacity: '1', transform: 'scale(1.01)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-pulse': 'fade-pulse 1.2s ease-out 1',
        // Class name requested: animate-popIn_1.2s_ease_1
        'popIn_1.2s_ease_1': 'popIn 1.2s ease 1',
      },
      fontFamily: {
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
        varela: ["var(--font-varela)", "system-ui", "sans-serif"],
        concert: ["var(--font-concert)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
