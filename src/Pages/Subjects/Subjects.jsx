import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/ReactContext';

const Subjects = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalLessons: 0, totalCourses: 0 });
  const [userProfile, setUserProfile] = useState(null);
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

  // Загружаем профиль пользователя из таблицы profiles
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!isAuthenticated || !userData?.email) {
        setUserProfile(null);
        return;
      }

      try {
        console.log('Загрузка профиля для email:', userData.email);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', userData.email)
          .single();

        if (error) {
          console.error('Ошибка загрузки профиля:', error);
          return;
        }

        console.log('✅ Загружен профиль из базы:', {
          email: data.email,
          is_premium: data.is_premium,
          premium_until: data.premium_until,
          full_name: data.full_name
        });
        setUserProfile(data);
      } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
      }
    };

    loadUserProfile();
  }, [isAuthenticated, userData?.email]);

  // Загрузка курсов
  useEffect(() => {
    const loadCourses = async () => {
      try {
        setLoading(true);

        const { data: coursesData, error } = await supabase
          .from('courses')
          .select('*, lessons:lessons(*)')
          .order('created_at', { ascending: false });

        if (error) throw error;

        setCourses(coursesData || []);

        const totalLessons = coursesData?.reduce(
          (sum, course) => sum + (course.lessons?.length || 0),
          0
        ) || 0;

        setStats({
          totalLessons,
          totalCourses: coursesData?.length || 0,
        });
      } catch (error) {
        console.error('Ошибка загрузки курсов:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, []);

  const isCourseAccessible = (course) => {
    // 1. Проверяем поле is_free (boolean)
    if (course.is_free === true) {
      return isAuthenticated;
    }

    // 2. Проверяем access_type (text)
    if (course.access_type === 'free') {
      return isAuthenticated;
    }

    // 3. Пользователь не авторизован
    if (!isAuthenticated) return false;

    // 4. Получаем данные из профиля
    if (!userProfile) {
      console.log('⚠️ Профиль пользователя еще не загружен');
      return false;
    }

    // 5. Платный курс (paid или price > 0)
    if (course.access_type === 'paid' || (course.price && course.price > 0)) {
      console.log('💰 Платный курс:', course.title, 'Цена:', course.price);
      // TODO: Проверить покупку в таблице course_purchases или user_courses
      return false; // Показываем кнопку покупки
    }

    // 6. Premium курс
    if (course.access_type === 'premium') {
      const isPremium = userProfile.is_premium === true;
      const premiumUntil = userProfile.premium_until;

      console.log('🔐 Premium проверка для курса:', course.title, {
        isPremium,
        premiumUntil,
        now: new Date(),
        premiumUntilDate: premiumUntil ? new Date(premiumUntil) : null,
        isFuture: premiumUntil ? new Date(premiumUntil) > new Date() : false
      });

      if (!isPremium) {
        console.log('❌ Пользователь не имеет Premium статуса');
        return false;
      }

      // Если premium_until null — считаем вечным Premium
      if (!premiumUntil) {
        console.log('✅ Premium вечный (premium_until = null)');
        return true;
      }

      const isActive = new Date(premiumUntil) > new Date();
      console.log(isActive ? '✅ Premium активен' : '❌ Premium истек');
      return isActive;
    }

    // 7. По умолчанию — доступ закрыт
    console.log('ℹ️ Неизвестный тип доступа:', {
      title: course.title,
      access_type: course.access_type,
      is_free: course.is_free,
      price: course.price
    });
    return false;
  };

  // Проверяем данные пользователя для отладки
  useEffect(() => {
    if (userProfile) {
      console.log('📊 === ТЕКУЩИЙ СТАТУС ПОЛЬЗОВАТЕЛЯ ===');
      console.log('👤 Email:', userProfile.email);
      console.log('⭐ is_premium:', userProfile.is_premium);
      console.log('📅 premium_until:', userProfile.premium_until);
      console.log('🎯 Premium активен?:',
        userProfile.is_premium === true &&
        (!userProfile.premium_until || new Date(userProfile.premium_until) > new Date())
      );

      // Проверяем конкретно для eduhelperuz@gmail.com
      if (userProfile.email === 'eduhelperuz@gmail.com') {
        console.log('🎯 ЭТО EDUHELPER ADMIN!');
        console.log('✅ is_premium должен быть:', true);
        console.log('✅ premium_until должен быть:', '2030-12-12 11:14:43+00');
      }
    }
  }, [userProfile]);

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
    };

    const lowerTitle = course.title.toLowerCase();
    for (const [key, image] of Object.entries(defaultImages)) {
      if (lowerTitle.includes(key)) return image;
    }

    return 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';
  };

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
      {/* Заголовок */}
      <div className="text-center mb-12 md:mb-20">
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-6">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
            Barcha Kurslar
          </span>
        </h1>
        <p className="text-xl md:text-2xl lg:text-3xl text-gray-700 dark:text-gray-300 font-medium mb-6">
          {stats.totalCourses} kurs • {stats.totalLessons} dars
        </p>
        <div className="mt-8 flex justify-center">
          <div className="px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-black text-xl font-bold shadow-2xl animate-pulse">
            Sifatli ta'lim — har kuni yangilanadi
          </div>
        </div>
      </div>

      {/* Отладка Premium статуса (можно удалить после проверки) */}
      {userProfile && (
        <div className="max-w-7xl mx-auto mb-6 p-4 bg-white/80 dark:bg-gray-800/80 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                👤 {userProfile.full_name || userProfile.email}
              </h3>
              <div className="flex items-center gap-4 mt-2">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${userProfile.is_premium ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                  ⭐ Premium: {userProfile.is_premium ? 'ДА' : 'НЕТ'}
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-sm">
                  📅 До: {userProfile.premium_until ? new Date(userProfile.premium_until).toLocaleDateString() : 'Нет срока'}
                </span>
                <span className="px-3 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded-full text-sm">
                  🎯 Активен: {userProfile.is_premium && (!userProfile.premium_until || new Date(userProfile.premium_until) > new Date()) ? 'ДА' : 'НЕТ'}
                </span>
              </div>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-bold hover:opacity-90 transition"
            >
              Обновить
            </button>
          </div>
        </div>
      )}

      {/* Сетка курсов */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8 lg:gap-10">
        {courses.map((course, index) => {
          const accessible = isCourseAccessible(course);
          const lessonCount = getLessonCount(course);
          const courseImage = getCourseImage(course);

          return (
            <NavLink
              key={course.id}
              to={
                accessible
                  ? `/subject/${course.id}`
                  : course.access_type === 'paid' || course.price > 0
                    ? `/course-buy/${course.id}`   // Платный курс
                    : '/premium'                    // Премиум по подписке
              }
              className="group relative block"
              style={{
                animation: 'fadeUp 0.9s ease-out forwards',
                animationDelay: `${index * 0.12}s`,
                opacity: 0,
              }}
            >
              );
        })}
            </div>

      {/* Если курсов нет */ }
          {
            courses.length === 0 && !loading && (
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
            )
          }

          {/* Подвал */ }
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