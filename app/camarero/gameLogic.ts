import { CATEGORIAS, generarMazoCocina, generarMazoPedidos } from "./constants";

export type Categoria = (typeof CATEGORIAS)[number];
type TipoCarta = "pedido" | "cocina";

export type CartaBase = {
  id: string;
  categoria: Categoria;
  plato: string;
  variante: string;
  tipo: TipoCarta;
};

export type PedidoCarta = CartaBase & { tipo: "pedido"; servido?: boolean };
export type CocinaCarta = CartaBase & { tipo: "cocina" };

export type JugadorEstado = {
  uid: string;
  nombre: string;
  foto?: string | null;
  pedido: PedidoCarta[];
  puntos: number;
  quejas: number;
};

export type MesaEstado = {
  centro: CocinaCarta[];
  mazoCocina: CocinaCarta[];
  mazoPedidos: PedidoCarta[];
  // Cartas de pedido que se revelaron (plato visible) para referencia en mesa
  reveladas: PedidoCarta[];
  // Pila de descarte visible (opcional para historial/inspección)
  descarte?: CocinaCarta[];
};

export type PartidaEstado = {
  estado: "ESPERANDO" | "EN_CURSO" | "FIN";
  jugadores: Record<string, JugadorEstado>;
  ordenTurnos: string[];
  turnoActual: string | null;
  mesa: MesaEstado;
  historial?: string;
};

export type AccionResult = {
  estado: PartidaEstado;
  puntosAplicados: Record<string, number>;
  quejasAplicadas: Record<string, number>;
  mensaje?: string;
};

// Puntuación
export const PUNTOS_ACIERTO_TOTAL = 3; // servir o acertar con timbre (plato + variante)
export const PUNTOS_DESCARTE_SIN_DUDA = 1;
export const PENALIZACION_QUEJA = -2;

const shuffle = <T>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

const takeOne = <T>(list: T[]): [T | undefined, T[]] => {
  if (list.length === 0) return [undefined, list];
  const [first, ...rest] = list;
  return [first, rest];
};

const aplicaPuntosYQuejas = (
  estado: PartidaEstado,
  puntos: Record<string, number>,
  quejas: Record<string, number>
) => {
  const nuevo = structuredClone(estado) as PartidaEstado;
  Object.entries(puntos).forEach(([uid, pts]) => {
    if (nuevo.jugadores[uid]) nuevo.jugadores[uid].puntos += pts;
  });
  Object.entries(quejas).forEach(([uid, q]) => {
    if (nuevo.jugadores[uid]) nuevo.jugadores[uid].quejas += q;
  });
  return nuevo;
};

/** Máximo de descartes permitidos por turno según cantidad de jugadores */
export const maxDescartesPorTurno = (jugadores: number) => {
  if (jugadores <= 4) return 3;
  if (jugadores <= 6) return 2;
  return 1; // 7 a 10
};

type JugadorConectado = { uid: string; nombre: string; foto?: string | null };

/**
 * Reparte 1 carta por categoría a cada jugador y arma la mesa (8 cartas de cocina).
 * Devuelve el estado listo para comenzar la partida.
 */
export const crearEstadoInicial = (conectados: JugadorConectado[]): PartidaEstado => {
  if (conectados.length < 3 || conectados.length > 10) {
    throw new Error("La partida requiere entre 3 y 10 jugadores.");
  }

  const mazoPedidos = shuffle(generarMazoPedidos());
  const mazoCocina = shuffle(generarMazoCocina());

  // Repartimos 1 carta por categoría para cada jugador
  const pedidosRestantes = [...mazoPedidos];
  const jugadores: Record<string, JugadorEstado> = {};

  conectados.forEach(({ uid, nombre, foto }) => {
    const mano: PedidoCarta[] = [];
    CATEGORIAS.forEach((cat) => {
      const idx = pedidosRestantes.findIndex((c) => c.categoria === cat);
      if (idx === -1) {
        throw new Error(`No hay suficientes cartas de la categoría ${cat} para repartir.`);
      }
      const [carta] = pedidosRestantes.splice(idx, 1);
      if (carta) {
        mano.push({ ...carta, tipo: "pedido", servido: false });
      }
    });

    jugadores[uid] = {
      uid,
      nombre,
      foto,
      pedido: mano,
      puntos: 0,
      quejas: 0,
    };
  });

  // Mesa: 8 cartas de cocina visibles
  const centro: CocinaCarta[] = [];
  let mazoCocinaRestante = [...mazoCocina];
  for (let i = 0; i < 8; i++) {
    const [carta, resto] = takeOne(mazoCocinaRestante);
    mazoCocinaRestante = resto;
    if (carta) centro.push({ ...carta, tipo: "cocina" });
  }

  const ordenTurnos = shuffle(conectados.map((c) => c.uid));

  return {
    estado: "EN_CURSO",
    jugadores,
    ordenTurnos,
    turnoActual: ordenTurnos[0] ?? null,
    mesa: {
      centro,
      mazoCocina: mazoCocinaRestante,
      mazoPedidos: pedidosRestantes,
      reveladas: [],
      descarte: [],
    },
    historial: "La partida ha comenzado.",
  };
};

type DudaResultado = {
  estado: PartidaEstado;
  puntosGanados: number;
  quejas: Record<string, number>; // uid -> delta de quejas (negativo)
  cartaAcertada?: { uid: string; carta: PedidoCarta; aciertoTotal: boolean };
  cartaRevelada?: { uid: string; carta: PedidoCarta; aciertoTotal: boolean };
};

const aplicarDudaSobreCarta = ({
  estado,
  uidAcusa,
  uidObjetivo,
  categoria,
  plato,
  variante,
  esDescartar,
  uidDescarta,
}: {
  estado: PartidaEstado;
  uidAcusa: string;
  uidObjetivo: string;
  categoria: Categoria;
  plato: string;
  variante: string;
  esDescartar: boolean;
  uidDescarta?: string;
}): DudaResultado => {
  const nuevo = structuredClone(estado) as PartidaEstado;
  const quejas: Record<string, number> = {};
  let puntosGanados = 0;
  const jugadorObj = nuevo.jugadores[uidObjetivo];
  if (!jugadorObj) return { estado: nuevo, puntosGanados, quejas };

  const carta = jugadorObj.pedido.find(
    (c) => c.categoria === categoria && !c.servido
  );
  if (!carta) {
    // No la tiene => acusación errada
    quejas[uidAcusa] = (quejas[uidAcusa] || 0) + 1;
    return { estado: nuevo, puntosGanados, quejas };
  }

  const aciertaPlato = carta.plato === plato;
  const aciertaVariante = carta.variante === variante;

  // Revelamos el plato (aunque la variante no sea correcta)
  carta.servido = aciertaPlato && aciertaVariante;
  nuevo.mesa.reveladas.push({ ...carta });

  if (aciertaPlato && aciertaVariante) {
    puntosGanados = PUNTOS_ACIERTO_TOTAL;
    // Carta se considera servida/entregada; no más penalización
    if (esDescartar && uidDescarta) {
      // Si estaban descartando y acerté, el que descartaba se lleva queja
      quejas[uidDescarta] = (quejas[uidDescarta] || 0) + 1;
    }
  } else if (aciertaPlato && !aciertaVariante) {
    // Acierta plato pero no variante: ficha de queja para acusador
    quejas[uidAcusa] = (quejas[uidAcusa] || 0) + 1;
  } else {
    // No acierta ni plato: ficha de queja para acusador
    quejas[uidAcusa] = (quejas[uidAcusa] || 0) + 1;
  }

  // Si era descarte y se acertó plato+variante, la carta va al acertador (se la lleva)
  if (esDescartar && aciertaPlato && aciertaVariante) {
    const idx = jugadorObj.pedido.findIndex((c) => c.id === carta.id);
    if (idx >= 0) jugadorObj.pedido.splice(idx, 1);
    const ganador = nuevo.jugadores[uidAcusa];
    if (ganador) {
      ganador.pedido.push({ ...carta, servido: true });
    }
  }

  return {
    estado: nuevo,
    puntosGanados,
    quejas,
    cartaAcertada: aciertaPlato
      ? { uid: uidObjetivo, carta, aciertoTotal: aciertaPlato && aciertaVariante }
      : undefined,
    cartaRevelada: { uid: uidObjetivo, carta, aciertoTotal: aciertaPlato && aciertaVariante },
  };
};

export const procesarDudas = ({
  estado,
  dudas,
  objetivo,
  categoria,
  plato,
  variante,
  esDescartar,
  uidDescarta,
}: {
  estado: PartidaEstado;
  dudas: string[]; // orden de timbre (último primero)
  objetivo: string;
  categoria: Categoria;
  plato: string;
  variante: string;
  esDescartar: boolean;
  uidDescarta?: string;
}) => {
  let current = estado;
  const puntos: Record<string, number> = {};
  const quejas: Record<string, number> = {};

  for (const uidAcusa of dudas) {
    const { estado: nuevo, puntosGanados, quejas: q } = aplicarDudaSobreCarta({
      estado: current,
      uidAcusa,
      uidObjetivo: objetivo,
      categoria,
      plato,
      variante,
      esDescartar,
      uidDescarta,
    });

    current = nuevo;
    if (puntosGanados > 0) {
      puntos[uidAcusa] = (puntos[uidAcusa] || 0) + puntosGanados;
      break; // alguien acertó; no seguimos dudando
    }

    // acumular quejas
    Object.entries(q).forEach(([uid, delta]) => {
      quejas[uid] = (quejas[uid] || 0) + delta;
    });
  }

  return { estado: current, puntos, quejas };
};

const avanzarTurno = (estado: PartidaEstado): PartidaEstado => {
  const nuevo = structuredClone(estado) as PartidaEstado;
  if (!nuevo.turnoActual) return nuevo;
  const idx = nuevo.ordenTurnos.indexOf(nuevo.turnoActual);
  const nextIdx = (idx + 1) % nuevo.ordenTurnos.length;
  nuevo.turnoActual = nuevo.ordenTurnos[nextIdx];
  return nuevo;
};

export const accionServir = ({
  estado,
  servidorUid,
  objetivoUid,
  categoria,
  plato,
  variante,
  dudasOrden,
}: {
  estado: PartidaEstado;
  servidorUid: string;
  objetivoUid: string;
  categoria: Categoria;
  plato: string;
  variante: string;
  dudasOrden: string[]; // último que tocó timbre va primero en el array
}): AccionResult => {
  let current = structuredClone(estado) as PartidaEstado;
  const puntos: Record<string, number> = {};
  const quejas: Record<string, number> = {};
  let mensaje = "";

  // Procesar dudas primero
  if (dudasOrden.length > 0) {
    const { estado: nuevo, puntos: pts, quejas: q } = procesarDudas({
      estado: current,
      dudas: dudasOrden,
      objetivo: objetivoUid,
      categoria,
      plato,
      variante,
      esDescartar: false,
    });
    current = nuevo;
    Object.entries(pts).forEach(([u, v]) => (puntos[u] = (puntos[u] || 0) + v));
    Object.entries(q).forEach(([u, v]) => (quejas[u] = (quejas[u] || 0) + v));

    if (Object.keys(pts).length > 0) {
      // Alguien acertó con timbre, terminamos acción
      const aplicado = aplicaPuntosYQuejas(current, puntos, quejas);
      return { estado: avanzarTurno(aplicado), puntosAplicados: puntos, quejasAplicadas: quejas, mensaje };
    }
  }

  // Sin dudas exitosas, resolvemos la jugada declarada
  const jugadorObjetivo = current.jugadores[objetivoUid];
  if (!jugadorObjetivo) {
    quejas[servidorUid] = (quejas[servidorUid] || 0) + 1;
    mensaje = "Objetivo inválido";
  } else {
    const carta = jugadorObjetivo.pedido.find((c) => c.categoria === categoria && !c.servido);
    if (!carta) {
      // No tiene carta de esa categoría sin servir
      quejas[servidorUid] = (quejas[servidorUid] || 0) + 1;
      mensaje = "El jugador no tenía ese plato";
    } else {
      const aciertaPlato = carta.plato === plato;
      const aciertaVariante = carta.variante === variante;
      if (aciertaPlato && aciertaVariante) {
        carta.servido = true;
        current.mesa.reveladas.push({ ...carta });
        puntos[servidorUid] = (puntos[servidorUid] || 0) + PUNTOS_ACIERTO_TOTAL;
        mensaje = "Plato servido correctamente";
      } else if (aciertaPlato && !aciertaVariante) {
        current.mesa.reveladas.push({ ...carta, servido: false });
        quejas[servidorUid] = (quejas[servidorUid] || 0) + 1;
        mensaje = "Plato correcto, variante incorrecta";
      } else {
        // No acierta plato: no se revela la carta
        quejas[servidorUid] = (quejas[servidorUid] || 0) + 1;
        mensaje = "Plato incorrecto";
      }
    }
  }

  const aplicado = aplicaPuntosYQuejas(current, puntos, quejas);
  return { estado: avanzarTurno(aplicado), puntosAplicados: puntos, quejasAplicadas: quejas, mensaje };
};

export const accionDescartar = ({
  estado,
  jugadorUid,
  cocinaCardId,
  dudasOrden,
}: {
  estado: PartidaEstado;
  jugadorUid: string;
  cocinaCardId: string;
  dudasOrden: string[]; // último timbre primero
}): AccionResult => {
  let current = structuredClone(estado) as PartidaEstado;
  const puntos: Record<string, number> = {};
  const quejas: Record<string, number> = {};
  let mensaje = "";

  // Tomamos la carta de cocina seleccionada
  const idxCentro = current.mesa.centro.findIndex((c) => c.id === cocinaCardId);
  if (idxCentro === -1) {
    mensaje = "Carta de cocina no encontrada";
    return { estado: current, puntosAplicados: puntos, quejasAplicadas: quejas, mensaje };
  }
  const [cartaDescartada] = current.mesa.centro.splice(idxCentro, 1);

  // Procesar dudas sobre descarte (objetivo es quien duda: reclama que es su plato)
  if (dudasOrden.length > 0) {
    for (const uidAcusa of dudasOrden) {
      const { estado: nuevo, puntos: pts, quejas: q } = procesarDudas({
        estado: current,
        dudas: [uidAcusa], // uno por vez, en orden
        objetivo: uidAcusa, // reclama que es suyo
        categoria: cartaDescartada.categoria,
        plato: cartaDescartada.plato,
        variante: cartaDescartada.variante,
        esDescartar: true,
        uidDescarta: jugadorUid,
      });
      current = nuevo;
      Object.entries(pts).forEach(([u, v]) => (puntos[u] = (puntos[u] || 0) + v));
      Object.entries(q).forEach(([u, v]) => (quejas[u] = (quejas[u] || 0) + v));

      if (Object.keys(pts).length > 0) {
        // alguien acertó, detenemos dudas
        break;
      }
    }
  }

  // Si nadie acertó con dudas, el descarte otorga 1 punto al jugador
  if (Object.keys(puntos).length === 0) {
    puntos[jugadorUid] = (puntos[jugadorUid] || 0) + PUNTOS_DESCARTE_SIN_DUDA;
  }

  // La carta va al descarte visible
  current.mesa.descarte = current.mesa.descarte || [];
  current.mesa.descarte.push(cartaDescartada);

  // Reponer en mesa si hay mazo
  const [nueva, resto] = takeOne(current.mesa.mazoCocina);
  current.mesa.mazoCocina = resto;
  if (nueva) current.mesa.centro.push(nueva);
  else current.estado = "FIN"; // se acabó mazo de cocina

  const aplicado = aplicaPuntosYQuejas(current, puntos, quejas);
  return { estado: avanzarTurno(aplicado), puntosAplicados: puntos, quejasAplicadas: quejas, mensaje };
};
