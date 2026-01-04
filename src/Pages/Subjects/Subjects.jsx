import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/ReactContext';
import { checkPremiumStatus, getPremiumInfo } from '../../utils/premiumManager'; // Исправлен импорт

const Subjects = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalLessons: 0, totalCourses: 0 });
  const [userPremiumInfo, setUserPremiumInfo] = useState(null);
  const [checkingPremium, setCheckingPremium] = useState(false);
  const { isAuthenticated, userData } = useAuth();

  // Анимация fadeUp
  useEffect(() => {
    if (!document.getElementById('fadeUpAnimation')) {
      const style = document.createElement('style');
      style.id = 'fadeUpAnimation';
      style.innerHTML = `
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(60px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }

    return () => {
      const style = document.getElementById('fadeUpAnimation');
      if (style) document.head.removeChild(style);
    };
  }, []);

  // Загрузка Premium статуса пользователя с улучшенной отладкой
  useEffect(() => {
    const loadPremiumStatus = async () => {
      console.log('=== ЗАГРУЗКА PREMIUM СТАТУСА ===');
      console.log('isAuthenticated:', isAuthenticated);
      console.log('userData:', userData);
      
      if (isAuthenticated && userData?.profile?.id) {
        setCheckingPremium(true);
        try {
          console.log('🔄 Запрашиваю Premium статус для пользователя:', userData.profile.id);
          
          // Прямой запрос к базе для проверки
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('is_premium, premium_until, premium_type')
            .eq('id', userData.profile.id)
            .single();
          
          if (profileError) {
            console.error('❌ Ошибка загрузки профиля:', profileError);
          } else {
            console.log('📊 Данные профиля из базы:', profileData);
            
            // Проверяем дату
            if (profileData.premium_until) {
              const premiumUntil = new Date(profileData.premium_until);
              const now = new Date();
              const isActive = premiumUntil > now;
              
              console.log('📅 Проверка даты Premium:', {
                premium_until: premiumUntil,
                now: now,
                is_future: isActive,
                days_left: Math.ceil((premiumUntil - now) / (1000 * 60 * 60 * 24))
              });
            }
          }
          
          // Получаем информацию через premiumManager
          const premiumInfo = await getPremiumInfo(userData.profile.id);
          console.log('🎯 Результат premiumManager:', premiumInfo);
          
          setUserPremiumInfo(premiumInfo);
          
        } catch (error) {
          console.error('❌ Ошибка загрузки Premium статуса:', error);
          setUserPremiumInfo({ is_premium: false });
        } finally {
          setCheckingPremium(false);
        }
      } else {
        console.log('👤 Пользователь не авторизован или нет ID');
        setUserPremiumInfo({ is_premium: false });
      }
    };

    loadPremiumStatus();
  }, [isAuthenticated, userData]);

  // Загрузка курсов с улучшенной отладкой
  useEffect(() => {
    const loadCourses = async () => {
      try {
        setLoading(true);
        console.log('📚 Начинаем загрузку курсов...');

        const { data: coursesData, error } = await supabase
          .from('courses')
          .select('*, lessons:lessons(*)')
          .order('created_at', { ascending: false });

        if (error) throw error;

        console.log('✅ Загружено курсов:', coursesData?.length);

        // Обогащаем курсы информацией о доступе
        const enrichedCourses = (coursesData || []).map(course => {
          // Нормализуем access_type
          const access_type = course.access_type || 'free';
          
          return {
            ...course,
            access_type,
            price: course.price || null
          };
        });

        setCourses(enrichedCourses);

        // Считаем статистику
        const totalLessons = enrichedCourses.reduce(
          (sum, course) => sum + (course.lessons?.length || 0),
          0
        );

        setStats({
          totalLessons,
          totalCourses: enrichedCourses.length,
        });

        console.log('📊 Статистика курсов:', {
          всего_курсов: enrichedCourses.length,
          всего_уроков: totalLessons,
          бесплатные: enrichedCourses.filter(c => c.access_type === 'free').length,
          премиум: enrichedCourses.filter(c => c.access_type === 'premium').length,
          платные: enrichedCourses.filter(c => c.access_type === 'paid').length
        });

        // Выводим информацию о каждом курсе
        enrichedCourses.forEach((course, i) => {
          console.log(`${i + 1}. "${course.title}":`, {
            access_type: course.access_type,
            price: course.price,
            lessons: course.lessons?.length || 0
          });
        });

      } catch (error) {
        console.error('❌ Ошибка загрузки курсов:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, []);

  // Проверка доступности курса (УЛУЧШЕННАЯ ВЕРСИЯ)
  const isCourseAccessible = (course) => {
    // Детальная отладка
    console.log(`\n🔍 ПРОВЕРКА ДОСТУПА: "${course.title}"`);
    
    const accessType = course.access_type || 'free';
    console.log('📊 Данные курса:', {
      title: course.title,
      access_type: accessType,
      price: course.price
    });
    
    console.log('👤 Данные пользователя:', {
      email: userData?.profile?.email,
      premium_status: userPremiumInfo?.is_premium ? 'Premium ✅' : 'Не Premium ❌',
      premium_active: userPremiumInfo?.is_active ? 'Активен ✅' : 'Не активен ❌',
      days_left: userPremiumInfo?.days_left || 0
    });
    
    // 1. Если не авторизован
    if (!isAuthenticated) {
      console.log('❌ Результат: Не авторизован');
      return false;
    }
    
    // 2. Бесплатные курсы
    if (accessType === 'free') {
      console.log('✅ Результат: Бесплатный курс - доступ разрешен');
      return true;
    }
    
    // 3. Premium курсы
    if (accessType === 'premium') {
      const hasPremium = userPremiumInfo?.is_premium === true;
      const isActive = userPremiumInfo?.is_active === true;
      const canAccess = hasPremium && isActive;
      
      console.log('🎯 Premium проверка:', {
        имеет_premium: hasPremium,
        premium_активен: isActive,
        может_получить_доступ: canAccess
      });
      
      console.log(canAccess ? '✅ Результат: Premium курс - доступ разрешен' : '❌ Результат: Premium курс - требуется Premium подписка');
      return canAccess;
    }
    
    // 4. Платные курсы
    if (accessType === 'paid') {
      console.log('💰 Результат: Платный курс - требуется покупка');
      return false;
    }
    
    console.log(`❓ Результат: Неизвестный тип доступа: ${accessType}`);
    return false;
  };

  // Получить текст кнопки в зависимости от типа курса и статуса пользователя
  const getButtonText = (course) => {
    const accessible = isCourseAccessible(course);

    console.log(`🔄 Получение текста кнопки для "${course.title}":`, {
      доступен: accessible,
      тип_курса: course.access_type,
      премиум_пользователя: userPremiumInfo?.is_premium
    });

    if (!isAuthenticated) {
      return {
        main: "RO'YXATDAN O'TING",
        sub: "Bepul ro'yxatdan o'tish →"
      };
    }

    if (accessible) {
      return {
        main: "OCHIQ",
        sub: "Kirish →"
      };
    }

    if (course.access_type === 'paid') {
      return {
        main: "SOTIB OLISH",
        sub: `${course.price?.toLocaleString() || '100,000'} UZS →`
      };
    }

    if (course.access_type === 'premium') {
      return {
        main: "PREMIUM",
        sub: userPremiumInfo?.is_premium ? "Obuna faollashtiring →" : "Obuna →"
      };
    }

    return {
      main: "KIRISH",
      sub: "Darslarni boshlash →"
    };
  };

  // Иконка курса
  const getCourseIcon = (title) => {
    const icons = {
      matematika: '🧮',
      kimyo: '⚗️',
      fizika: '⚛️',
      biologiya: '🔬',
      'ona tili': '📚',
      'ingliz tili': '🇬🇧',
      tarix: '🏛️',
      geografiya: '🌍',
      informatika: '💻',
      python: '🐍',
      javascript: '⚡',
      dasturlash: '👨‍💻',
      'mental arifmetika': '🧠',
      robototexnika: '🤖',
      'suniy intellekt': '🤖',
      'web dasturlash': '🌐',
      'mobil dasturlash': '📱',
      'rasm chizish': '🎨',
      musiqa: '🎵',
      test: '🧪',
    };

    const lowerTitle = title.toLowerCase();
    for (const [key, icon] of Object.entries(icons)) {
      if (lowerTitle.includes(key)) return icon;
    }
    return '📖';
  };

  // Количество уроков
  const getLessonCount = (course) => {
    return course.lessons?.length || course.lessons_count || 0;
  };

  // Изображение курса
  const getCourseImage = (course) => {
    if (course.cover_image_url?.startsWith('http')) return course.cover_image_url;
    if (course.image_url?.startsWith('http')) return course.image_url;

    const defaultImages = {
      matematika: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=80',
      kimyo: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&auto=format&fit=crop&q=80',
      fizika: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=800&auto=format&fit=crop&q=80',
      biologiya: 'https://images.unsplash.com/photo-1530026405189-8745d6e7f4c8?w=800&auto=format&fit=crop&q=80',
      'ona tili': 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&auto=format&fit=crop&q=80',
      'ingliz tili': 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800&auto=format&fit=crop&q=80',
      tarix: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=800&auto=format&fit=crop&q=80',
      geografiya: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop&q=80',
      informatika: 'https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?w=800&auto=format&fit=crop&q=80',
      python: 'https://images.unsplash.com/photo-1526379879527-8559ecfcaec7?w=800&auto=format&fit=crop&q=80',
      javascript: 'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=800&auto=format&fit=crop&q=80',
      dasturlash: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
      test: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&auto=format&fit=crop&q=80',
    };

    const lowerTitle = course.title.toLowerCase();
    for (const [key, image] of Object.entries(defaultImages)) {
      if (lowerTitle.includes(key)) return image;
    }

    return 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';
  };

  // Получить URL для перехода
  const getCourseLink = (course) => {
    const accessible = isCourseAccessible(course);

    console.log(`🔗 Получение ссылки для "${course.title}":`, {
      доступен: accessible,
      тип_курса: course.access_type
    });

    if (!isAuthenticated) {
      return '/register';
    }

    if (accessible) {
      return `/subject/${course.id}`;
    }

    if (course.access_type === 'paid') {
      return `/course-buy/${course.id}`;
    }

    if (course.access_type === 'premium') {
      return '/premium';
    }

    return `/subject/${course.id}`;
  };

  // Отображение дебаг информации
  if (isAuthenticated) {
    console.log('\n=== СВОДНАЯ ИНФОРМАЦИЯ ===');
    console.log('Пользователь:', userData?.profile?.email);
    console.log('Premium статус:', userPremiumInfo);
    console.log('Количество курсов:', courses.length);
    
    courses.forEach((course, i) => {
      const accessible = isCourseAccessible(course);
      console.log(`${i + 1}. "${course.title}" (${course.access_type}): ${accessible ? '✅ Доступен' : '❌ Закрыт'}`);
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-black dark:via-gray-900 dark:to-purple-950 py-16 px-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl md:text-8xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
            Kurslar yuklanmoqda...
          </h1>
          <div className="inline-block h-16 w-16 animate-spin rounded-full border-8 border-indigo-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 dark:from-black dark:via-gray-900 dark:to-purple-950 py-16 px-4 md:px-6">
      {/* Дебаг панель */}
      {isAuthenticated && (
        <div className="fixed top-4 left-4 bg-blue-600 text-white p-4 rounded-lg shadow-xl z-50 max-w-md">
          <div className="font-bold text-lg mb-2">🔍 ДЕБАГ ИНФОРМАЦИЯ</div>
          <div><strong>Пользователь:</strong> {userData?.profile?.full_name}</div>
          <div><strong>Email:</strong> {userData?.profile?.email}</div>
          <div><strong>Premium статус:</strong> {userPremiumInfo?.is_premium ? '✅ ЕСТЬ' : '❌ НЕТ'}</div>
          <div><strong>Premium активен:</strong> {userPremiumInfo?.is_active ? '✅ ДА' : '❌ НЕТ'}</div>
          <div><strong>Осталось дней:</strong> {userPremiumInfo?.days_left || 0}</div>
          <div className="mt-2 text-sm">
            <strong>Курсы ({courses.length}):</strong>
            {courses.map(course => (
              <div key={course.id}>
                {course.title}: {course.access_type} → 
                {isCourseAccessible(course) ? ' ✅' : ' ❌'}
              </div>
            ))}
          </div>
          <button 
            onClick={() => location.reload()}
            className="mt-3 px-3 py-1 bg-white text-blue-600 rounded text-sm font-bold"
          >
            Обновить страницу
          </button>
        </div>
      )}

      {/* Заголовок */}
      <div className="text-center mb-12 md:mb-20">
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-6">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
            Barcha Kurslar
          </span>
        </h1>
        
        {/* Информация о Premium статусе */}
        {isAuthenticated && userPremiumInfo && (
          <div className="mb-6">
            {userPremiumInfo.is_premium ? (
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full text-lg font-bold shadow-lg">
                <span className="text-2xl">⭐</span>
                <span>PREMIUM: {userPremiumInfo.days_left} kun qoldi</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-full text-lg font-bold shadow-lg">
                <span className="text-2xl">🔓</span>
                <span>Premium kurslarni ochish uchun obuna sotib oling</span>
              </div>
            )}
          </div>
        )}

        <p className="text-xl md:text-2xl lg:text-3xl text-gray-700 dark:text-gray-300 font-medium mb-6">
          {stats.totalCourses} kurs • {stats.totalLessons} dars
        </p>
        <div className="mt-8 flex justify-center">
          <div className="px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-black text-xl font-bold shadow-2xl animate-pulse">
            Sifatli ta'lim — har kuni yangilanadi
          </div>
        </div>
      </div>

      {/* Сетка курсов */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8 lg:gap-10">
        {courses.map((course, index) => {
          const accessible = isCourseAccessible(course);
          const lessonCount = getLessonCount(course);
          const courseImage = getCourseImage(course);
          const buttonText = getButtonText(course);
          const courseLink = getCourseLink(course);

          return (
            <NavLink
              key={course.id}
              to={courseLink}
              className="group relative block"
              style={{
                animation: 'fadeUp 0.9s ease-out forwards',
                animationDelay: `${index * 0.12}s`,
                opacity: 0,
              }}
            >
              <div
                className={`relative h-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border-2 transition-all duration-700 hover:scale-105 hover:-translate-y-4 hover:shadow-3xl ${
                  accessible 
                    ? 'border-gray-200 dark:border-gray-700' 
                    : 'border-yellow-500 dark:border-yellow-600'
                }`}
              >
                {/* Градиент при ховере */}
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl blur-xl opacity-0 group-hover:opacity-70 transition-opacity duration-1000 pointer-events-none" />

                {/* Overlay для недоступных курсов */}
                {!accessible && (
                  <div className="absolute inset-0 bg-black/70 dark:bg-black/80 z-20 flex items-center justify-center rounded-3xl p-6">
                    <div className="text-center">
                      <div className="text-6xl md:text-8xl mb-4">🔒</div>
                      
                      {!isAuthenticated ? (
                        <>
                          <p className="text-2xl md:text-3xl font-bold text-white mb-4">
                            Darslarni ko'rish uchun
                          </p>
                          <p className="text-3xl md:text-4xl font-black text-yellow-400 mb-2">
                            ro'yxatdan o'ting
                          </p>
                          <p className="text-gray-200 text-base">
                            Bepul va tezkor → Kirish / Ro'yxatdan o'tish
                          </p>
                        </>
                      ) : course.access_type === 'paid' ? (
                        <>
                          <p className="text-2xl md:text-3xl font-bold text-white mb-2">
                            Pullik kurs
                          </p>
                          <p className="text-yellow-400 text-2xl font-bold">
                            {course.price?.toLocaleString() || '100,000'} UZS
                          </p>
                          <p className="text-gray-200 text-base mt-2">
                            Bir martalik to'lov → Doimiy kirish
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-2xl md:text-3xl font-bold text-white mb-2">
                            Premium kurs
                          </p>
                          <p className="text-gray-200 text-base">
                            Obuna orqali oching
                          </p>
                          {userPremiumInfo?.is_premium && !userPremiumInfo?.is_active && (
                            <p className="text-red-300 text-sm mt-2">
                              Premium obunangiz tugagan. Qayta faollashtiring.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="relative h-full flex flex-col">
                  {/* Изображение */}
                  <div className="relative h-48 md:h-64 overflow-hidden">
                    <img
                      src={courseImage}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                      loading="lazy"
                      onError={(e) => (e.target.src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80')}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    
                    {/* Иконка курса */}
                    <div className="absolute top-4 left-4 text-4xl md:text-6xl bg-black/60 backdrop-blur-md rounded-2xl p-3 border border-white/20">
                      {getCourseIcon(course.title)}
                    </div>
                    
                    {/* Бейдж типа курса */}
                    <div className="absolute top-4 right-4">
                      <div className={`px-4 py-2 rounded-full text-sm font-bold backdrop-blur-md ${
                        course.access_type === 'free' 
                          ? 'bg-green-500/80 text-white' 
                          : course.access_type === 'paid'
                          ? 'bg-blue-500/80 text-white'
                          : 'bg-yellow-500/80 text-black'
                      }`}>
                        {course.access_type === 'free' ? '🆓 Bepul' : 
                         course.access_type === 'paid' ? '💰 Pullik' : '⭐ Premium'}
                      </div>
                    </div>
                  </div>

                  {/* Контент */}
                  <div className="p-6 md:p-8 flex flex-col flex-1">
                    <h3 className="text-2xl md:text-3xl font-black text-gray-800 dark:text-white mb-3">
                      {course.title}
                    </h3>

                    <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base mb-6 line-clamp-3">
                      {course.description || 'Tavsif mavjud emas'}
                    </p>

                    <div className="flex flex-wrap gap-3 mb-6">
                      {course.difficulty_level && (
                        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm">
                          {course.difficulty_level}
                        </span>
                      )}
                      {course.estimated_hours && (
                        <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm">
                          ⏱️ {course.estimated_hours} soat
                        </span>
                      )}
                    </div>

                    <div className="flex items-end justify-between mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div>
                        <div className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
                          {lessonCount}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">ta dars</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xl md:text-2xl font-black ${
                          accessible ? 'text-green-500' : 
                          course.access_type === 'paid' ? 'text-blue-500' : 
                          'text-yellow-500'
                        }`}>
                          {buttonText.main}
                        </div>
                        <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                          {buttonText.sub}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Анимированная полоска снизу */}
                  <div className="absolute bottom-0 left-0 right-0 h-2 overflow-hidden rounded-b-3xl">
                    <div
                      className={`absolute inset-0 -translate-x-full group-hover:translate-x-0 transition-transform duration-1000 ease-out ${
                        accessible
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : course.access_type === 'paid'
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                          : 'bg-gradient-to-r from-yellow-500 to-orange-500'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </NavLink>
          );
        })}
      </div>

      {/* Если курсов нет */}
      {courses.length === 0 && !loading && (
        <div className="text-center py-20">
          <div className="text-6xl mb-6">📚</div>
          <h3 className="text-3xl font-bold text-gray-600 dark:text-gray-400 mb-4">
            Hozircha kurslar mavjud emas
          </h3>
          <NavLink
            to="/eh-secret-admin-2025"
            className="inline-block px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full font-bold text-xl hover:scale-105 transition"
          >
            Admin panelga o'tish
          </NavLink>
        </div>
      )}

      {/* Баннер Premium */}
      {isAuthenticated && !userPremiumInfo?.is_premium && (
        <div className="mt-16 text-center">
          <div className="max-w-4xl mx-auto bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 rounded-3xl p-10 text-white">
            <h3 className="text-4xl font-black mb-4">Premium Obuna Sotib Oling!</h3>
            <p className="text-xl mb-6">
              Barcha kurslarga cheksiz kirish, reklamasiz tajriba va maxsus imkoniyatlar
            </p>
            <NavLink
              to="/premium"
              className="inline-block px-10 py-5 bg-white text-purple-700 text-2xl font-bold rounded-full hover:scale-105 transition"
            >
              Premiumni faollashtirish →
            </NavLink>
          </div>
        </div>
      )}

      {/* Подвал */}
      <div className="mt-20 text-center text-gray-500 dark:text-gray-400">
        <p className="text-lg">© {new Date().getFullYear()} EDUHELPER UZ</p>
        <p className="text-sm mt-2">
          {stats.totalCourses} kurs • {stats.totalLessons} dars • Har kuni yangilanadi
        </p>
      </div>
    </div>
  );
};

export default Subjects;