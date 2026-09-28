import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-lato)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      // Site inteiro em Lato Black: toda utilidade de peso de fonte
      // (font-medium, font-bold etc.) resolve pro mesmo peso 900.
      fontWeight: {
        thin: "900",
        extralight: "900",
        light: "900",
        normal: "900",
        medium: "900",
        semibold: "900",
        bold: "900",
        extrabold: "900",
        black: "900",
      },
      colors: {
        brand: {
          DEFAULT: "#1d4ed8",
          dark: "#0f2f8f",
          light: "#3b82f6",
        },
        accent: {
          DEFAULT: "#2563eb",
          light: "#60a5fa",
        },
      },
      boxShadow: {
        brand: "0 10px 30px -10px rgb(29 78 216 / 0.35)",
      },
    },
  },
  plugins: [],
};
export default config;
