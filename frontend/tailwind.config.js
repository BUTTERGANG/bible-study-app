/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        parchment: '#fdf6e3',
        'parchment-dark': '#f5ead0',
        highlight: {
          yellow: '#fef08a',
          blue: '#bfdbfe',
          green: '#bbf7d0',
          pink: '#fbcfe8',
          orange: '#fed7aa',
        },
      },
    },
  },
  plugins: [],
}
