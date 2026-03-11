/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        panel: "0 4px 16px rgba(23,52,82,.06)"
      }
    }
  },
  plugins: []
};
