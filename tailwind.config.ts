import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17231d",
        pitch: "#176b45",
        lime: "#d9f99d",
        paper: "#f8f7f1",
      },
      boxShadow: {
        card: "0 12px 32px rgba(23, 35, 29, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
