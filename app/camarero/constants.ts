export const CATEGORIAS = ["Entrada", "Plato Principal", "Guarnición", "Postre", "Bebida"];

export const DEFINICION_CARTAS = {
  "Entrada": { plato: "Tortilla", opciones: ["Espinaca", "Jamón y Queso"] },
  "Plato Principal": { plato: "Pasta", opciones: ["Ravioles", "Sorrentinos"] },
  "Guarnición": { plato: "Ensalada", opciones: ["Mixta", "Rusa"] },
  "Postre": { plato: "Helado", opciones: ["Crema", "Chocolate"] },
  "Bebida": { plato: "Gaseosa", opciones: ["Cola", "Lima"] }
};

export const generarMazoOficial = () => {
  let mazo = [];
  for (const cat of CATEGORIAS) {
    const config = DEFINICION_CARTAS[cat as keyof typeof DEFINICION_CARTAS];
    // 5 cartas de la Opción A
    for (let i = 0; i < 5; i++) {
      mazo.push({ id: `${cat}-A-${i}`, categoria: cat, plato: config.plato, variante: config.opciones[0] });
    }
    // 5 cartas de la Opción B
    for (let i = 0; i < 5; i++) {
      mazo.push({ id: `${cat}-B-${i}`, categoria: cat, plato: config.plato, variante: config.opciones[1] });
    }
  }
  return mazo.sort(() => Math.random() - 0.5); // Mezcla total
};