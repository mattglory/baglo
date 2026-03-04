/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: "#00d4aa",
        "brand-alt": "#00b4d8",
      },
    },
  },
  plugins: [],
};
