// Definición de categorías y cartas base (50 platos, 2 variantes cada uno)
// Notas: se usan nombres con acentos originales; si se requiere ASCII, ajustar aquí.
export const CATEGORIAS = ["Entrada", "Plato Principal", "Guarnición", "Postre", "Bebida"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

type CartaBase = {
  categoria: Categoria;
  plato: string;
  variantes: [string, string];
};

export const CARTAS_BASE: CartaBase[] = [
  { categoria: "Entrada", plato: "Tortilla", variantes: ["Espinaca", "Jamón y Queso"] },
  { categoria: "Entrada", plato: "Empanada", variantes: ["Carne", "Humita"] },
  { categoria: "Entrada", plato: "Provoleta", variantes: ["Clásica", "Con Tomate"] },
  { categoria: "Entrada", plato: "Rabas", variantes: ["Provenzal", "Con Limón"] },
  { categoria: "Entrada", plato: "Chorizo", variantes: ["Cerdo", "Mezcla"] },
  { categoria: "Entrada", plato: "Mollejas", variantes: ["Al Verdeo", "Al Limón"] },
  { categoria: "Entrada", plato: "Bruschetta", variantes: ["Tradicional", "Jamón Crudo"] },
  { categoria: "Entrada", plato: "Matambre", variantes: ["Con Rusa", "Con Mix Verdes"] },
  { categoria: "Entrada", plato: "Berenjenas", variantes: ["Al Escabeche", "Al Aceite"] },
  { categoria: "Entrada", plato: "Revuelto", variantes: ["Gramajo", "De la Casa"] },

  { categoria: "Plato Principal", plato: "Milanesa", variantes: ["Napolitana", "Suiza"] },
  { categoria: "Plato Principal", plato: "Ravioles", variantes: ["Ricotta", "Verdura"] },
  { categoria: "Plato Principal", plato: "Sorrentinos", variantes: ["Jamón y Queso", "Calabaza"] },
  { categoria: "Plato Principal", plato: "Ñoquis", variantes: ["Papa", "Espinaca"] },
  { categoria: "Plato Principal", plato: "Pizza", variantes: ["Fugazzeta", "Margarita"] },
  { categoria: "Plato Principal", plato: "Risotto", variantes: ["Hongos", "Calabaza"] },
  { categoria: "Plato Principal", plato: "Bife de Lomo", variantes: ["Al Malbec", "Pimienta"] },
  { categoria: "Plato Principal", plato: "Canelones", variantes: ["Verdura", "Carne"] },
  { categoria: "Plato Principal", plato: "Lasagna", variantes: ["Carne", "Vegetariana"] },
  { categoria: "Plato Principal", plato: "Suprema", variantes: ["Maryland", "A la Crema"] },

  { categoria: "Guarnición", plato: "Papas Fritas", variantes: ["Bastón", "Rejilla"] },
  { categoria: "Guarnición", plato: "Puré", variantes: ["Papa", "Calabaza"] },
  { categoria: "Guarnición", plato: "Ensalada", variantes: ["Mixta", "Caprese"] },
  { categoria: "Guarnición", plato: "Vegetales", variantes: ["Grillados", "Al Vapor"] },
  { categoria: "Guarnición", plato: "Huevos", variantes: ["Fritos", "Revueltos"] },
  { categoria: "Guarnición", plato: "Arroz", variantes: ["Blanco", "Con Queso"] },
  { categoria: "Guarnición", plato: "Batatas", variantes: ["Al Horno", "Fritas"] },
  { categoria: "Guarnición", plato: "Chauchas", variantes: ["Al Huevo", "Salteadas"] },
  { categoria: "Guarnición", plato: "Calabaza", variantes: ["Al Horno", "Puré"] },
  { categoria: "Guarnición", plato: "Polenta", variantes: ["Con Tuco", "Con Queso"] },

  { categoria: "Postre", plato: "Helado", variantes: ["Chocolate", "Crema"] },
  { categoria: "Postre", plato: "Flan", variantes: ["Mixto", "Solo"] },
  { categoria: "Postre", plato: "Panqueque", variantes: ["Dulce de Leche", "Manzana"] },
  { categoria: "Postre", plato: "Vigilante", variantes: ["Batata", "Membrillo"] },
  { categoria: "Postre", plato: "Budín de Pan", variantes: ["Con Crema", "Solo"] },
  { categoria: "Postre", plato: "Mousse", variantes: ["Chocolate", "Frutilla"] },
  { categoria: "Postre", plato: "Fruta", variantes: ["Ensalada", "Asada"] },
  { categoria: "Postre", plato: "Cheesecake", variantes: ["Frutos Rojos", "Maracuyá"] },
  { categoria: "Postre", plato: "Tiramisú", variantes: ["Clásico", "Con Licor"] },
  { categoria: "Postre", plato: "Volcán", variantes: ["Chocolate", "Dulce de Leche"] },

  { categoria: "Bebida", plato: "Vino", variantes: ["Tinto", "Blanco"] },
  { categoria: "Bebida", plato: "Gaseosa", variantes: ["Cola", "Lima"] },
  { categoria: "Bebida", plato: "Cerveza", variantes: ["Rubia", "Roja"] },
  { categoria: "Bebida", plato: "Agua", variantes: ["Con Gas", "Sin Gas"] },
  { categoria: "Bebida", plato: "Jugo", variantes: ["Naranja", "Manzana"] },
  { categoria: "Bebida", plato: "Aperitivo", variantes: ["Fernet", "Vermú"] },
  { categoria: "Bebida", plato: "Café", variantes: ["Solo", "Cortado"] },
  { categoria: "Bebida", plato: "Té", variantes: ["Común", "Digestivo"] },
  { categoria: "Bebida", plato: "Limonada", variantes: ["Con Menta", "Con Jengibre"] },
  { categoria: "Bebida", plato: "Soda", variantes: ["Sifón", "Botella"] },
];

const slugify = (str: string) =>
  str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();

// Mazo para pedidos de los jugadores (tipo fijo "pedido")
export const generarMazoPedidos = () =>
  CARTAS_BASE.flatMap((item, platoIdx) =>
    item.variantes.map((variante, varIdx) => ({
      id: `pedido-${slugify(item.categoria)}-${slugify(item.plato)}-${varIdx}-${platoIdx}`,
      categoria: item.categoria,
      plato: item.plato,
      variante,
      tipo: "pedido" as const,
    }))
  ).sort(() => Math.random() - 0.5);

// Mazo para la cocina (tipo fijo "cocina")
export const generarMazoCocina = () =>
  CARTAS_BASE.flatMap((item, platoIdx) =>
    item.variantes.map((variante, varIdx) => ({
      id: `cocina-${slugify(item.categoria)}-${slugify(item.plato)}-${varIdx}-${platoIdx}`,
      categoria: item.categoria,
      plato: item.plato,
      variante,
      tipo: "cocina" as const,
    }))
  ).sort(() => Math.random() - 0.5);

// Alias para compatibilidad (usa el mazo de pedidos)
export const generarMazoOficial = generarMazoPedidos;
