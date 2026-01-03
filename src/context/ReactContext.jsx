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
      // Проверяем, есть ли активная сессия
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.warn("⚠️ Нет активной сессии, пропускаем обработку реферала");
        return;
      }

      console.log("🔑 Активная сессия:", session.user.email);

      // Проверяем, есть ли сохраненный реферальный код
      const pendingCode = localStorage.getItem("pending_referral_code");
      const urlCode = localStorage.getItem("referral_code_from_url");

      const codeToUse = pendingCode || urlCode;

      if (!codeToUse) {
        console.log("ℹ️ Нет реферального кода для обработки");
        return;
      }

      console.log("🎯 Найден реферальный код для обработки:", codeToUse);

      await processReferral(userId, userEmail, codeToUse);

      // Очищаем ВСЕ реферальные данные после успешной обработки
      localStorage.removeItem("pending_referral_code");
      localStorage.removeItem("referral_code_from_url");
      localStorage.removeItem('pending_user_email');
      localStorage.removeItem('pending_user_id');
      localStorage.removeItem('pending_referral_data');

    } catch (error) {
      console.error("💥 Ошибка в handleReferralAfterAuth:", error);
    }
  }, []);

  const processReferral = async (userId, userEmail, referralCode) => {
    try {
      console.log("🎯 === START processReferral ===");
      console.log("📝 Параметры:", { userId, userEmail, referralCode });

      // Проверка сессии
      const { data: { session } } = await supabase.auth.getSession();
      console.log("📱 Сессия:", session?.user?.email);

      if (!session) {
        console.error("❌ Нет активной сессии! Прерываем");
        return;
      }

      console.log("✅ Активная сессия найдена:", session.user.email);

      // 1. Находим пользователя, который создал этот код
      console.log("🔍 Ищем реферальный код...");
      const { data: referrerData, error: referrerError } = await supabase
        .from('referral_codes')
        .select('user_id')
        .eq('code', referralCode)
        .eq('is_active', true)
        .single();

      if (referrerError) {
        console.error("❌ Ошибка поиска кода:", referrerError);
        console.error("Детали:", referrerError.message);
        return;
      }

      console.log("✅ Найден реферальный код, создатель:", referrerData.user_id);
      console.log("🔄 Проверяем возможность вставки...");
      const testInsert = {
        referrer_id: referrerData.user_id,
        referred_email: userEmail,
        referred_user_id: userId,
        referral_code: referralCode,
        status: 'pending',
        created_at: new Date().toISOString(),
        reward_given: false
      };
      
      console.log("📝 Тестовые данные:", testInsert);
      
      // Попробуйте без .single() сначала
      const { data: testData, error: testError } = await supabase
        .from('referrals')
        .insert(testInsert)
        .select();
      
      console.log("📊 Результат теста:", testData);
      console.log("❌ Ошибка теста:", testError);
      
      if (testError) {
        console.error("💥 Детали ошибки:", {
          message: testError.message,
          code: testError.code,
          details: testError.details,
          hint: testError.hint
        });
        return; // Прерываем если ошибка
      }
      
      console.log("✅ Тестовая вставка успешна!");

      // 2. Проверяем, не пытается ли пользователь использовать свой же код
      if (referrerData.user_id === userId) {
        console.log("❌ Пользователь не может использовать свой код");
        return;
      }

      // 3. Проверяем, не существует ли уже реферал
      console.log("🔍 Проверяем существующий реферал...");
      const { data: existingReferral, error: existingError } = await supabase
        .from('referrals')
        .select('id')
        .eq('referred_email', userEmail)
        .eq('referral_code', referralCode)
        .maybeSingle();

      if (existingError) {
        console.warn("⚠️ Ошибка проверки реферала:", existingError);
      }

      if (existingReferral) {
        console.log("✅ Реферал уже существует");
        return;
      }

      // 4. Сохраняем реферал
      console.log("💾 Сохраняем реферал в базу...");
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
        console.error("❌ Ошибка сохранения:", referralError);
        console.error("Код ошибки:", referralError.code);
        console.error("Сообщение:", referralError.message);
        console.error("Детали:", referralError.details);
        return;
      }

      console.log("🎉 Реферал успешно сохранен!", newReferral);
      console.log("🏁 === END processReferral ===");

    } catch (error) {
      console.error("💥 === ERROR in processReferral ===");
      console.error("Ошибка:", error);
      console.error("Stack:", error.stack);
    }
  };

  // 🔐 Регистрация
  const register = async (fullName, email, password) => {
    try {
      // ТОЛЬКО регистрация в auth - профиль создастся через триггер
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

      // НЕ обрабатываем реферал здесь!
      // Пользователь должен сначала подтвердить email
      // Реферальный код останется в localStorage и обработается после подтверждения

      const urlCode = localStorage.getItem("referral_code_from_url");
      if (urlCode && authData.user) {
        console.log("✅ Реферальный код сохранен для обработки после подтверждения email");
        // Сохраняем данные пользователя для отложенной обработки
        localStorage.setItem('pending_user_email', email);
        localStorage.setItem('pending_user_id', authData.user.id);
      }

      return authData.user;
    } catch (error) {
      console.error("Ошибка регистрации:", error);
      throw error;
    }
  };

  // 🔑 Логин
  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user?.id) {
        // Обновляем статус
        supabase
          .from('profiles')
          .update({
            is_online: true,
            last_seen: new Date().toISOString()
          })
          .eq('id', data.user.id)
          .then(({ error: updateError }) => {
            if (updateError) {
              console.warn('Не удалось обновить статус входа:', updateError.message);
            }
          });
      }

      return data.user;
    } catch (error) {
      console.error("Ошибка входа:", error);
      throw error;
    }
  };

  // 🔵 Google авторизация
  const loginWithGoogle = async () => {
    try {
      // Сохраняем реферальный код перед редиректом
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
      console.error("Ошибка Google входа:", error);
      throw error;
    }
  };

  // 🚪 Выход
  const logout = async () => {
    try {
      if (user?.id) {
        // Обновляем статус
        try {
          await supabase
            .from('profiles')
            .update({
              is_online: false,
              last_seen: new Date().toISOString()
            })
            .eq('id', user.id);
        } catch (updateError) {
          console.warn("Не удалось обновить статус выхода:", updateError.message);
        }
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setIsAuthenticated(false);

      // Очищаем все localStorage кроме реферальных кодов
      const referralCode = localStorage.getItem(`referral_code_${user?.id}`);
      localStorage.clear();
      if (referralCode && user?.id) {
        localStorage.setItem(`referral_code_${user.id}`, referralCode);
      }

      // Перенаправляем на главную
      window.location.href = '/';

    } catch (error) {
      console.error("Ошибка выхода:", error);
      setUser(null);
      setIsAuthenticated(false);
      localStorage.clear();
      window.location.href = '/';
    }
  };

  const updateUserState = async (session) => {
    try {
      if (session?.user) {
        console.log("📊 Статус рефералов для пользователя:", {
          email: session.user.email,
          emailConfirmed: session.user.email_confirmed_at,
          hasReferralCode: !!(localStorage.getItem("referral_code_from_url") ||
            localStorage.getItem("pending_referral_code")),
          pendingEmail: localStorage.getItem('pending_user_email'),
          pendingUserId: localStorage.getItem('pending_user_id')
        });

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

        // Обрабатываем рефералы только если email подтвержден
        const isEmailConfirmed = Boolean(session.user.email_confirmed_at);
        const isGoogleUser = session.user.app_metadata?.provider === 'google';

        if (session.user.email && (isEmailConfirmed || isGoogleUser)) {
          console.log("✅ Email подтвержден, проверяем рефералы...");

          // Проверяем есть ли уже реферал для этого email
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
              console.log("✅ Реферал уже существует, очищаем данные...");
              // Очищаем данные
              localStorage.removeItem('pending_user_email');
              localStorage.removeItem('pending_user_id');
              localStorage.removeItem("referral_code_from_url");
              localStorage.removeItem("pending_referral_code");
            } else {
              console.log("🔄 Обрабатываем реферал...");
              await handleReferralAfterAuth(session.user.id, session.user.email);
            }
          } else {
            console.log("ℹ️ Нет реферального кода для обработки");
          }
        } else {
          console.log("⚠️ Email не подтвержден, сохраняем для отложенной обработки");

          // Сохраняем в localStorage для обработки после подтверждения
          localStorage.setItem('pending_user_email', session.user.email);
          localStorage.setItem('pending_user_id', session.user.id);
        }
      } else {
        // Сессия null или user null
        console.log("ℹ️ Нет активной сессии");
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Ошибка в updateUserState:", error);
      // При ошибке также сбрасываем состояние
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
        console.log("🔍 Инициализация аутентификации, сессия:", session);
        await updateUserState(session);
      } catch (error) {
        console.error("Ошибка инициализации аутентификации:", error);
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🔄 Изменение состояния аутентификации:", event, session);
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
        console.warn("Ошибка обновления онлайн статуса:", error.message);
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

      {/* Глобальный лоадер пока loading */}
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