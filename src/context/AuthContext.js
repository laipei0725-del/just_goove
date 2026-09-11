import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setReady(true); } }).catch(() => { if (active) setReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { if (active) { setSession(next); setReady(true); } });
    return () => { active = false; listener?.subscription?.unsubscribe(); };
  }, []);

  const unavailable = { error: { message: '帳號服務尚未就緒，請稍後再試；訪客資料仍保留在此裝置。' } };
  const signUpWithEmail = async (username, email, password) => {
    if (!supabase) return unavailable;
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username, display_name: username }, emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
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
    signOut: () => supabase ? supabase.auth.signOut() : Promise.resolve({}),
  }), [ready, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
