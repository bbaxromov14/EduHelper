// src/Pages/Progress/Progress.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from '../../context/ReactContext.jsx';
import { supabase } from '../../lib/supabase';

const Progress = () => {
  const { user: authUser, isAuthenticated } = useAuth();
  const [progress, setProgress] = useState(null);
  const [courses, setCourses] = useState([]);
  const [userProgress, setUserProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const calculateStreak = (progressData) => {
    if (!progressData?.length) return 0;


    // Получаем уникальные даты завершенных уроков в UTC
    const dates = progressData
      .filter(p => p.completed && p.completed_at)
      .map(p => {
        try {
          // Парсим дату как UTC
          const dateStr = p.completed_at;
          const date = new Date(dateStr);

          if (isNaN(date.getTime())) {
            return null;
          }

          // Получаем дату в формате YYYY-MM-DD в UTC
          const utcDateStr = date.toISOString().split('T')[0];

          return utcDateStr;
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);

    // Уникальные даты
    const uniqueDates = [...new Set(dates)];

    if (uniqueDates.length === 0) {
      return 0;
    }

    // Сортируем по убыванию
    uniqueDates.sort((a, b) => new Date(b) - new Date(a));

    // Текущая дата в UTC
    const now = new Date();
    const todayUTC = now.toISOString().split('T')[0];

    // Проверяем, была ли активность сегодня
    const hasToday = uniqueDates[0] === todayUTC;

    let streak = 0;
    let expectedDate = new Date(hasToday ? todayUTC : uniqueDates[0]);

    for (const dateStr of uniqueDates) {
      const currentDate = new Date(dateStr);

      // Проверяем, совпадает ли дата с ожидаемой
      if (currentDate.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
        streak++;

        // Уменьшаем ожидаемую дату на 1 день
        expectedDate.setUTCDate(expectedDate.getUTCDate() - 1);
      } else {
        // Нашли разрыв
        break;
      }
    }

    return streak;
  };

  // Мемоизированные функции
  const getDefaultProgress = useCallback((coursesData) => {
    const def = {
      points: 0,
      streak: 0,
      lessonsCompleted: 0,
      coursesCompleted: 0,
      coursesInProgress: 0,
      overallProgress: 0,
      completedLessons: [],
      subjectProgress: {}
    };

    coursesData?.forEach(course => {
      def.subjectProgress[course.id] = 0;
    });

    return def;
  }, []);

  const getCourseIcon = useCallback((title) => {
    const icons = {
      'matematika': '🧮',
      'biologiya': '🔬',
      'fizika': '⚛️',
      'python': '🐍',
      'frontend': '💻',
      'ona tili': '📚',
      'adabiyot': '📖',
      'kimyo': '🧪',
      'tarix': '📜',
      'geografiya': '🌍',
      'ingliz tili': '🇬🇧',
      'javascript': '🟨',
      'html': '🌐',
      'css': '🎨',
      'react': '⚛️',
      'dasturlash': '💻'
    };

    const lower = title?.toLowerCase() || '';
    for (const [key, icon] of Object.entries(icons)) {
      if (lower.includes(key)) return icon;
    }
    return '📚';
  }, []);

  // Защищенная функция для показа уведомлений
  const showNotification = useCallback((type, message, duration = 3000) => {
    if (typeof window === 'undefined' || !document?.body) return;

    const oldNotifications = document.querySelectorAll('.eduhelper-notification');
    oldNotifications.forEach(n => {
      if (n.parentNode) n.parentNode.removeChild(n);
    });

    const config = {
      success: {
        bg: 'from-green-600 to-emerald-600',
        icon: '✅',
        title: 'MUVAFFAQIYATLI!'
      },
      error: {
        bg: 'from-red-800 to-red-900',
        icon: '❌',
        title: 'XATOLIK!'
      },
      warning: {
        bg: 'from-yellow-600 to-orange-600',
        icon: '⚠️',
        title: 'DIQQAT!'
      }
    };

    const { bg, icon, title } = config[type] || config.error;

    const notification = document.createElement('div');
    notification.className = `eduhelper-notification fixed top-4 right-4 bg-gradient-to-r ${bg} text-white px-6 py-4 rounded-2xl font-bold text-lg shadow-2xl z-[9999]`;
    notification.style.cssText = `
      animation: eduhelper-fade-in 0.3s ease-out forwards;
      max-width: 400px;
      word-break: break-word;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
    `;

    notification.innerHTML = `
      <div class="flex items-start gap-3">
        <span class="text-2xl flex-shrink-0">${icon}</span>
        <div class="flex-1 min-w-0">
          <div class="font-black text-lg mb-1">${title}</div>
          <div class="text-sm opacity-90 font-medium leading-tight">${message}</div>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'eduhelper-fade-out 0.3s ease-out forwards';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 500);
    }, duration);
  }, []);

  // Добавление CSS анимаций
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const styleId = 'eduhelper-animations';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes eduhelper-fade-in {
        from {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes eduhelper-fade-out {
        from {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        to {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
      }
      @keyframes eduhelper-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      const styleEl = document.getElementById(styleId);
      if (styleEl) document.head.removeChild(styleEl);
    };
  }, []);

  // Расчет прогресса
  const calculateProgress = useCallback((coursesData, progressData, userId, totalPoints = 0) => {
    if (!coursesData?.length) {
      return getDefaultProgress(coursesData);
    }

    let lessonsCompleted = 0;
    let coursesCompleted = 0;
    let coursesInProgress = 0;
    const subjectProgress = {};

    // Считаем завершенные уроки
    progressData?.forEach(item => {
      if (item.completed) {
        lessonsCompleted++;
      }
    });

    // Считаем прогресс по курсам
    coursesData.forEach(course => {
      const courseProgress = progressData?.filter(p => p.course_id === course.id) || [];
      const uniqueCompleted = new Set(
        courseProgress
          .filter(p => p.completed)
          .map(p => p.lesson_id)
      );

      const completedInCourse = uniqueCompleted.size;
      const totalInCourse = course.lessons?.[0]?.count || 0;

      const percentage = totalInCourse > 0
        ? Math.round((completedInCourse / totalInCourse) * 100)
        : 0;

      subjectProgress[course.id] = percentage;

      if (percentage === 100) {
        coursesCompleted++;
      } else if (percentage > 0) {
        coursesInProgress++;
      }
    });

    const totalLessons = coursesData.reduce((sum, c) => sum + (c.lessons?.[0]?.count || 0), 0);
    const overallProgress = totalLessons > 0
      ? Math.round((lessonsCompleted / totalLessons) * 100)
      : 0;

    // 🔴 ИСПРАВЛЕНО: используем правильную функцию расчета streak
    const streak = calculateStreak(progressData);

    return {
      user_id: userId,
      points: totalPoints,
      streak,
      lessonsCompleted,
      coursesCompleted,
      coursesInProgress,
      overallProgress,
      completedLessons: progressData?.filter(p => p.completed) || [],
      subjectProgress,
      last_updated: new Date().toISOString()
    };
  }, [getDefaultProgress]);

  // Загрузка данных
  // В useEffect после загрузки данных:
  useEffect(() => {
    if (!isAuthenticated || !authUser) return;

    let isMounted = true;
    const controller = new AbortController();

    const loadData = async () => {
      if (!isMounted) return;

      try {
        setLoading(true);


        // 1. Загружаем курсы
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select(`
          *,
          lessons:lessons(count)
        `)
          .eq('is_published', true)
          .abortSignal(controller.signal);

        if (!isMounted) return;

        if (coursesError) {
          if (coursesError.code !== 'ABORTED') {
            console.error('❌ Ошибка загрузки курсов:', coursesError);
            throw coursesError;
          }
          return;
        }

        if (!isMounted) return;
        setCourses(coursesData || []);

        // 2. Загружаем прогресс уроков
        const { data: progressData, error: progressError } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', authUser.id)
          .abortSignal(controller.signal);

        if (!isMounted) return;

        if (progressError) {
          if (progressError.code !== 'ABORTED') {
            console.error('❌ Ошибка загрузки прогресса:', progressError);
            throw progressError;
          }
          return;
        }

        if (!isMounted) return;
        setUserProgress(progressData || []);

        // 3. Загружаем баллы из тестов
        let totalPoints = 0;
        try {
          const { data: testResults = [], error: testError } = await supabase
            .from('test_results')
            .select('points_earned')
            .eq('user_id', authUser.id)
            .abortSignal(controller.signal);

          if (!isMounted) return;

          if (!testError) {
            totalPoints = testResults.reduce((sum, r) => sum + (r.points_earned || 0), 0);
          }
        } catch (testLoadError) {
          console.warn('⚠️ Ошибка загрузки тестов:', testLoadError);
        }

        // 4. Рассчитываем статистику
        if (!isMounted) return;
        const calculatedProgress = calculateProgress(coursesData, progressData, authUser.id, totalPoints);
        setProgress(calculatedProgress);

      } catch (error) {
        if (!isMounted || error.code === 'ABORTED') return;

        console.error("🔥 Критическая ошибка загрузки прогресса:", error);
        if (isMounted) {
          const defaultProgress = getDefaultProgress(courses);
          setProgress(defaultProgress);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    // Real-time подписки
    let progressSubscription;
    let testResultsSubscription;

    try {
      progressSubscription = supabase
        .channel(`progress_${authUser.id}`)
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_progress',
            filter: `user_id=eq.${authUser.id}`
          },
          () => {
            if (isMounted) {
              loadData();
            }
          }
        )
        .subscribe();

      testResultsSubscription = supabase
        .channel(`test_results_${authUser.id}`)
        .on('postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'test_results',
            filter: `user_id=eq.${authUser.id}`
          },
          () => {
            if (isMounted) {
              loadData();
            }
          }
        )
        .subscribe();
    } catch (subscriptionError) {
      console.warn('⚠️ Ошибка подписки:', subscriptionError);
    }

    return () => {
      isMounted = false;
      controller.abort();

      if (progressSubscription) {
        progressSubscription.unsubscribe();
      }
      if (testResultsSubscription) {
        testResultsSubscription.unsubscribe();
      }
    };
  }, [isAuthenticated, authUser, forceRefresh, calculateProgress, getDefaultProgress]);

  // ПОЛНАЯ ФУНКЦИЯ СБРОСА ВСЕХ ДАННЫХ
  const resetProgress = async () => {
    if (!authUser?.id) {
      showNotification('error', "Avtorizatsiya talab qilinadi");
      return;
    }

    const confirmText = `
  ╔═══════════════════════════════════════════╗
  ║          ⚠️  DIQQAT  ⚠️                  ║
  ╚═══════════════════════════════════════════╝
  
  BU AMALNI QAYTARIB BO'LMAYDI!
  
  O'chiriladigan ma'lumotlar:
  • ${progress?.lessonsCompleted || 0} ta tugallangan dars
  • ${progress?.coursesCompleted || 0} ta tugallangan kurs  
  • ${progress?.points || 0} ball
  • ${progress?.streak || 0} kunlik strek
  • Barcha test natijalari
  
  Rostan ham DAVOM ETMOQCHIMISIZ?
  
  Javobingizni yozing: "O'CHIRISH"
    `;

    const userInput = prompt(confirmText);

    if (userInput?.trim().toUpperCase() !== "O'CHIRISH") {
      showNotification('info', "Amal bekor qilindi");
      return;
    }

    setIsResetting(true);
    showNotification('warning', "🔧 Ma'lumotlar o'chirilmoqda...", 5000);

    try {
      const userId = authUser.id;

      // 1. Показываем лоадер
      const loader = document.createElement('div');
      loader.id = 'reset-loader';
      loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: white;
        font-size: 1.5rem;
        backdrop-filter: blur(10px);
      `;
      loader.innerHTML = `
        <div style="margin-bottom: 20px; animation: spin 1s linear infinite; font-size: 4rem;">🔄</div>
        <div style="font-weight: bold; margin-bottom: 10px;">Ma'lumotlar o'chirilmoqda...</div>
        <div style="font-size: 0.9rem; opacity: 0.8; text-align: center; max-width: 300px;">
          Bu bir necha soniya davom etishi mumkin.<br>
          Iltimos, sabr qiling...
        </div>
        <style>
          @keyframes spin { 100% { transform: rotate(360deg); } }
        </style>
      `;
      document.body.appendChild(loader);

      // 2. Удаляем данные из Supabase
      let progressDeleted = false;
      let testsDeleted = false;

      // Попытка удаления прогресса уроков
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { error } = await supabase
            .from('user_progress')
            .delete()
            .eq('user_id', userId);

          if (!error) {
            progressDeleted = true;
            break;
          }

          if (attempt === 3) {
            throw new Error(`Не удалось удалить прогресс: ${error.message}`);
          }

          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        } catch (err) {
          if (attempt === 3) throw err;
        }
      }

      // Попытка удаления тестов
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { error } = await supabase
            .from('test_results')
            .delete()
            .eq('user_id', userId);

          if (!error) {
            testsDeleted = true;
            break;
          }

          if (attempt === 3) {
            throw new Error(`Не удалось удалить тесты: ${error.message}`);
          }

          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        } catch (err) {
          if (attempt === 3) throw err;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // 3. Очищаем кеши
      const clearAllStorage = () => {
        try {
          localStorage.clear();
          sessionStorage.clear();

          if ('indexedDB' in window) {
            indexedDB.databases?.().then(dbs => {
              dbs.forEach(db => {
                indexedDB.deleteDatabase(db.name);
              });
            });
          }

          if ('caches' in window) {
            caches.keys().then(keys => {
              keys.forEach(key => caches.delete(key));
            });
          }

          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
              registrations.forEach(registration => registration.unregister());
            });
          }
        } catch (e) {
          console.warn('Очистка хранилища:', e);
        }
      };

      clearAllStorage();

      // 4. Показываем успех
      const successMessage = `
  ✅ BARCHA MA'LUМOTLAR O'CHIRILDI!
  
  Natijalar:
  • Darslar progressi: ${progressDeleted ? '✅ O\'chirildi' : '❌ Xato'}
  • Test natijalari: ${testsDeleted ? '✅ O\'chirildi' : '❌ Xato'}
  • Local storage: ✅ Tozalandi
  
  Sahifa qayta yuklanmoqda...
      `;

      if (loader.parentNode) {
        loader.innerHTML = `
          <div style="margin-bottom: 20px; font-size: 4rem; animation: bounce 1s infinite;">🎉</div>
          <div style="font-weight: bold; margin-bottom: 20px; color: #10b981; font-size: 1.8rem;">
            MUVAFFAQIYATLI!
          </div>
          <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 10px; 
                       border: 2px solid #10b981; max-width: 400px; text-align: left; font-size: 0.9rem;">
            ${successMessage.split('\n').map(line => `<div style="margin-bottom: 5px;">${line}</div>`).join('')}
          </div>
          <style>
            @keyframes bounce { 
              0%, 100% { transform: translateY(0); } 
              50% { transform: translateY(-10px); } 
            }
          </style>
        `;
      }

      // 5. Перезагрузка
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/progress';
        }
      }, 3000);

    } catch (error) {
      console.error('🔥 Сброс прогрессада хатолик:', error);

      const loader = document.getElementById('reset-loader');
      if (loader && loader.parentNode) {
        loader.parentNode.removeChild(loader);
      }

      let errorMessage = "Noma'lum xatolik";
      if (error.message.includes('network') || !navigator.onLine) {
        errorMessage = "Internet aloqasi yo'q. Iltimos, internetingizni tekshiring.";
      } else if (error.message.includes('auth') || error.message.includes('token')) {
        errorMessage = "Avtorizatsiya muammosi. Iltimos, tizimga qayta kiring.";
      } else if (error.message.includes('timeout') || error.message.includes('vaqt')) {
        errorMessage = "Server javob bermadi. Iltimos, keyinroq urinib ko'ring.";
      } else {
        errorMessage = `Texnik xatolik: ${error.message.substring(0, 100)}...`;
      }

      showNotification('error', errorMessage, 5000);

    } finally {
      setIsResetting(false);

      setTimeout(() => {
        const loader = document.getElementById('reset-loader');
        if (loader && loader.parentNode) {
          loader.parentNode.removeChild(loader);
        }
      }, 10000);
    }
  };

  // UI состояния
  if (!isAuthenticated || !authUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-3xl font-bold text-white mb-4">Progressni ko'rish uchun</h1>
          <p className="text-gray-300 mb-8">Iltimos, tizimga kiring yoki ro'yxatdan o'ting</p>
          <a
            href="/login"
            className="inline-block px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full font-bold hover:scale-105 transition-transform duration-300 hover:shadow-2xl"
            aria-label="Kirish sahifasiga o'tish"
          >
            Kirish sahifasiga o'tish
          </a>
        </div>
      </div>
    );
  }

  if (loading || !progress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-white"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-600 to-pink-600"></div>
            </div>
          </div>
          <div className="text-2xl font-black text-white animate-pulse">
            Progress yuklanmoqda...
          </div>
          <div className="text-gray-300 text-center max-w-md">
            Sizning ma'lumotlaringiz xavfsiz yuklanmoqda
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white py-8 sm:py-12 md:py-16 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-8 sm:mb-12 md:mb-16">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black mb-4 sm:mb-6">
          <span className="text-transparent text-3xl sm:text-4xl md:text-5xl lg:text-6xl bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400">
            {authUser?.full_name || authUser?.username || authUser?.email?.split('@')[0] || "O'quvchi"}ning Yo'li
          </span>
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl opacity-90">
          Har bir dars — bu yangi cho'qqi
        </p>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Профиль пользователя */}
        <div className="relative bg-black/30 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 lg:p-10 mb-8 sm:mb-12 border border-white/20 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 md:gap-8">
            <div className="flex items-center gap-4 sm:gap-6 md:gap-8">
              <div className="relative">
                <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 bg-gradient-to-br from-yellow-400 to-pink-600 rounded-full flex items-center justify-center text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black shadow-2xl ring-4 ring-white/20">
                  {authUser?.username?.[0]?.toUpperCase() ||
                    authUser?.full_name?.[0]?.toUpperCase() ||
                    authUser?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                {progress.streak > 0 && (
                  <div className="absolute -top-2 -right-2 sm:-top-3 sm:-right-3 md:-top-4 md:-right-4 bg-gradient-to-r from-red-600 to-orange-500 text-white px-2 sm:px-3 md:px-4 py-1 sm:py-2 rounded-full font-bold text-sm sm:text-base md:text-lg lg:text-xl shadow-lg animate-pulse">
                    {progress.streak} 🔥
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black">
                  {authUser?.full_name || authUser?.username || "Foydalanuvchi"}
                </h2>
                <p className="text-sm sm:text-base md:text-lg lg:text-xl opacity-80">
                  {authUser?.email || "email@example.com"}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs sm:text-sm md:text-base text-gray-400">
                    ID: {authUser.id?.substring(0, 8)}...
                  </span>
                  <span className="text-xs px-2 py-1 bg-green-900/30 rounded-full">
                    ✅ Faol
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 mt-4 md:mt-0">
              <div className="text-center">
                <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-yellow-400">
                  {progress.points}
                </div>
                <div className="text-sm sm:text-base md:text-lg lg:text-xl opacity-80">Ballar</div>
              </div>

              <button
                onClick={resetProgress}
                disabled={isResetting}
                className={`group px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base md:text-lg lg:text-xl transition-all flex items-center gap-2 sm:gap-3 shadow-lg ${isResetting
                  ? 'bg-gray-600 cursor-not-allowed opacity-70'
                  : 'bg-gradient-to-r from-red-600 via-red-500 to-red-600 hover:from-red-700 hover:via-red-600 hover:to-red-700 hover:scale-105 hover:shadow-red-500/30'
                  }`}
                aria-label={isResetting ? "Jarayon davom etmoqda" : "Barcha natijalarni tozalash"}
                title={isResetting ? "Iltimos, kutib turing..." : "Barcha ma'lumotlarni o'chirish"}
              >
                <span className={`text-lg sm:text-xl md:text-2xl ${isResetting ? 'animate-spin' : ''}`}>
                  {isResetting ? '🔄' : '🗑️'}
                </span>
                <span className="relative">
                  {isResetting ? 'Jarayon davom etmoqda...' : 'Barcha natijalarni tozalash'}
                  {!isResetting && (
                    <span className="absolute -bottom-1 left-0 w-0 group-hover:w-full h-0.5 bg-white transition-all duration-300"></span>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-12 md:mb-16">
          {[
            {
              value: progress.lessonsCompleted,
              label: "Bajarilgan dars",
              icon: "✅",
              color: "from-green-500 to-emerald-600",
              tooltip: "Tugallangan darslar soni"
            },
            {
              value: progress.coursesCompleted,
              label: "Tugallangan kurs",
              icon: "🏆",
              color: "from-yellow-500 to-orange-600",
              tooltip: "Tugallangan kurslar soni"
            },
            {
              value: progress.streak, // ← ИЗМЕНЕНО: было progress.coursesInProgress
              label: "Streak",
              icon: "🔥",
              color: "from-red-500 to-pink-600",
              tooltip: "Ketma-ket kunlar soni"
            },
            {
              value: `${progress.overallProgress}%`,
              label: "Umumiy natija",
              icon: "🚀",
              color: "from-purple-500 to-indigo-600",
              tooltip: "Umumiy progress foizi"
            },
          ].map((item, i) => (
            <div
              key={i}
              className="group relative bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 text-center border border-white/20 hover:border-white/50 transition-all duration-300 hover:scale-105"
              title={item.tooltip}
            >
              <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 mx-auto mb-2 sm:mb-3 md:mb-4 bg-gradient-to-br ${item.color} rounded-lg sm:rounded-xl md:rounded-2xl flex items-center justify-center text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl shadow-2xl`}>
                {item.icon}
              </div>
              <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black mb-1 sm:mb-2">
                {item.value}
              </div>
              <div className="text-xs sm:text-sm md:text-base lg:text-lg opacity-80">
                {item.label}
              </div>

              {/* Подсказка при наведении */}
              {item.tooltip && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 backdrop-blur-sm text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 pointer-events-none whitespace-nowrap z-10 border border-white/20">
                  {item.tooltip}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black/90"></div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Круговой прогресс */}
        <div className="flex justify-center mb-8 sm:mb-12 md:mb-16">
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-72 lg:h-72 xl:w-80 xl:h-80">
            <svg
              className="w-full h-full transform -rotate-90"
              viewBox="0 0 100 100"
              aria-label={`Umumiy progress: ${progress.overallProgress}%`}
            >
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="url(#progressGradient)"
                strokeWidth="8"
                fill="none"
                strokeDasharray="282.743"
                strokeDashoffset={282.743 * (1 - progress.overallProgress / 100)}
                className="transition-all duration-2000 ease-out"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-7xl font-black">
                  {progress.overallProgress}%
                </div>
                <div className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl opacity-80">
                  Tugallandi
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Прогресс по курсам */}
        <div className="bg-black/30 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 lg:p-10 border border-white/20 mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-center mb-6 sm:mb-8 md:mb-10">
            📊 Kurslar bo'yicha progress
          </h2>

          {courses.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-6">📭</div>
              <p className="text-xl mb-2">Hozircha kurslar mavjud emas</p>
              <p className="text-gray-400">Tez orada yangi kurslar qo'shiladi</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
              {courses.map(course => {
                const progressPercentage = progress.subjectProgress[course.id] || 0;
                const totalLessons = course.lessons?.[0]?.count || 0;
                const completedLessonsInCourse = userProgress.filter(p =>
                  p.course_id === course.id && p.completed
                ).length;

                return (
                  <div
                    key={course.id}
                    className="group bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 border border-white/10 hover:border-white/30 transition-all duration-300 hover:scale-105"
                  >
                    <div className="flex justify-between items-start mb-2 sm:mb-3 md:mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold line-clamp-1">
                          {course.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-400 mt-1 line-clamp-1">
                          {course.description || "Tavsif yo'q"}
                        </p>
                      </div>
                      <span className="text-2xl sm:text-3xl md:text-4xl ml-2 flex-shrink-0">
                        {getCourseIcon(course.title)}
                      </span>
                    </div>

                    <div className="text-2xl sm:text-3xl md:text-4xl font-black mb-2 sm:mb-3">
                      {progressPercentage}%
                    </div>

                    <div className="w-full bg-white/10 rounded-full h-3 sm:h-4 md:h-5 lg:h-6 overflow-hidden mb-2">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-1000"
                        style={{ width: `${progressPercentage}%` }}
                        role="progressbar"
                        aria-valuenow={progressPercentage}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      />
                    </div>

                    <div className="flex justify-between text-xs sm:text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <span>📚</span>
                        {completedLessonsInCourse}/{totalLessons} dars
                      </span>
                      <span className={course.is_free ? 'text-green-400' : 'text-yellow-400 flex items-center gap-1'}>
                        {course.is_free ? '🆓 Bepul' : '⭐ Premium'}
                      </span>
                    </div>

                    {progressPercentage === 100 && totalLessons > 0 && (
                      <div className="mt-3 text-center">
                        <span className="inline-block px-2 py-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs rounded-full">
                          🏆 Tugallandi
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>


        {/* Мотивационное сообщение */}
        <div className="text-center mt-8 sm:mt-12 md:mt-16 lg:mt-20">
          <div className="inline-block px-6 sm:px-8 md:px-12 lg:px-16 py-3 sm:py-4 md:py-6 lg:py-8 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-lg sm:text-xl md:text-2xl lg:text-3xl font-black rounded-lg sm:rounded-xl md:rounded-2xl lg:rounded-full shadow-2xl hover:scale-105 transition-all duration-300 hover:shadow-yellow-500/30">
            🚀 DAVOM ETAMIZ!
          </div>
          <p className="text-gray-300 mt-4 text-sm sm:text-base md:text-lg max-w-2xl mx-auto">
            Har bir kichik qadam katta yutuqlarga olib keladi. Bugun o'rganayotganingiz har bir narsa kelajagingiz uchun mustahkam poydevor bo'ladi.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Progress;