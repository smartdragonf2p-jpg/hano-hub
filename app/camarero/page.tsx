'use client';
import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { ref, onValue, set, update, onDisconnect, get } from 'firebase/database';
import { generarMazoOficial, CATEGORIAS } from './constants';

export default function CamareroPage() {
  const [partida, setPartida] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [usuarioLogueado, setUsuarioLogueado] = useState<any>(null);

  useEffect(() => {
    const setupJugador = async () => {
      const user = auth.currentUser;
      if (user) {
        setUsuarioLogueado(user);

        // Buscamos el nombre personalizado
        const nicknameRef = ref(db, `users/${user.uid}/nickname`);
        const nicknameSnap = await get(nicknameRef);
        const nombreFinal = nicknameSnap.exists() ? nicknameSnap.val() : user.displayName;
        
        // Entramos al Lobby
        const playerRef = ref(db, `partidas/camarero_1/conectados/${user.uid}`);
        await set(playerRef, {
          nombre: nombreFinal,
          foto: user.photoURL,
          uid: user.uid
        });

        onDisconnect(playerRef).remove();
      }
    };

    setupJugador();

    const salaRef = ref(db, 'partidas/camarero_1');
    const unsub = onValue(salaRef, (snapshot) => {
      setPartida(snapshot.val());
    });

    return () => unsub();
  }, []);

  const repartirCartas = () => {
    if (!partida?.conectados) return;

    const mazo = generarMazoOficial();
    const idsJugadores = Object.keys(partida.conectados);
    
    if (idsJugadores.length < 3) {
      alert("🤌 ¡Mamma mia! Se necesitan al menos 3 camareros para abrir la cocina.");
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

  return (
    // Fondo con textura de mantel y viñeta oscura
    <main className="min-h-screen bg-stone-950 bg-checkered-pattern bg-fixed relative flex flex-col items-center p-6 font-body overflow-hidden text-stone-200">
      
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
      {(!partida?.estado || partida.estado === 'ESPERANDO') && (
        <div className="relative z-10 animate-in zoom-in duration-500 max-w-md w-full">
          {/* Marco de madera y fondo de pizarra/menú */}
          <div className="bg-trattoria-wood bg-opacity-95 border-[6px] border-trattoria-wood-light rounded-[2rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_0_20px_rgba(0,0,0,0.5)] relative overflow-hidden">
            
            {/* Decoración de esquinas doradas */}
            <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-trattoria-gold rounded-tl-xl opacity-50"></div>
            <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-trattoria-gold rounded-tr-xl opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-trattoria-gold rounded-bl-xl opacity-50"></div>
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-trattoria-gold rounded-br-xl opacity-50"></div>

            <h2 className="text-2xl font-serif text-center mb-8 text-trattoria-cream tracking-wider">
               Staff de Cocina ({Object.keys(partida?.conectados || {}).length})
            </h2>
            
            <div className="grid grid-cols-2 gap-6 mb-10">
              {partida?.conectados && Object.values(partida.conectados).map((p: any, i: number) => (
                <div key={i} className="flex flex-col items-center group">
                  <div className="relative mb-3 transition-transform group-hover:scale-110 duration-300">
                     {/* Marco de foto dorado */}
                     <div className="absolute inset-0 rounded-full border-[3px] border-trattoria-gold shadow-[0_0_15px_rgba(212,175,55,0.3)]"></div>
                     <img src={p.foto} className="w-16 h-16 rounded-full border-4 border-trattoria-wood-light" alt="" />
                  </div>
                  <span className="text-sm font-bold text-trattoria-cream uppercase tracking-tight bg-trattoria-red/80 px-3 py-1 rounded-full shadow-sm">
                     {p.nombre}
                  </span>
                </div>
              ))}
            </div>

            <button 
              onClick={repartirCartas}
              className="w-full relative overflow-hidden bg-trattoria-red hover:bg-red-800 text-trattoria-cream py-5 rounded-xl font-serif font-bold text-xl transition-all shadow-[0_10px_20px_rgba(139,0,0,0.3),inset_0_2px_0_rgba(255,255,255,0.2)] active:scale-95 border-2 border-trattoria-gold group"
            >
               <span className="relative z-10 flex items-center justify-center gap-2">
                  🍽️ ¡Marchare la Comanda!
               </span>
               {/* Brillo al pasar el mouse */}
               <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-trattoria-gold/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"></div>
            </button>
            
            <p className="text-trattoria-gold/60 text-center text-xs mt-6 font-serif italic">
              * Se requieren mínimo 3 camareros para abrir la cocina.
            </p>
          </div>
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