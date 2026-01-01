'use client';
import { useState, useEffect } from 'react';
import { auth, googleProvider, db } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { ref, set, onValue } from 'firebase/database';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        // Guardar presencia en la DB
        set(ref(db, 'users/' + currentUser.uid), {
          name: currentUser.displayName,
          photo: currentUser.photoURL,
          lastSeen: Date.now()
        });
      }
    });
    return () => unsub();
  }, []);

  const login = () => signInWithPopup(auth, googleProvider);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-black text-white">Cargando Hano HUB...</div>;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white p-4">
      <div className="bg-slate-800 p-10 rounded-2xl shadow-2xl border border-slate-700 text-center max-w-md w-full">
        <h1 className="text-5xl font-extrabold text-yellow-400 mb-6 drop-shadow-md">
          Hano HUB 🃏
        </h1>
        
        {!user ? (
          <div>
            <p className="text-slate-400 mb-8">Inicia sesión para jugar con tus amigos en tiempo real.</p>
            <button 
              onClick={login}
              className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-yellow-400 transition-all flex items-center justify-center gap-2 w-full"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4" alt="G" />
              Entrar con Google
            </button>
          </div>
        ) : (
          <div>
            <img 
              src={user.photoURL || ''} 
              className="w-20 h-20 rounded-full mx-auto border-4 border-yellow-400 mb-4" 
              alt="Profile" 
            />
            <p className="text-xl font-semibold">¡Hola, {user.displayName}!</p>
            <p className="text-slate-400 text-sm mb-6">¿Qué vamos a jugar hoy?</p>
            
            <div className="grid grid-cols-1 gap-4">
              <button className="bg-yellow-500 hover:bg-yellow-600 p-4 rounded-xl font-bold transition-all">
                🎴 Juego de Cartas (Próximamente)
              </button>
              <button className="bg-blue-500 hover:bg-blue-600 p-4 rounded-xl font-bold transition-all">
                ♟️ Juego de Tablero (Próximamente)
              </button>
              <button 
                onClick={() => signOut(auth)}
                className="text-slate-500 text-sm mt-4 hover:underline"
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