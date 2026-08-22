/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#EAEBE3',
        surface: '#F7F6F1',
        ink: '#1F2A24',
        inkfaint: '#5B6760',
        rule: '#C9CBB9',
        brass: '#B08D57',
        teal: '#2F5D62',
        brick: '#A6493D',
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
