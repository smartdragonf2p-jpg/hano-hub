'use client';

import { useEffect, useMemo, useState } from 'react';
import { db, auth } from '../lib/firebase';
import { ref, onValue, set, update, onDisconnect, get } from 'firebase/database';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  CARTAS_BASE,
  CATEGORIAS,
} from './constants';
import {
  PartidaEstado,
  Categoria,
  type CocinaCarta,
  crearEstadoInicial,
  accionServir,
  accionDescartar,
  maxDescartesPorTurno,
  PENALIZACION_QUEJA,
} from './gameLogic';
import Image from 'next/image';

type Conectado = { nombre: string; foto?: string | null; uid: string; joinedAt: number };
type AccionPendiente =
  | {
      tipo: "servir";
      servidorUid: string;
      objetivoUid: string;
      categoria: Categoria;
      plato: string;
      variante: string;
      dudas: string[];
      finVentana: number;
    }
  | {
      tipo: "descartar";
      servidorUid: string;
      cocinaCardId: string;
      categoria: Categoria;
      plato: string;
      variante: string;
      dudas: string[];
      finVentana: number;
    };
type SalaState = {
  conectados?: Record<string, Conectado>;
  juego?: PartidaEstado | null;
  estado?: string;
  accionPendiente?: AccionPendiente | null;
  historial?: string;
};

export default function CamareroPage() {
  const [partida, setPartida] = useState<SalaState | null>(null);
  const [usuarioLogueado, setUsuarioLogueado] = useState<User | null>(null);

  // Form selections
  const [objetivoUid, setObjetivoUid] = useState<string>('');
  const [categoriaServir, setCategoriaServir] = useState<string>(CATEGORIAS[0]);
  const [platoServir, setPlatoServir] = useState<string>('');
  const [varianteServir, setVarianteServir] = useState<string>('');
  const [cocinaSeleccionada, setCocinaSeleccionada] = useState<string>('');
  const [accionPendiente, setAccionPendiente] = useState<AccionPendiente | null>(null);
  const [ahora, setAhora] = useState<number>(Date.now());

  // ---- Auth + registro en conectados ----
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = '/';
        return;
      }

      setUsuarioLogueado(user);

      const nicknameRef = ref(db, `users/${user.uid}/nickname`);
      const nicknameSnap = await get(nicknameRef);
      const nombreFinal = nicknameSnap.exists() ? nicknameSnap.val() : user.displayName;

      const salaRootRef = ref(db, 'partidas/camarero_1');
      const salaRootSnap = await get(salaRootRef);
      const salaData = salaRootSnap.val() || {};

      const hayJuegoActivo =
        salaData?.juego?.estado === 'EN_CURSO' &&
        salaData?.juego?.jugadores &&
        Object.keys(salaData.juego.jugadores).length > 0;

      const conectadosCount = salaData.conectados ? Object.keys(salaData.conectados).length : 0;
      const salaHuerfana =
        salaData?.estado === 'EN_CURSO' &&
        (!hayJuegoActivo || conectadosCount === 0);

      // Si quedó activa pero sin gente/juego, la reiniciamos.
      if (salaHuerfana || !salaData.estado) {
        await update(salaRootRef, {
          estado: 'ESPERANDO',
          historial: salaData.historial || 'Esperando camareros...',
          juego: null,
        });
      } else if (hayJuegoActivo) {
        // Hay partida en curso, no nos agregamos a conectados
        return;
      }

      const conectadosRef = ref(db, 'partidas/camarero_1/conectados');
      const conectadosSnap = await get(conectadosRef);
      const conectadosData = conectadosSnap.val() || {};
      const yaEsta = !!conectadosData[user.uid];
      const totalConectados = Object.keys(conectadosData).length;

      if (!yaEsta && totalConectados >= 10) {
        alert('La cocina está llena. Hay 10 camareros conectados.');
        return;
      }

      const playerRef = ref(db, `partidas/camarero_1/conectados/${user.uid}`);
      await set(playerRef, {
        nombre: nombreFinal,
        foto: user.photoURL,
        uid: user.uid,
        joinedAt: conectadosData[user.uid]?.joinedAt || Date.now(),
      });

      onDisconnect(playerRef).remove();
    });

    return () => unsubAuth();
  }, []);

  // ---- Suscripción a la sala ----
  useEffect(() => {
    const salaRef = ref(db, 'partidas/camarero_1');
    const unsub = onValue(salaRef, (snapshot) => {
      const data = snapshot.val();
      setPartida(data);
      setAccionPendiente(data?.accionPendiente || null);

      const hayJuego = data?.juego?.jugadores && Object.keys(data.juego.jugadores).length > 0;
      const hayConectados = data?.conectados && Object.keys(data.conectados).length > 0;
      const salaActiva = data?.estado && data.estado !== 'ESPERANDO';
      const salaHuerfana = salaActiva && (!hayJuego || !hayConectados);

      if (data && (!data.estado || salaHuerfana)) {
        update(salaRef, {
          estado: 'ESPERANDO',
          historial: data?.historial || 'Esperando camareros...',
          juego: null,
        });
      }
    });

    return () => unsub();
  }, []);

  const conectados: Record<string, Conectado> = useMemo(
    () => partida?.conectados || {},
    [partida?.conectados]
  );
  const totalConectados = Object.keys(conectados).length;
  const hostUid = useMemo(() => {
    const arr = Object.values(conectados);
    arr.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
    return arr[0]?.uid ?? null;
  }, [conectados]);

  const juego: PartidaEstado | null = partida?.juego || null;
  const turnoActualUid = juego?.turnoActual || null;
  const esMiTurno = usuarioLogueado && turnoActualUid === usuarioLogueado.uid;

  const puedoIniciar = usuarioLogueado && hostUid === usuarioLogueado.uid && totalConectados >= 3 && totalConectados <= 10;

  const jugadoresLista = useMemo(() => {
    if (juego?.jugadores) return Object.values(juego.jugadores);
    return Object.values(conectados).map((c) => ({ ...c, puntos: 0, quejas: 0, pedido: [] }));
  }, [juego, conectados]);

  const mesa = useMemo(() => {
    const base: any = juego?.mesa || {};
    return {
      centro: base.centro || [],
      reveladas: base.reveladas || [],
      mazoCocina: base.mazoCocina || [],
      mazoPedidos: base.mazoPedidos || [],
      descarte: base.descarte || [],
    };
  }, [juego]);

  const miEstado = usuarioLogueado ? juego?.jugadores?.[usuarioLogueado.uid] : null;

  // ---- Acciones ----
  const iniciarPartida = async () => {
    if (!puedoIniciar) return;
    const conectadosArr: Conectado[] = Object.values(conectados);
    const estadoInicial = crearEstadoInicial(conectadosArr);
    await update(ref(db, 'partidas/camarero_1'), {
      estado: 'EN_CURSO',
      juego: estadoInicial,
      accionPendiente: null,
    });
  };

  const servir = async () => {
    if (!juego || !usuarioLogueado || !esMiTurno) return;
    if (!objetivoUid || !categoriaServir || !platoServir || !varianteServir) {
      alert('Completa todos los campos para servir.');
      return;
    }
    if (accionPendiente) {
      alert('Hay una acción pendiente de resolver.');
      return;
    }

    await update(ref(db, 'partidas/camarero_1'), {
      accionPendiente: {
        tipo: 'servir',
        servidorUid: usuarioLogueado.uid,
        objetivoUid,
        categoria: categoriaServir,
        plato: platoServir,
        variante: varianteServir,
        dudas: [],
        finVentana: Date.now() + 4000,
      },
    });
  };

  const descartar = async () => {
    if (!juego || !usuarioLogueado || !esMiTurno) return;
    if (!cocinaSeleccionada) {
      alert('Selecciona una carta de la cocina para descartar.');
      return;
    }
    if (accionPendiente) {
      alert('Hay una acción pendiente de resolver.');
      return;
    }

    const cartaSeleccionada = (mesa.centro as CocinaCarta[]).find((c) => c.id === cocinaSeleccionada);
    await update(ref(db, 'partidas/camarero_1'), {
      accionPendiente: {
        tipo: 'descartar',
        servidorUid: usuarioLogueado.uid,
        cocinaCardId: cocinaSeleccionada,
        categoria: cartaSeleccionada?.categoria,
        plato: cartaSeleccionada?.plato,
        variante: cartaSeleccionada?.variante,
        dudas: [],
        finVentana: Date.now() + 4000,
      },
    });
    setCocinaSeleccionada('');
  };

  const tocarTimbre = async () => {
    if (!accionPendiente || !usuarioLogueado) return;
    if (accionPendiente.servidorUid === usuarioLogueado.uid) return;
    const salaRef = ref(db, 'partidas/camarero_1/accionPendiente');
    const dudas = accionPendiente.dudas || [];
    const yaEsta = dudas.includes(usuarioLogueado.uid);
    const nuevas = [usuarioLogueado.uid, ...dudas.filter((d) => d !== usuarioLogueado.uid)];
    if (yaEsta && dudas[0] === usuarioLogueado.uid) return; // ya es el último (prioridad)
    await update(salaRef, { dudas: nuevas });
  };

  const resolverAccion = async () => {
    if (!accionPendiente || !juego) return;
    const dudas = accionPendiente.dudas || [];
    let resultado: ReturnType<typeof accionServir> | ReturnType<typeof accionDescartar> | null = null;

    if (accionPendiente.tipo === 'servir') {
      resultado = accionServir({
        estado: juego,
        servidorUid: accionPendiente.servidorUid,
        objetivoUid: accionPendiente.objetivoUid,
        categoria: accionPendiente.categoria,
        plato: accionPendiente.plato,
        variante: accionPendiente.variante,
        dudasOrden: dudas,
      });
    } else {
      resultado = accionDescartar({
        estado: juego,
        jugadorUid: accionPendiente.servidorUid,
        cocinaCardId: accionPendiente.cocinaCardId,
        dudasOrden: dudas,
      });
    }

    await update(ref(db, 'partidas/camarero_1'), {
      juego: resultado.estado,
      estado: resultado.estado.estado,
      accionPendiente: null,
    });
    setCocinaSeleccionada('');
  };

  // Countdown para ventana de dudas
  useEffect(() => {
    const timer = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (accionPendiente && accionPendiente.finVentana && ahora > accionPendiente.finVentana) {
      resolverAccion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ahora, accionPendiente]);

  // ---- UI helpers ----
  const platosPorCategoria = useMemo(() => {
    return CARTAS_BASE.filter((c) => c.categoria === categoriaServir);
  }, [categoriaServir]);

  useEffect(() => {
    if (platosPorCategoria.length > 0) {
      setPlatoServir(platosPorCategoria[0].plato);
      setVarianteServir(platosPorCategoria[0].variantes[0]);
    }
  }, [categoriaServir]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const platoSeleccionado = platosPorCategoria.find((p) => p.plato === platoServir);
    if (platoSeleccionado) {
      setVarianteServir(platoSeleccionado.variantes[0]);
    }
  }, [platoServir, platosPorCategoria]);

  const maxDescartes = maxDescartesPorTurno(totalConectados);
  const tiempoRestante = accionPendiente ? Math.max(0, Math.floor((accionPendiente.finVentana - ahora) / 1000)) : 0;
  const puedeTocarTimbre = accionPendiente && usuarioLogueado && accionPendiente.servidorUid !== usuarioLogueado.uid;
  const puedeResolver =
    accionPendiente &&
    usuarioLogueado &&
    (usuarioLogueado.uid === hostUid || usuarioLogueado.uid === accionPendiente.servidorUid);

  return (
    <main className="min-h-screen bg-stone-950 bg-checkered-pattern bg-fixed relative flex flex-col items-center p-6 font-body overflow-hidden text-stone-200">
      {/* Acciones rápidas */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-4">
        <a href="#" className="text-trattoria-gold underline decoration-dotted hover:text-trattoria-cream transition-colors text-sm">
          Reglamento
        </a>
        <button
          type="button"
          onClick={iniciarPartida}
          disabled={!puedoIniciar}
          className="bg-trattoria-red text-trattoria-cream px-4 py-2 rounded-lg font-serif font-bold shadow-[0_8px_20px_rgba(139,0,0,0.35)] border border-trattoria-gold hover:bg-red-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          Comenzar la partida
        </button>
      </div>

      {/* Encabezado */}
      <div className="relative z-10 text-center mb-8 mt-2">
        <h1 className="text-5xl md:text-7xl font-serif text-trattoria-gold drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] tracking-wider">
          Ristorante
        </h1>
        <h2 className="text-3xl md:text-4xl font-serif text-trattoria-cream mt-2 tracking-widest uppercase border-b-2 border-trattoria-red pb-4 inline-block">
          Il Camarero
        </h2>
      </div>

      {/* Lobby / mesa */}
      <div className="relative z-10 w-full max-w-5xl animate-in zoom-in duration-500">
          <div className="bg-trattoria-wood bg-opacity-95 border-[6px] border-trattoria-wood-light rounded-[2rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_0_20px_rgba(0,0,0,0.5)] relative overflow-hidden">
          {/* Esquinas doradas */}
          <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-trattoria-gold rounded-tl-xl opacity-50"></div>
          <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-trattoria-gold rounded-tr-xl opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-trattoria-gold rounded-bl-xl opacity-50"></div>
          <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-trattoria-gold rounded-br-xl opacity-50"></div>

          {/* Info staff */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-serif text-trattoria-cream tracking-wider">
                Staff de Cocina ({totalConectados}/10)
              </h2>
              <p className="text-sm text-trattoria-gold/70">
                Necesitamos mínimo 3 y máximo 10 camareros conectados.
              </p>
              {juego && (
                <p className="text-xs text-trattoria-gold/60 mt-1">
                  Turno: {turnoActualUid ? (juego.jugadores?.[turnoActualUid]?.nombre || turnoActualUid) : '—'}
                </p>
              )}
            </div>
            {hostUid && (
              <div className="text-right">
                <p className="text-xs text-trattoria-gold/70 uppercase tracking-widest">Capo de Sala</p>
                <p className="text-trattoria-cream font-serif font-bold">{conectados[hostUid]?.nombre}</p>
              </div>
            )}
          </div>

          {/* Mesas (10 lugares) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {Array.from({ length: 10 }).map((_, i) => {
              const jugador = jugadoresLista[i];
              const esHost = hostUid && jugador?.uid === hostUid;
              const esYo = usuarioLogueado && jugador?.uid === usuarioLogueado.uid;
              return (
                <div
                  key={i}
                  className={`rounded-2xl border-2 border-trattoria-gold/50 bg-black/30 p-4 flex flex-col items-center justify-center gap-3 shadow-[0_10px_25px_rgba(0,0,0,0.35)] ${jugador ? 'backdrop-blur-sm' : 'opacity-60'}`}
                >
                  <div className="w-16 h-16 rounded-full border-4 border-trattoria-wood-light bg-trattoria-wood/60 flex items-center justify-center overflow-hidden">
                    {jugador?.foto ? (
                      <Image src={jugador.foto} alt="" width={64} height={64} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-trattoria-cream font-serif text-lg leading-none text-center block w-full">
                        Mesa {i + 1}
                      </span>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-trattoria-cream font-bold leading-tight">{jugador ? jugador.nombre : `Mesa ${i + 1}`}</p>
                    <p className="text-trattoria-gold text-xs leading-tight">
                      {jugador ? (esHost ? 'Capo de sala' : esYo ? 'Eres tú' : 'Camarero') : 'Disponible'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mesa central y acciones de turno */}
          {juego?.estado === 'EN_CURSO' && (
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2 bg-black/30 border border-trattoria-gold/40 rounded-2xl p-4">
                <h3 className="text-trattoria-cream font-bold mb-3">Mesa de la cocina</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {mesa.centro.map((c: CocinaCarta) => (
                    <button
                      key={c.id}
                      onClick={() => setCocinaSeleccionada(c.id)}
                      className={`border rounded-xl p-3 text-left transition ${
                        cocinaSeleccionada === c.id ? 'border-trattoria-gold bg-trattoria-wood/60' : 'border-trattoria-gold/40 bg-black/30'
                      }`}
                    >
                      <p className="text-xs text-trattoria-gold/70 uppercase">{c.categoria}</p>
                      <p className="text-trattoria-cream font-bold">{c.plato}</p>
                      <p className="text-trattoria-gold text-sm">{c.variante}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-trattoria-gold/60 mt-2">
                  Selecciona 1 carta para descartar (máx {maxDescartes} por turno).
                </p>
                {accionPendiente && (
                  <div className="mt-3 text-sm text-trattoria-cream bg-black/40 border border-trattoria-gold/30 rounded-xl p-3">
                    <p className="font-bold">Acción en curso: {accionPendiente.tipo === 'servir' ? 'Servir' : 'Descartar'}</p>
                    <p className="text-trattoria-gold/80">Ventana de dudas: {tiempoRestante}s</p>
                    <p className="text-xs text-trattoria-gold/70">Dudas: {accionPendiente.dudas?.length || 0}</p>
                    <div className="flex gap-2 mt-2">
                      {puedeTocarTimbre && (
                        <button
                          onClick={tocarTimbre}
                          className="bg-trattoria-red text-trattoria-cream px-3 py-1 rounded-lg text-sm border border-trattoria-gold hover:bg-red-800 active:scale-95 transition"
                        >
                          Tocar timbre
                        </button>
                      )}
                      {puedeResolver && (
                        <button
                          onClick={resolverAccion}
                          className="bg-trattoria-gold text-trattoria-wood px-3 py-1 rounded-lg text-sm border border-trattoria-wood hover:bg-yellow-400 active:scale-95 transition"
                        >
                          Resolver ya
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-black/30 border border-trattoria-gold/40 rounded-2xl p-4 space-y-3">
                <h3 className="text-trattoria-cream font-bold">Acciones de turno</h3>
                <p className="text-xs text-trattoria-gold/70">Es tu turno: {esMiTurno ? 'Sí' : 'No'}</p>
                {accionPendiente && (
                  <p className="text-xs text-trattoria-red">Hay una acción pendiente de resolver.</p>
                )}

                {/* Servir */}
                <div className="space-y-2">
                  <p className="text-trattoria-cream font-semibold text-sm">Servir un plato</p>
                  <select
                    className="w-full bg-black/40 border border-trattoria-gold/40 rounded-lg p-2 text-sm"
                    value={objetivoUid}
                    onChange={(e) => setObjetivoUid(e.target.value)}
                  >
                    <option value="">Selecciona persona</option>
                    {jugadoresLista
                      .filter((j) => j.uid !== usuarioLogueado?.uid)
                      .map((j) => (
                        <option key={j.uid} value={j.uid}>
                          {j.nombre}
                        </option>
                      ))}
                  </select>

                  <select
                    className="w-full bg-black/40 border border-trattoria-gold/40 rounded-lg p-2 text-sm"
                    value={categoriaServir}
                    onChange={(e) => setCategoriaServir(e.target.value)}
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <select
                    className="w-full bg-black/40 border border-trattoria-gold/40 rounded-lg p-2 text-sm"
                    value={platoServir}
                    onChange={(e) => setPlatoServir(e.target.value)}
                  >
                    {platosPorCategoria.map((p) => (
                      <option key={p.plato} value={p.plato}>
                        {p.plato}
                      </option>
                    ))}
                  </select>

                  <select
                    className="w-full bg-black/40 border border-trattoria-gold/40 rounded-lg p-2 text-sm"
                    value={varianteServir}
                    onChange={(e) => setVarianteServir(e.target.value)}
                  >
                    {(platosPorCategoria.find((p) => p.plato === platoServir)?.variantes || []).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={servir}
                    disabled={!esMiTurno || !!accionPendiente}
                    className="w-full bg-trattoria-gold text-trattoria-wood font-bold rounded-lg py-2 border border-trattoria-wood hover:bg-yellow-400 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Servir (abre ventana de dudas)
                  </button>
                </div>

                {/* Descartar */}
                <div className="space-y-2">
                  <p className="text-trattoria-cream font-semibold text-sm">Descartar</p>
                  <button
                    onClick={descartar}
                    disabled={!esMiTurno || !cocinaSeleccionada || !!accionPendiente}
                    className="w-full bg-trattoria-wood-light text-trattoria-cream font-bold rounded-lg py-2 border border-trattoria-gold hover:bg-trattoria-wood active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Descartar seleccionada (abre ventana de dudas)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mano del jugador */}
          {miEstado && (
            <div className="mt-6 bg-black/30 border border-trattoria-gold/30 rounded-2xl p-4">
              <h3 className="text-trattoria-cream font-bold mb-2">Tus platos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {miEstado.pedido.map((c) => (
                  <div key={c.id} className="border border-trattoria-gold/40 rounded-xl p-3 bg-black/40">
                    <p className="text-xs text-trattoria-gold/70 uppercase">{c.categoria}</p>
                    <p className="text-trattoria-cream font-bold">{c.plato}</p>
                    <p className="text-trattoria-gold text-sm">{c.variante}</p>
                    <p className="text-xs text-trattoria-cream/70 mt-1">{c.servido ? 'Servido' : 'Pendiente'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pizarra puntuaciones */}
          {juego && (
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              <div className="bg-black/30 border border-trattoria-gold/30 rounded-2xl p-4">
                <h4 className="text-trattoria-cream font-bold mb-2">Puntos</h4>
                <ul className="space-y-1 text-sm">
                  {jugadoresLista.map((j) => (
                    <li key={j.uid} className="flex justify-between">
                      <span className="text-trattoria-cream">{j.nombre}</span>
                      <span className="text-trattoria-gold font-bold">
                        {j.puntos + j.quejas * PENALIZACION_QUEJA}
                        <span className="text-trattoria-gold/60 text-xs ml-1">
                          (quejas: {j.quejas})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-black/30 border border-trattoria-gold/30 rounded-2xl p-4">
                <h4 className="text-trattoria-cream font-bold mb-2">Cartas reveladas</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {mesa.reveladas.map((c: any) => (
                    <div key={c.id} className="border border-trattoria-gold/40 rounded-lg p-2 bg-black/40">
                      <p className="text-xs text-trattoria-gold/70 uppercase">{c.categoria}</p>
                      <p className="text-trattoria-cream font-bold">{c.plato}</p>
                      <p className="text-trattoria-gold text-xs">{c.variante}</p>
                    </div>
                  ))}
                  {mesa.reveladas.length === 0 && <p className="text-trattoria-gold/60">Sin reveladas aún</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
