/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        royal: {
          DEFAULT: '#4169E1',
          dark: '#2f52c8',
          light: '#6b8bff',
        },
        blush: {
          DEFAULT: '#F7A8C4',
          dark: '#f47fab',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
