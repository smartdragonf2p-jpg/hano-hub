'use client';
import { useState, useEffect } from 'react';
import { auth, googleProvider, db } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
import Link from 'next/link';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [customName, setCustomName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Buscamos si ya tiene un apodo guardado
        const userRef = ref(db, `users/${currentUser.uid}/nickname`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          setCustomName(snapshot.val());
        } else {
          setCustomName(currentUser.displayName || "");
          setIsEditingName(true); // Si es nuevo, le pedimos que elija nombre
        }
      }
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const saveNickname = async () => {
    if (user && customName.trim().length > 2) {
      await set(ref(db, `users/${user.uid}/nickname`), customName);
      setIsEditingName(false);
    } else {
      alert("El nombre es muy corto");
    }
  };

  const login = () => signInWithPopup(auth, googleProvider);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-zinc-900 text-white font-black">CARGANDO HANO HUB...</div>;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-900 text-white p-4">
      <div className="bg-zinc-800 p-10 rounded-[2.5rem] shadow-2xl border border-zinc-700 text-center max-w-md w-full">
        <h1 className="text-5xl font-black text-yellow-400 mb-2 tracking-tighter">
          Hano HUB 🃏
        </h1>
        
        {!user ? (
          <div className="mt-8">
            <p className="text-zinc-400 mb-8 font-medium">Inicia sesión para jugar con tus amigos en tiempo real.</p>
            <button 
              onClick={login}
              className="bg-white text-black px-8 py-4 rounded-2xl font-black hover:bg-yellow-400 transition-all flex items-center justify-center gap-3 w-full shadow-lg active:scale-95"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5" alt="G" />
              ENTRAR CON GOOGLE
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <div className="relative inline-block mb-4">
                <img 
                  src={user.photoURL || ''} 
                  className="w-24 h-24 rounded-full mx-auto border-4 border-yellow-400 shadow-xl" 
                  alt="Profile" 
                />
                <span className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 border-4 border-zinc-800 rounded-full"></span>
            </div>

            {/* LÓGICA DE NOMBRE PERSONALIZADO */}
            {isEditingName ? (
              <div className="flex flex-col gap-3 mb-6 animate-in fade-in">
                <p className="font-bold text-zinc-400 uppercase text-xs">Elige tu apodo de jugador:</p>
                <input 
                  type="text" 
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="bg-zinc-700 p-3 rounded-xl text-center font-bold text-lg border-2 border-yellow-400 outline-none text-white"
                  placeholder="Tu apodo..."
                />
                <button 
                  onClick={saveNickname}
                  className="bg-yellow-400 text-black py-2 rounded-xl font-black text-sm hover:bg-yellow-300"
                >
                  GUARDAR
                </button>
              </div>
            ) : (
              <div className="mb-6">
                <p className="text-2xl font-black text-white">¡Hola, {customName}!</p>
                <button 
                  onClick={() => setIsEditingName(true)} 
                  className="text-xs text-zinc-500 underline hover:text-yellow-400 transition-colors"
                >
                  Cambiar nombre
                </button>
              </div>
            )}
            
            <p className="text-zinc-500 font-bold text-sm mb-6 uppercase tracking-widest">¿Qué vamos a jugar hoy?</p>
            
            <div className="grid grid-cols-1 gap-4">
              <Link href="/camarero">
                <button className="w-full bg-orange-600 hover:bg-orange-500 p-5 rounded-2xl font-black text-lg transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3 border-b-4 border-orange-800">
                  👨‍🍳 JUGAR CAMARERO
                </button>
              </Link>

              <button className="bg-zinc-700 opacity-50 cursor-not-allowed p-5 rounded-2xl font-black text-lg border-b-4 border-zinc-900">
                ♟️ PRÓXIMO JUEGO
              </button>

              <button 
                onClick={() => signOut(auth)}
                className="text-zinc-500 font-black text-xs mt-6 hover:text-white transition-colors uppercase tracking-widest"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}