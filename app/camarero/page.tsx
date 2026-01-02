'use client';
import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { ref, onValue, set, update, onDisconnect, get } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { generarMazoOficial, CATEGORIAS } from './constants';

export default function CamareroPage() {
  const [partida, setPartida] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [usuarioLogueado, setUsuarioLogueado] = useState<any>(null);

  // Suscribimos al auth para registrar al jugador en conectados con su apodo.
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/";
        return;
      }

      setUsuarioLogueado(user);

      const nicknameRef = ref(db, `users/${user.uid}/nickname`);
      const nicknameSnap = await get(nicknameRef);
      const nombreFinal = nicknameSnap.exists() ? nicknameSnap.val() : user.displayName;

      const salaRootRef = ref(db, 'partidas/camarero_1');
      const salaRootSnap = await get(salaRootRef);
      const salaData = salaRootSnap.val() || {};
      const conectadosCount = salaData.conectados ? Object.keys(salaData.conectados).length : 0;
      const hayJugadoresActivos = salaData.jugadores && Object.keys(salaData.jugadores).length > 0;
      const salaActiva = salaData.estado && salaData.estado !== 'ESPERANDO';
      const salaHuerfana = salaActiva && (!hayJugadoresActivos || conectadosCount === 0);

      // Si quedó activa pero sin gente/jugadores, la reiniciamos.
      if (salaHuerfana || !salaData.estado) {
        await update(salaRootRef, { estado: 'ESPERANDO', historial: salaData.historial || "Esperando camareros...", jugadores: null, cartasCentro: null, mazoRestante: null });
      } else if (salaActiva) {
        // Si está activa con gente, no añadimos al lobby.
        return;
      }

      const conectadosRef = ref(db, 'partidas/camarero_1/conectados');
      const conectadosSnap = await get(conectadosRef);
      const conectadosData = conectadosSnap.val() || {};
      const yaEsta = !!conectadosData[user.uid];
      const totalConectados = Object.keys(conectadosData).length;

      if (!yaEsta && totalConectados >= 10) {
        alert("La cocina está llena. Hay 10 camareros conectados.");
        return;
      }
      
      const playerRef = ref(db, `partidas/camarero_1/conectados/${user.uid}`);
      await set(playerRef, {
        nombre: nombreFinal,
        foto: user.photoURL,
        uid: user.uid,
        joinedAt: conectadosData[user.uid]?.joinedAt || Date.now()
      });

      onDisconnect(playerRef).remove();
    });

    return () => unsubAuth();
  }, []);

  // Suscripci?n a la sala para ver conectados y estado en tiempo real.
  useEffect(() => {
    const salaRef = ref(db, 'partidas/camarero_1');
    const unsub = onValue(salaRef, (snapshot) => {
      const data = snapshot.val();
      setPartida(data);

      const hayJugadores = data?.jugadores && Object.keys(data.jugadores).length > 0;
      const hayConectados = data?.conectados && Object.keys(data.conectados).length > 0;
      const salaActiva = data?.estado && data.estado !== 'ESPERANDO';
      const salaHuerfana = salaActiva && (!hayJugadores || !hayConectados);

      // Normalizamos a ESPERANDO si no hay estado o si quedó en otro estado sin jugadores/conectados.
      if (data && (!data.estado || salaHuerfana)) {
        update(salaRef, {
          estado: 'ESPERANDO',
          historial: data?.historial || "Esperando camareros...",
          jugadores: null,
          cartasCentro: null,
          mazoRestante: null,
        });
      }
    });

    return () => unsub();
  }, []);

  const repartirCartas = () => {
    if (!partida?.conectados) return;

    const mazo = generarMazoOficial();
    const idsJugadores = Object.keys(partida.conectados);
    
    const total = idsJugadores.length;
    
    if (total < 3) {
      alert("Mamma mia! Se necesitan al menos 3 camareros para abrir la cocina.");
      return;
    }

    if (total > 10) {
      alert("Solo se permiten 10 camareros en la sala.");
      return;
    }

    const nuevoEstadoJugadores: any = {};

    idsJugadores.forEach((uid) => {
      const pedidoPersonal: any[] = [];
      CATEGORIAS.forEach(cat => {
        const index = mazo.findIndex(c => c.categoria === cat);
        const carta = mazo.splice(index, 1)[0];
        pedidoPersonal.push({ ...carta, servido: false, confirmado: false });
      });

      nuevoEstadoJugadores[uid] = {
        nombre: partida.conectados[uid].nombre,
        foto: partida.conectados[uid].foto,
        pedido: pedidoPersonal,
        quejas: 0,
        listo: false 
      };
    });

    const cartasCentro = mazo.splice(0, 8);

    update(ref(db, 'partidas/camarero_1'), {
      estado: 'SELECCIONANDO_MENU',
      mazoRestante: mazo,
      cartasCentro: cartasCentro,
      jugadores: nuevoEstadoJugadores,
      historial: "¡El Capo ha repartido las comandas! Prepara tu menú."
    });
  };

  // --- RENDERIZADO ITALIANO ---
  const conectados = partida?.conectados || {};
  const totalConectados = Object.keys(conectados).length;
  const puedeComenzar = totalConectados >= 3 && totalConectados <= 10;
  const hostUid = Object.keys(conectados)
    .sort((a, b) => (conectados[a]?.joinedAt || 0) - (conectados[b]?.joinedAt || 0))[0] || null;
  const listaConectados = Object.values(conectados).sort((a: any, b: any) => {
    if (usuarioLogueado && a.uid === usuarioLogueado.uid) return -1;
    if (usuarioLogueado && b.uid === usuarioLogueado.uid) return 1;
    return 0;
  });
  const mesas = Array.from({ length: 10 }, (_, i) => listaConectados[i] || null);
  const hayJugadoresEnPartida = !!(partida?.jugadores && Object.keys(partida.jugadores).length > 0);
  const hayConectadosEnSala = totalConectados > 0;
  const salaActiva = !!(partida?.estado && partida.estado !== 'ESPERANDO');
  const partidaEnCurso = salaActiva && hayJugadoresEnPartida && hayConectadosEnSala;
  const partidaHuerfana = salaActiva && (!hayJugadoresEnPartida || !hayConectadosEnSala);
  const puedeVerLobby = !salaActiva || partidaHuerfana;

  const irAlLobby = () => {
    const el = document.getElementById('lobby');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const entrarASala = async () => {
    if (partidaEnCurso && !partidaHuerfana) return;
    const salaRef = ref(db, 'partidas/camarero_1');
    await update(salaRef, { 
      estado: 'ESPERANDO',
      historial: partida?.historial || "Esperando camareros...",
      jugadores: null,
      cartasCentro: null,
      mazoRestante: null,
    });
    irAlLobby();
  };

  return (
    // Fondo con textura de mantel y viñeta oscura
    <main className="min-h-screen bg-stone-950 bg-checkered-pattern bg-fixed relative flex flex-col items-center p-6 font-body overflow-hidden text-stone-200">
      
      {/* Acciones rápidas */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-4">
        <a href="#" className="text-trattoria-gold underline decoration-dotted hover:text-trattoria-cream transition-colors text-sm">
          Reglamento
        </a>
        <button
          type="button"
          onClick={entrarASala}
          disabled={partidaEnCurso}
          className="bg-trattoria-red text-trattoria-cream px-4 py-2 rounded-lg font-serif font-bold shadow-[0_8px_20px_rgba(139,0,0,0.35)] border border-trattoria-gold hover:bg-red-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          Ingresar al juego
        </button>
      </div>
      
      {/* Título Principal con estilo de menú antiguo */}
      <div className="relative z-10 text-center mb-10 mt-4">
         <h1 className="text-5xl md:text-7xl font-serif text-trattoria-gold drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] tracking-wider">
            Ristorante
         </h1>
         <h2 className="text-3xl md:text-4xl font-serif text-trattoria-cream mt-2 tracking-widest uppercase border-b-2 border-trattoria-red pb-4 inline-block">
            Il Camarero
         </h2>
      </div>
      
      {/* 1. LOBBY / SALA DE ESPERA ESTILO PIZARRA DE MENÚ */}
      {puedeVerLobby && (
        <div id="lobby" className="relative z-10 animate-in zoom-in duration-500 w-full max-w-5xl">
          {/* Marco de madera y fondo de pizarra/menú */}
          <div className="bg-trattoria-wood bg-opacity-95 border-[6px] border-trattoria-wood-light rounded-[2rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_0_20px_rgba(0,0,0,0.5)] relative overflow-hidden">
            
            {/* Decoración de esquinas doradas */}
            <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-trattoria-gold rounded-tl-xl opacity-50"></div>
            <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-trattoria-gold rounded-tr-xl opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-trattoria-gold rounded-bl-xl opacity-50"></div>
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-trattoria-gold rounded-br-xl opacity-50"></div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-serif text-trattoria-cream tracking-wider">
                  Staff de Cocina ({totalConectados}/10)
                </h2>
                <p className="text-sm text-trattoria-gold/70">
                  Necesitamos mínimo 3 y máximo 10 camareros conectados.
                </p>
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
              {mesas.map((p: any, i: number) => {
                const esHost = hostUid && p?.uid === hostUid;
                const esYo = usuarioLogueado && p?.uid === usuarioLogueado.uid;
                return (
                  <div
                    key={i}
                    className={`rounded-2xl border-2 border-trattoria-gold/50 bg-black/30 p-4 flex flex-col items-center justify-center gap-3 shadow-[0_10px_25px_rgba(0,0,0,0.35)] ${p ? 'backdrop-blur-sm' : 'opacity-60'}`}
                  >
                    <div className="w-16 h-16 rounded-full border-4 border-trattoria-wood-light bg-trattoria-wood/60 flex items-center justify-center overflow-hidden">
                      {p?.foto ? (
                        <img src={p.foto} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-trattoria-cream font-serif text-xl">Mesa {i + 1}</span>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-trattoria-cream font-bold">{p ? p.nombre : `Mesa ${i + 1}`}</p>
                      <p className="text-trattoria-gold text-xs">
                        {p ? (esHost ? 'Capo de sala' : esYo ? 'Eres tú' : 'Camarero') : 'Disponible'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Acción central: solo host puede comenzar */}
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={() => alert("Interfaz de inicio de partida llegará aquí.")}
                disabled={!puedeComenzar || !usuarioLogueado || usuarioLogueado?.uid !== hostUid}
                aria-disabled={!puedeComenzar || !usuarioLogueado || usuarioLogueado?.uid !== hostUid}
                className="px-6 py-3 rounded-xl font-serif font-bold text-lg bg-trattoria-gold text-trattoria-wood border-2 border-trattoria-wood hover:bg-yellow-400 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                Comenzar la partida
              </button>
              <p className="text-trattoria-gold/70 text-xs">
                Solo el primero en llegar puede iniciar cuando sean 3 o más.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje cuando hay una partida en curso */}
      {partidaEnCurso && (
        <div className="w-full max-w-3xl mt-10 text-center bg-black/40 border border-trattoria-wood/40 rounded-2xl p-6 text-trattoria-cream">
          <p className="text-xl font-serif font-bold mb-2">Partida en curso</p>
          <p className="text-trattoria-gold/70 text-sm">Espera a que termine para ingresar al lobby.</p>
        </div>
      )}

      {/* 2. FASE DE SELECCIÓN (Placeholder Temático) */}
      {partida?.estado === 'SELECCIONANDO_MENU' && (
        <div className="relative z-10 w-full max-w-4xl text-center animate-in fade-in duration-700">
          <div className="bg-trattoria-cream/90 text-trattoria-wood p-6 rounded-2xl border-4 border-trattoria-wood shadow-2xl mb-8 inline-block mx-auto transform rotate-1">
             <h2 className="text-3xl font-serif font-black mb-2 uppercase text-trattoria-red drop-shadow-sm">
                Prepara tu Menú Secreto
             </h2>
             <p className="text-lg font-bold italic">
                "Memoriza bien, o el cliente se quejará..." 🤌
             </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 p-8 bg-black/40 rounded-3xl backdrop-blur-sm border border-trattoria-wood/30">
             <p className="col-span-full py-16 bg-trattoria-wood/80 rounded-2xl border-[3px] border-dashed border-trattoria-gold text-trattoria-cream font-serif text-xl flex items-center justify-center gap-4">
                <span className="text-4xl animate-spin">🍕</span> Trayendo los platos del horno...
             </p>
          </div>
        </div>
      )}
    </main>
  );
}
