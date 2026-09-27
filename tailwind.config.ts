import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1a1a1a",
          light: "#2d2d2d",
        },
        accent: {
          DEFAULT: "#c9a227",
          light: "#e0c158",
        },
      },
    },
  },
  plugins: [],
};
export default config;
