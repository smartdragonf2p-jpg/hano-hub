'use client';
import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { ref, onValue, set, update, onDisconnect } from 'firebase/database';
import { generarMazoOficial, CATEGORIAS } from './constants';

export default function CamareroPage() {
  const [partida, setPartida] = useState<any>(null);
  const [usuarioLogueado, setUsuarioLogueado] = useState<any>(null);

  useEffect(() => {
    // 1. Detectar usuario
    const user = auth.currentUser;
    if (user) {
      setUsuarioLogueado(user);
      
      // 2. Registrarse en la sala de espera
      const playerRef = ref(db, `partidas/camarero_1/conectados/${user.uid}`);
      set(playerRef, {
        nombre: user.displayName,
        foto: user.photoURL,
        isHost: false // El primero que reparte será el host
      });

      // 3. Si se desconecta, eliminarlo de la sala automáticamente
      onDisconnect(playerRef).remove();
    }

    // 4. Escuchar cambios en la partida
    const salaRef = ref(db, 'partidas/camarero_1');
    return onValue(salaRef, (snapshot) => {
      setPartida(snapshot.val());
    });
  }, []);

  const repartirCartas = () => {
    if (!partida?.conectados) return;

    const mazo = generarMazoOficial();
    const idsJugadores = Object.keys(partida.conectados);
    
    // Solo permitimos jugar si hay entre 3 y 10 jugadores (según tus reglas)
    if (idsJugadores.length < 3) {
      alert("Se necesitan al menos 3 jugadores para empezar.");
      return;
    }

    const nuevoEstadoJugadores: any = {};

    idsJugadores.forEach((uid) => {
      const pedidoPersonal: any[] = [];
      
      // Repartimos 1 de cada categoría a cada uno
      CATEGORIAS.forEach(cat => {
        const index = mazo.findIndex(c => c.categoria === cat);
        const carta = mazo.splice(index, 1)[0];
        pedidoPersonal.push({ ...carta, servido: false, listo: false });
      });

      nuevoEstadoJugadores[uid] = {
        nombre: partida.conectados[uid].nombre,
        foto: partida.conectados[uid].foto,
        pedido: pedidoPersonal,
        quejas: 0,
        estado: 'ELIGIENDO_MENU' // Fase 1: Elegir opción
      };
    });

    // 8 cartas al centro
    const cartasCentro = mazo.splice(0, 8);

    // Actualizar Firebase para que todos cambien de pantalla
    update(ref(db, 'partidas/camarero_1'), {
      estado: 'SELECCIONANDO_MENU',
      mazoRestante: mazo,
      cartasCentro: cartasCentro,
      jugadores: nuevoEstadoJugadores,
      historial: "¡El camarero repartió las cartas!"
    });
  };

  return (
    <main className="min-h-screen bg-zinc-900 text-white p-6 flex flex-col items-center">
      <h1 className="text-4xl font-black text-orange-500 mb-8 uppercase tracking-widest">
        👨‍🍳 Camarero Lobby
      </h1>
      
      {/* Sala de Espera */}
      {!partida?.estado || partida.estado === 'ESPERANDO' ? (
        <div className="bg-zinc-800 border border-zinc-700 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
          <h2 className="text-xl font-bold mb-6 text-zinc-400">Jugadores listos:</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-10">
            {partida?.conectados && Object.values(partida.conectados).map((p: any, i: number) => (
              <div key={i} className="flex flex-col items-center gap-2 bg-zinc-700/50 p-4 rounded-2xl">
                <img src={p.foto} className="w-12 h-12 rounded-full border-2 border-orange-500" alt="" />
                <span className="text-sm font-medium truncate w-full">{p.nombre}</span>
              </div>
            ))}
          </div>

          <button 
            onClick={repartirCartas}
            className="w-full bg-orange-600 hover:bg-orange-500 py-4 rounded-2xl font-black text-xl transition-all shadow-lg active:scale-95"
          >
            REPARTIR CARTAS
          </button>
          
          <p className="text-zinc-500 text-xs mt-4 italic">
            Mínimo 3 jugadores para empezar (Hay {Object.keys(partida?.conectados || {}).length})
          </p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-2xl font-bold">¡Partida en curso!</p>
          {/* Aquí irá la siguiente pantalla del juego */}
        </div>
      )}
    </main>
  );
}