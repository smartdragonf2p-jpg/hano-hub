import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    // Aquí es donde Tailwind busca tus archivos para ponerles color
    "./app/**/*.{js,ts,jsx,tsx,mdx}", 
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
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
          cream: '#FDF5E6',    // Crema
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