/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sentinel: {
          50: '#fdf0f0',
          100: '#fadcdc',
          200: '#f5b8b8',
          300: '#ed8d8d',
          400: '#e35f5f',
          500: '#dc143c',
          600: '#c01034',
          700: '#9e0d2a',
          800: '#820b23',
          900: '#6e0a1f',
          950: '#3d0511',
        },
        severity: {
          low: '#22c55e',
          moderate: '#f59e0b',
          high: '#ef4444',
          critical: '#991b1b',
        },
      },
    },
  },
  plugins: [],
};