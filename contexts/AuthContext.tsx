
import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { Profile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  profileLoading: boolean;
  error: string | null;
  isRecoverySession: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecoverySession, setIsRecoverySession] = useState(false);

  useEffect(() => {
    setLoading(true);
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, sessionState) => {
      setSession(sessionState);
      setUser(prev => {
        if (prev?.id === sessionState?.user?.id && _event !== 'USER_UPDATED') {
          return prev;
        }
        return sessionState?.user ?? null;
      });
      setIsRecoverySession(_event === 'PASSWORD_RECOVERY');
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        setProfileLoading(true);
        setError(null);
        try {
          const { data, error: profileError } = await supabase
            .from('profiles')
            .select(`
              id,
              company_id,
              company_key_id,
              company_keys (
                expires_at,
                is_active
              ),
              companies (
                name
              )
            `)
            .eq('id', user.id)
            .single();

          if (profileError) {
            if (profileError.code === 'PGRST116') {
              setProfile(null);
            } else {
              throw new Error(`Erro ao carregar perfil: ${profileError.message}`);
            }
          } else {
            setProfile(data as unknown as Profile);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setProfile(null);
        } finally {
          setProfileLoading(false);
        }
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [user?.id]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select(`id, company_id, company_key_id, company_keys(expires_at, is_active), companies(name)`)
        .eq('id', user.id)
        .single();
      
      if (!profileError) {
        setProfile(data as unknown as Profile);
      }
    } catch (err) {
      console.error('Erro inesperado ao atualizar perfil:', err);
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const value = {
    user,
    profile,
    session,
    loading,
    profileLoading,
    error,
    isRecoverySession,
    signOut,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
