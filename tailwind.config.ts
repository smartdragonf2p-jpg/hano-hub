import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // Por si no usas la carpeta src, agregamos estas rutas también:
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-playfair)', 'serif'], 
        body: ['var(--font-lora)', 'serif'], 
      },
      colors: {
        'trattoria': {
          red: '#8B0000',      // Rojo sangre
          gold: '#D4AF37',     // Dorado antiguo
          cream: '#FDF5E6',    // Crema / Mantel viejo
          wood: '#3E2723',     // Madera oscura
          'wood-light': '#5D4037',
        }
      },
      backgroundImage: {
        'checkered-pattern': `repeating-linear-gradient(45deg, rgba(139, 0, 0, 0.1) 25%, transparent 25%, transparent 75%, rgba(139, 0, 0, 0.1) 75%, rgba(139, 0, 0, 0.1)), repeating-linear-gradient(45deg, rgba(139, 0, 0, 0.1) 25%, #0c0a09 25%, #0c0a09 75%, rgba(139, 0, 0, 0.1) 75%, rgba(139, 0, 0, 0.1))`,
      }
    },
  },
  plugins: [],
};
export default config;