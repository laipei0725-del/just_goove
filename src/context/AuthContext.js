import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setReady(true); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => { active = false; listener?.subscription?.unsubscribe(); };
  }, []);

  const unavailable = { error: { message: '尚未設定 Supabase，請先填入 EXPO_PUBLIC_SUPABASE_URL 與 EXPO_PUBLIC_SUPABASE_ANON_KEY。' } };
  const signUpWithEmail = async (username, email, password) => {
    if (!supabase) return unavailable;
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username, display_name: username } },
      });
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  };

  const value = useMemo(() => ({
    ready,
    session,
    user: session?.user || null,
    isGuest: !session,
    signInWithEmail: (email, password) => supabase ? supabase.auth.signInWithPassword({ email, password }) : Promise.resolve(unavailable),
    signUpWithEmail,
    signInWithGoogle: () => supabase ? supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined } }) : Promise.resolve(unavailable),
    signOut: () => supabase ? supabase.auth.signOut() : Promise.resolve({}),
  }), [ready, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
