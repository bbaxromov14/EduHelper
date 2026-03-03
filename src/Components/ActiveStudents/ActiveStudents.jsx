import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/ReactContext';

const ACTIVE_THRESHOLD = 60 * 1000; // 1 минута неактивности = оффлайн
const UPDATE_INTERVAL = 30 * 1000;  // обновляем каждые 30 сек

const ActiveStudents = () => {
  const { t } = useTranslation();
  const [activeCount, setActiveCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const sessionId = useRef(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Обновляем свою активность в Supabase
  const updateMyActivity = async () => {
    if (!isAuthenticated || !user?.id) return;

    try {
      const { error } = await supabase
        .from('activeusers')
        .upsert({
          id: user.id,
          uid: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || t('user_default_name') || 'User',
          last_activity: Date.now(),
          session_id: sessionId.current,
          updated_at: new Date().toISOString(),
          is_active: true
        });

      if (error) throw error;
      setIsOnline(true);
    } catch (error) {
      console.error(t('activity_update_error') || "Ошибка обновления активности:", error);
      setIsOnline(false);
    }
  };

  // Удаляем свою запись при выходе/закрытии
  const removeMyActivity = async () => {
    if (!isAuthenticated || !user?.id) return;

    try {
      const { error } = await supabase
        .from('activeusers')
        .delete()
        .eq('id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error(t('activity_remove_error') || "Ошибка удаления активности:", error);
    }
  };

  // Загружаем активных пользователей
  useEffect(() => {
    if (!isAuthenticated) return;

    // Первое обновление
    updateMyActivity();

    // Подписка на активных пользователей в реальном времени через Supabase Realtime
    const channel = supabase
      .channel('active-users-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activeusers',
        },
        async () => {
          // После любого изменения пересчитываем активных
          const now = Date.now();
          const { data, error } = await supabase
            .from('activeusers')
            .select('*');

          if (!error && data) {
            const count = data.filter(user => {
              const lastActivity = user.last_activity || 0;
              return now - lastActivity < ACTIVE_THRESHOLD;
            }).length;
            setActiveCount(count);
          }
        }
      )
      .subscribe();

    // Периодическое обновление своей активности
    const intervalId = setInterval(() => {
      updateMyActivity();
    }, UPDATE_INTERVAL);

    // Очистка при размонтировании/выходе
    const handleBeforeUnload = () => {
      removeMyActivity();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Также обновляем при активности пользователя
    const activityEvents = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    const handleUserActivity = () => {
      updateMyActivity();
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
      removeMyActivity();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [isAuthenticated, user, t]);

  // Автоматическая очистка устаревших записей (раз в 5 минут)
  useEffect(() => {
    const cleanupOldEntries = async () => {
      try {
        const now = Date.now();
        const { data, error } = await supabase
          .from('activeusers')
          .select('*');

        if (!error && data) {
          const cleanupPromises = data
            .filter(userData => {
              const lastActivity = userData.last_activity || 0;
              return now - lastActivity > 2 * ACTIVE_THRESHOLD;
            })
            .map(userData =>
              supabase
                .from('activeusers')
                .delete()
                .eq('id', userData.id)
            );

          if (cleanupPromises.length > 0) {
            await Promise.all(cleanupPromises);
          }
        }
      } catch (error) {
        console.error(t('cleanup_error') || "Ошибка очистки устаревших записей:", error);
      }
    };

    cleanupOldEntries();
    const cleanupInterval = setInterval(cleanupOldEntries, 5 * 60 * 1000);

    return () => clearInterval(cleanupInterval);
  }, [t]);

  // Функция для получения правильного текста описания
  const getDescriptionText = () => {
    if (activeCount > 1) {
      return t('multiple_students_online', { count: activeCount }) || `${activeCount} students currently online`;
    } else if (activeCount === 1) {
      return t('only_you_online') || "You are the only one online";
    } else {
      return t('loading_online_users') || "Loading online users...";
    }
  };

  return (
    <div className="stat">
      <div className="stat-figure text-primary">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="inline-block w-8 h-8 stroke-current"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          ></path>
        </svg>
      </div>

      <div className="stat-title text-gray-600 dark:text-gray-300">
        {t('active_students')}
        {isOnline && (
          <span className="ml-2 inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        )}
      </div>

      <div className="stat-value text-primary dark:text-blue-400">
        {activeCount}
      </div>

      <div className="stat-desc text-gray-500 dark:text-gray-400">
        {getDescriptionText()}
      </div>
    </div>
  );
};

export default ActiveStudents;