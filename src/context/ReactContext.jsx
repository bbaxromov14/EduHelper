import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Функция обработки реферала
  const handleReferralAfterAuth = useCallback(async (userId, userEmail) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        return;
      }

      const pendingCode = localStorage.getItem("pending_referral_code");
      const urlCode = localStorage.getItem("referral_code_from_url");

      const codeToUse = pendingCode || urlCode;

      if (!codeToUse) {
        return;
      }

      await processReferral(userId, userEmail, codeToUse);

      localStorage.removeItem("pending_referral_code");
      localStorage.removeItem("referral_code_from_url");
      localStorage.removeItem('pending_user_email');
      localStorage.removeItem('pending_user_id');
      localStorage.removeItem('pending_referral_data');

    } catch (error) {
    }
  }, []);

  const processReferral = async (userId, userEmail, referralCode) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        return;
      }

      const { data: referrerData, error: referrerError } = await supabase
        .from('referral_codes')
        .select('user_id')
        .eq('code', referralCode)
        .eq('is_active', true)
        .single();

      if (referrerError) {
        return;
      }

      const testInsert = {
        referrer_id: referrerData.user_id,
        referred_email: userEmail,
        referred_user_id: userId,
        referral_code: referralCode,
        status: 'pending',
        created_at: new Date().toISOString(),
        reward_given: false
      };
      
      const { data: testData, error: testError } = await supabase
        .from('referrals')
        .insert(testInsert)
        .select();
      
      if (testError) {
        return;
      }

      if (referrerData.user_id === userId) {
        return;
      }

      const { data: existingReferral, error: existingError } = await supabase
        .from('referrals')
        .select('id')
        .eq('referred_email', userEmail)
        .eq('referral_code', referralCode)
        .maybeSingle();

      if (existingError) {
      }

      if (existingReferral) {
        return;
      }

      const { data: newReferral, error: referralError } = await supabase
        .from('referrals')
        .insert({
          referrer_id: referrerData.user_id,
          referred_email: userEmail,
          referred_user_id: userId,
          referral_code: referralCode,
          status: 'pending',
          created_at: new Date().toISOString(),
          reward_given: false
        })
        .select()
        .single();

      if (referralError) {
        return;
      }

    } catch (error) {
    }
  };

  // 🔐 Регистрация
  const register = async (fullName, email, password) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            email_verified: false
          }
        }
      });

      if (authError) throw authError;

      const urlCode = localStorage.getItem("referral_code_from_url");
      if (urlCode && authData.user) {
        localStorage.setItem('pending_user_email', email);
        localStorage.setItem('pending_user_id', authData.user.id);
      }

      return authData.user;
    } catch (error) {
      throw error;
    }
  };

  // 🔑 Логин
  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user?.id) {
        supabase
          .from('profiles')
          .update({
            is_online: true,
            last_seen: new Date().toISOString()
          })
          .eq('id', data.user.id)
          .then(({ error: updateError }) => {
            if (updateError) {
            }
          });
      }

      return data.user;
    } catch (error) {
      throw error;
    }
  };

  // 🔵 Google авторизация
  const loginWithGoogle = async () => {
    try {
      const urlCode = localStorage.getItem("referral_code_from_url");
      if (urlCode) {
        localStorage.setItem("pending_referral_code", urlCode);
        localStorage.removeItem("referral_code_from_url");
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) throw error;
    } catch (error) {
      throw error;
    }
  };

  // 🚪 Выход
  const logout = async () => {
    try {
      if (user?.id) {
        try {
          await supabase
            .from('profiles')
            .update({
              is_online: false,
              last_seen: new Date().toISOString()
            })
            .eq('id', user.id);
        } catch (updateError) {
        }
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setIsAuthenticated(false);

      const referralCode = localStorage.getItem(`referral_code_${user?.id}`);
      localStorage.clear();
      if (referralCode && user?.id) {
        localStorage.setItem(`referral_code_${user.id}`, referralCode);
      }

      window.location.href = '/';

    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.clear();
      window.location.href = '/';
    }
  };

  const updateUserState = async (session) => {
    try {
      if (session?.user) {
        const googleName = session.user.user_metadata?.full_name || '';
        const fallbackName = session.user.email?.split('@')[0] || 'User';

        const mergedUser = {
          ...session.user,
          full_name: googleName || fallbackName,
          role: 'user',
          total_points: 0,
          rating: 0,
          theme_preference: 'light',
          uid: session.user.id,
          displayName: googleName || fallbackName
        };

        setUser(mergedUser);
        setIsAuthenticated(true);

        const isEmailConfirmed = Boolean(session.user.email_confirmed_at);
        const isGoogleUser = session.user.app_metadata?.provider === 'google';

        if (session.user.email && (isEmailConfirmed || isGoogleUser)) {
          const referralCode = localStorage.getItem("referral_code_from_url") ||
            localStorage.getItem("pending_referral_code");

          if (referralCode) {
            const { data: existingReferral } = await supabase
              .from('referrals')
              .select('id')
              .eq('referred_email', session.user.email)
              .eq('referral_code', referralCode)
              .maybeSingle();

            if (existingReferral) {
              localStorage.removeItem('pending_user_email');
              localStorage.removeItem('pending_user_id');
              localStorage.removeItem("referral_code_from_url");
              localStorage.removeItem("pending_referral_code");
            } else {
              await handleReferralAfterAuth(session.user.id, session.user.email);
            }
          }
        } else {
          localStorage.setItem('pending_user_email', session.user.email);
          localStorage.setItem('pending_user_id', session.user.id);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // 🔄 Инициализация и отслеживание состояния
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await updateUserState(session);
      } catch (error) {
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        await updateUserState(session);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Обновляем онлайн статус периодически
  useEffect(() => {
    if (!user?.id) return;

    const updateOnlineStatus = async () => {
      try {
        await supabase
          .from('profiles')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', user.id);
      } catch (error) {
      }
    };

    const interval = setInterval(updateOnlineStatus, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        register,
        login,
        loginWithGoogle,
        logout,
        loading,
        handleReferralAfterAuth
      }}
    >
      {children}

      {loading && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-t-cyan-500 border-r-transparent border-b-purple-500 border-l-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="text-white text-2xl font-bold">Yuklanmoqda...</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};