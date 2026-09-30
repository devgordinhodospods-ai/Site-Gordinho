import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

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
      // Paleta tirada da logo (preto + ciano do "DosPod's"): a escala "blue"
      // do site inteiro vira a "sky" (azul claro), então bg-blue-50,
      // border-blue-100 etc. acompanham a marca sem mexer tela por tela.
      colors: {
        blue: colors.sky,
        brand: {
          DEFAULT: "#0ea5e9",
          dark: "#0284c7",
          light: "#38bdf8",
          ink: "#070b14",
          // Faixa do topo e rodapé. Pra voltar ao preto: "#000000".
          navy: "#0a2a5e",
        },
        accent: {
          DEFAULT: "#22d3ee",
          light: "#67e8f9",
        },
      },
      boxShadow: {
        brand: "0 10px 28px -10px rgb(14 165 233 / 0.55)",
      },
    },
  },
  plugins: [],
};
export default config;
