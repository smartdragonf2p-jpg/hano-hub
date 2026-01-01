'use client';
import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { ref, onValue, set, update, onDisconnect, get } from 'firebase/database';
import { generarMazoOficial, CATEGORIAS } from './constants';

export default function CamareroPage() {
  const [partida, setPartida] = useState<any>(null);
  const [usuarioLogueado, setUsuarioLogueado] = useState<any>(null);

  useEffect(() => {
    const setupJugador = async () => {
      const user = auth.currentUser;
      if (user) {
        setUsuarioLogueado(user);

        // 1. Obtener el nickname personalizado de la base de datos
        const nicknameRef = ref(db, `users/${user.uid}/nickname`);
        const nicknameSnap = await get(nicknameRef);
        const nombreFinal = nicknameSnap.exists() ? nicknameSnap.val() : user.displayName;
        
        // 2. Registrarse en la sala de espera con el nombre personalizado
        const playerRef = ref(db, `partidas/camarero_1/conectados/${user.uid}`);
        await set(playerRef, {
          nombre: nombreFinal,
          foto: user.photoURL,
          uid: user.uid
        });

        // 3. Limpieza al desconectarse
        onDisconnect(playerRef).remove();
      }
    };

    setupJugador();

    // 4. Escuchar cambios en la partida en tiempo real
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
      alert("Se necesitan al menos 3 jugadores para empezar.");
      return;
    }

    const nuevoEstadoJugadores: any = {};

    idsJugadores.forEach((uid) => {
      const pedidoPersonal: any[] = [];
      
      // Repartimos 1 carta de cada una de las 5 categorías
      CATEGORIAS.forEach(cat => {
        const index = mazo.findIndex(c => c.categoria === cat);
        const carta = mazo.splice(index, 1)[0];
        // IMPORTANTE: Cada carta de pedido tiene 2 opciones, aquí el jugador elegirá una luego
        pedidoPersonal.push({ 
            ...carta, 
            servido: false, 
            confirmado: false 
        });
      });

      nuevoEstadoJugadores[uid] = {
        nombre: partida.conectados[uid].nombre,
        foto: partida.conectados[uid].foto,
        pedido: pedidoPersonal,
        quejas: 0,
        listo: false // Para saber cuando termine de elegir su menú
      };
    });

    const cartasCentro = mazo.splice(0, 8);

    // Cambiamos el estado de la partida
    update(ref(db, 'partidas/camarero_1'), {
      estado: 'SELECCIONANDO_MENU',
      mazoRestante: mazo,
      cartasCentro: cartasCentro,
      jugadores: nuevoEstadoJugadores,
      historial: "¡El camarero repartió los pedidos! Elige tus platos."
    });
  };

  // --- RENDERIZADO ---

  return (
    <main className="min-h-screen bg-zinc-900 text-white p-6 flex flex-col items-center">
      <h1 className="text-4xl font-black text-orange-500 mb-8 uppercase tracking-widest italic">
        👨‍🍳 Camarero HUB
      </h1>
      
      {/* 1. LOBBY / SALA DE ESPERA */}
      {(!partida?.estado || partida.estado === 'ESPERANDO') && (
        <div className="bg-zinc-800 border border-zinc-700 p-8 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center animate-in zoom-in duration-300">
          <h2 className="text-xl font-bold mb-6 text-zinc-400 uppercase tracking-tighter">Jugadores en cocina:</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-10">
            {partida?.conectados && Object.values(partida.conectados).map((p: any, i: number) => (
              <div key={i} className="flex flex-col items-center gap-2 bg-zinc-700/50 p-4 rounded-3xl border border-zinc-600">
                <img src={p.foto} className="w-14 h-14 rounded-full border-2 border-orange-500 shadow-lg" alt="" />
                <span className="text-xs font-black truncate w-full uppercase">{p.nombre}</span>
              </div>
            ))}
          </div>

          <button 
            onClick={repartirCartas}
            className="w-full bg-orange-600 hover:bg-orange-500 py-5 rounded-2xl font-black text-xl transition-all shadow-[0_0_20px_rgba(234,88,12,0.4)] active:scale-95 border-b-4 border-orange-800"
          >
            REPARTIR PEDIDOS
          </button>
          
          <p className="text-zinc-500 text-xs mt-6 font-bold uppercase tracking-widest">
            Mínimo 3 jugadores • {Object.keys(partida?.conectados || {}).length} presentes
          </p>
        </div>
      )}

      {/* 2. FASE DE SELECCIÓN DE MENÚ (PRÓXIMO PASO) */}
      {partida?.estado === 'SELECCIONANDO_MENU' && (
        <div className="w-full max-w-4xl text-center animate-in fade-in duration-500">
          <h2 className="text-2xl font-black mb-2 uppercase">Prepara tu Comanda</h2>
          <p className="text-zinc-400 mb-8">Elige qué opción servirás de cada plato y memorízalo.</p>
          
          {/* Aquí mapearemos el pedido del usuario actual */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
             {/* El código de la interfaz de selección vendrá aquí */}
             <p className="col-span-full py-10 bg-zinc-800 rounded-3xl border border-dashed border-zinc-600 text-zinc-500">
                Cargando tus cartas de pedido...
             </p>
          </div>
        </div>
      )}
    </main>
  );
}