import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#FAF8F5",
        ink: "#0D0D0D",
        muted: "#6B6762",
        line: "#E8E2D8",
        amber: {
          DEFAULT: "#C8852A",
          hover: "#B5741F",
          soft: "#F5E9D3",
        },
      },
      fontFamily: {
        display: ["var(--font-playfair)", "Georgia", "serif"],
        sans: [
          "var(--font-dm-sans)",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 10px 30px -12px rgba(13, 13, 13, 0.12)",
        card: "0 1px 2px rgba(13,13,13,0.04), 0 12px 40px -16px rgba(13,13,13,0.18)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        spinSlow: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 500ms ease-out both",
        spinSlow: "spinSlow 900ms linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
