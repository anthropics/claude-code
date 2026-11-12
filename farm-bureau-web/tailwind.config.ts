import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "fb-green": {
          50: "#f0f9f0",
          100: "#dcf0dc",
          200: "#bae2bc",
          300: "#8ccc90",
          400: "#58ae5e",
          500: "#35913c",
          600: "#27742e",
          700: "#1f5c26",
          800: "#1c4921",
          900: "#173c1d",
        },
        "fb-gold": {
          400: "#e8b84b",
          500: "#d4a030",
          600: "#b8891f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
