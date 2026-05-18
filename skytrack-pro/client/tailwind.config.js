/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070C1A',
          900: '#0D1425',
          800: '#111827',
          700: '#162035',
          600: '#1A2540',
          500: '#1E2D4A',
          400: '#253656',
        },
        skyblue: {
          DEFAULT: '#00B4FF',
          dim: 'rgba(0,180,255,0.15)',
        },
      },
      fontFamily: {
        heading: ['Barlow Condensed', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
        body: ['Barlow', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
