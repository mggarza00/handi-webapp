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
      fontFamily: {
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
        varela: ["var(--font-varela)", "system-ui", "sans-serif"],
        concert: ["var(--font-concert)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
