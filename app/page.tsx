'use client';
import { useState, useEffect } from 'react';
import { auth, googleProvider } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import Link from 'next/link'; // Importante para navegar

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

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
            <div className="relative inline-block">
                <img 
                src={user.photoURL || ''} 
                className="w-24 h-24 rounded-full mx-auto border-4 border-yellow-400 mb-4 shadow-xl" 
                alt="Profile" 
                />
                <span className="absolute bottom-4 right-0 w-6 h-6 bg-green-500 border-4 border-zinc-800 rounded-full"></span>
            </div>
            <p className="text-2xl font-black mb-1">¡Hola, {user.displayName?.split(' ')[0]}!</p>
            <p className="text-zinc-500 font-bold text-sm mb-8 uppercase tracking-widest">¿Qué vamos a jugar hoy?</p>
            
            <div className="grid grid-cols-1 gap-4">
              {/* BOTÓN ACTIVO AL CAMARERO */}
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