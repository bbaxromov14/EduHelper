import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/ReactContext';
import { supabase } from '../../lib/supabase';
const Home = () => {

  const { user, isAuthenticated, userData } = useAuth(); // ← Добавил userData сюда!
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState({
    totalCourses: 0,
    totalLessons: 0,
    successRate: '97%'
  });
  const [loading, setLoading] = useState(true);



  useEffect(() => {
    const loadHomeData = async () => {
      try {
        setLoading(true);

        // Загружаем 8 популярных опубликованных курсов
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('*, lessons:lessons(*)')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(8);

        if (coursesError) throw coursesError;

        setCourses(coursesData || []);

        // Общее количество опубликованных курсов
        const { count: totalCoursesCount, error: countError } = await supabase
          .from('courses')
          .select('id', { count: 'exact', head: true })
          .eq('is_published', true);

        if (countError) console.warn('Ошибка подсчёта курсов:', countError);

        const totalLessons = coursesData?.reduce((sum, course) =>
          sum + (course.lessons?.length || course.lesson_count || 0), 0) || 0;

        // РАССЧИТЫВАЕМ РЕАЛЬНЫЙ ПРОГРЕСС если пользователь авторизован
        let successRate = '97%'; // значение по умолчанию

        if (isAuthenticated && user?.id) {
          try {
            // 1. Загружаем прогресс пользователя
            const { data: progressData, error: progressError } = await supabase
              .from('user_progress')
              .select('*')
              .eq('user_id', user.id);

            if (!progressError && progressData) {
              // 2. Загружаем все уроки всех курсов
              const { data: allLessons, error: lessonsError } = await supabase
                .from('lessons')
                .select('id')
                .in('course_id', coursesData.map(c => c.id));

              if (!lessonsError && allLessons) {
                // 3. Считаем процент завершенных уроков
                const completedLessons = progressData.filter(p => p.completed);
                const totalAvailableLessons = allLessons.length;

                if (totalAvailableLessons > 0) {
                  const percentage = Math.round((completedLessons.length / totalAvailableLessons) * 100);
                  successRate = `${percentage}%`;
                } else {
                  successRate = '0%';
                }
              }
            }
          } catch (progressError) {
            console.warn('Ошибка расчета прогресса:', progressError);
          }
        }

        setStats({
          totalCourses: totalCoursesCount || 0,
          totalLessons: totalLessons,
          successRate: successRate
        });

      } catch (error) {
        console.error("Ошибка загрузки данных на главной:", error);
        setCourses([]);
        setStats({ totalCourses: 0, totalLessons: 0, successRate: '97%' });
      } finally {
        setLoading(false);
      }
    };

    loadHomeData();
  }, [isAuthenticated, user?.id]); // Добавили зависимости

  // Анимация счётчиков
  const [coursesCount, setCoursesCount] = useState('0+');

  useEffect(() => {
    const animateValue = (start, end, duration, setter, suffix = '') => {
      let startTime = null;
      const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        setter(value + suffix);
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    if (!loading) {
      setTimeout(() => {
        animateValue(0, stats.totalCourses, 2000, setCoursesCount, '+');
      }, 500);
    }
  }, [loading, stats]);

  // Иконка курса
  const getCourseIcon = (title) => {
    const icons = {
      'matematika': '🧮',
      'biologiya': '🔬',
      'fizika': '⚛️',
      'python': '🐍',
      'frontend': '💻',
      'ona tili': '📚',
      'kimyo': '🧪',
      'tarix': '📜',
      'geografiya': '🌍',
      'ingliz tili': '🇬🇧'
    };

    const lowerTitle = title.toLowerCase();
    for (const [key, icon] of Object.entries(icons)) {
      if (lowerTitle.includes(key)) return icon;
    }
    return '📖';
  };

  // Количество уроков
  const getLessonCount = (course) => {
    return course.lessons?.length || course.lesson_count || 0;
  };

  // Проверка доступности курса — ДО return!
  const isCourseAccessible = (course) => {
    if (course.access_type === "free" || course.premium_required_tier === "free") {
      return isAuthenticated;
    }

    if (!isAuthenticated) return false;

    const userTier = userData?.profile?.premium_tier || 'free';
    const premiumUntil = userData?.profile?.premium_until;
    const isPremiumActive = premiumUntil && new Date(premiumUntil) > new Date();

    if (!isPremiumActive && userData?.profile?.lifetime_premium !== true) {
      return false;
    }

    const tierOrder = { free: 0, start: 1, blaze: 2, platinum: 3 };
    const requiredTier = course.premium_required_tier || 'free';

    return tierOrder[userTier] >= tierOrder[requiredTier];
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-black dark:via-gray-900 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-xl">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-black dark:via-gray-900 dark:to-slate-900">

      {/* ГЕРОЙ-СЕКЦИЯ */}
      <section className="relative overflow-hidden py-24 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 opacity-90"></div>
        <div className="absolute inset-0 bg-black opacity-40"></div>

        <div className="absolute top-20 left-10 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-2000"></div>

        <div className="relative container mx-auto px-6 text-center text-white">
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            {isAuthenticated
              ? <>Salom, <span className="text-yellow-400">{user?.displayName || 'Foydalanuvchi'}</span>!</>
              : <>Bilim — bu <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-pink-400">kelajak</span></>
            }
          </h1>

          <p className="text-xl md:text-2xl mb-10 max-w-4xl mx-auto opacity-90">
            {isAuthenticated
              ? "Davom eting, siz allaqachon yo'lda boshlagansiz. Bugun yana bir qadam yaqinroq!"
              : "100% bepul. Reklamasiz. Umrbod kirish. O'zbek tilida eng sifatli ta'lim — faqat EduHelperda!"}
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <NavLink to="/subjects" className="group px-10 py-5 bg-white text-black font-bold text-xl rounded-full shadow-2xl hover:scale-110 transition-all duration-300 flex items-center gap-3">
              <span className="text-3xl group-hover:translate-x-2 transition-transform">➜</span>
              Darslarni boshlash
            </NavLink>
            {isAuthenticated && (
              <NavLink to="/progress" className="px-8 py-5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-bold text-xl hover:shadow-pink-500/50 transition-all">
                Mening Progressim
              </NavLink>
            )}
            {!isAuthenticated && (
              <NavLink to="/login" className="px-8 py-5 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-full font-bold text-xl hover:shadow-cyan-500/50 transition-all">
                Kirish / Ro'yxatdan o'tish
              </NavLink>
            )}
          </div>

          {/* СТАТИСТИКА */}
          <div className="mt-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="text-6xl md:text-7xl font-black text-green-400">
                  {coursesCount}
                </div>
                <div className="text-xl md:text-2xl opacity-80 mt-4">Kurslar</div>
              </div>

              <div className="text-center">
                <div className="text-6xl md:text-7xl font-black text-pink-400">
                  {stats.successRate}
                </div>
                <div className="text-xl md:text-2xl opacity-80 mt-4">Muvaffaqiyat</div>
              </div>

              <div className="text-center">
                <div className="text-6xl md:text-7xl font-black text-cyan-400">
                  {stats.totalLessons}+
                </div>
                <div className="text-xl md:text-2xl opacity-80 mt-4">Darslar</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* МАШХУР КУРСЛАР — с замками и премиум-логикой */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Mashhur Kurslar
              </span>
            </h2>
            <p className="text-2xl text-gray-600 dark:text-gray-400">
              Premium • Bepul • Sifatli ta'lim
            </p>
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
                        : course.access_type === 'paid'
                          ? `/course-buy/${course.id}`   // Платный курс — разовая покупка
                          : '/premium'                    // Премиум по подписке
                    }
                    className="group relative block"
                    style={{
                      animation: 'fadeUp 0.9s ease-out forwards',
                      animationDelay: `${index * 0.12}s`,
                      opacity: 0,
                    }}
                  >
                    <div
                      className={`relative h-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border-2 transition-all duration-700 hover:scale-105 hover:-translate-y-4 hover:shadow-3xl ${accessible ? 'border-gray-200 dark:border-gray-700' : 'border-yellow-500'
                        }`}
                    >
                      {/* Градиент при ховере */}
                      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl blur-xl opacity-0 group-hover:opacity-70 transition-opacity duration-1000 pointer-events-none" />

                      {/* Бейдж PREMIUM / PULLIK */}
                      {!accessible && (
                        <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center rounded-3xl">
                          <div className="text-center p-6">
                            <div className="text-6xl md:text-8xl mb-4">🔒</div>

                            {/* Если пользователь НЕ авторизован — просим зарегистрироваться */}
                            {!isAuthenticated ? (
                              <>
                                <p className="text-2xl md:text-3xl font-bold text-white mb-4">
                                  Darslarni ko'rish uchun
                                </p>
                                <p className="text-3xl md:text-4xl font-black text-yellow-400">
                                  ro'yxatdan o'ting
                                </p>
                                <p className="text-gray-200 text-base mt-4">
                                  Bepul va tezkor → Kirish / Ro'yxatdan o'tish
                                </p>
                              </>
                            ) : (
                              /* Если авторизован, но нет премиума или платный курс */
                              <>
                                <p className="text-2xl md:text-3xl font-bold text-white">
                                  {course.access_type === 'paid' ? 'Pullik kurs' : 'Premium kurs'}
                                </p>
                                <p className="text-gray-200 text-base mt-2">
                                  {course.access_type === 'paid' ? 'Sotib olish →' : 'Obuna orqali oching'}
                                </p>
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
                          <div className="absolute top-4 left-4 text-4xl md:text-6xl bg-black/60 backdrop-blur-md rounded-2xl p-3 border border-white/20">
                            {getCourseIcon(course.title)}
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
                              <div className={`text-xl md:text-2xl font-black ${accessible ? 'text-green-500' : 'text-yellow-500'}`}>
                                {accessible
                                  ? 'OCHIQ'
                                  : !isAuthenticated
                                    ? 'RO\'YXATDAN O\'TING'
                                    : course.access_type === 'paid'
                                      ? 'SOTIB OLISH'
                                      : 'PREMIUM'
                                }
                              </div>
                              <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                                {accessible
                                  ? 'Kirish →'
                                  : !isAuthenticated
                                    ? 'Bepul ro\'yxatdan o\'tish →'
                                    : course.access_type === 'paid'
                                      ? 'Sotib olish →'
                                      : 'Obuna →'
                                }
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Анимированная полоска снизу */}
                        <div className="absolute bottom-0 left-0 right-0 h-2 overflow-hidden rounded-b-3xl">
                          <div
                            className={`absolute inset-0 -translate-x-full group-hover:translate-x-0 transition-transform duration-1000 ease-out ${accessible
                              ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                              : course.access_type === 'paid'
                                ? 'bg-gradient-to-r from-orange-500 to-red-500'
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
          </div>


          <div className="text-center mt-12">
            <NavLink
              to="/subjects"
              className="inline-block px-10 py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xl rounded-full hover:scale-105 transition-all"
            >
              Barcha {stats.totalCourses} kursni ko'rish →
            </NavLink>
          </div>
        </div>
      </section>
      {/* Почему EduHelper */}
      <section className="py-20 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-black">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Nima uchun <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">EduHelper UZ</span>?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-16">
            Endi Supabase texnologiyasi bilan — tezroq, xavfsizroq va kuchliroq platforma!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-6xl mx-auto">
            <div className="group bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 hover:-translate-y-3 transition-all duration-500">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-4xl shadow-lg">
                ⚡
              </div>
              <h3 className="text-2xl font-bold mb-3">Supabase + PostgreSQL</h3>
              <p className="text-gray-600 dark:text-gray-400">PostgreSQL bilan ishlaydi. Tezkor, xavfsiz va doimiy yangilanuvchi.</p>
            </div>

            <div className="group bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 hover:-translate-y-3 transition-all duration-500">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center text-4xl shadow-lg">
                📱
              </div>
              <h3 className="text-2xl font-bold mb-3">Har qanday qurilmada</h3>
              <p className="text-gray-600 dark:text-gray-400">Telefon, planshet, kompyuter — barcha qurilmalarda ishlaydi. 24/7 ochiq.</p>
            </div>

            <div className="group bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 hover:-translate-y-3 transition-all duration-500">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-orange-500 to-pink-600 rounded-2xl flex items-center justify-center text-4xl shadow-lg">
                💰
              </div>
              <h3 className="text-2xl font-bold mb-3">Premium va Bepul</h3>
              <p className="text-gray-600 dark:text-gray-400">Oson Premium obuna. Qo'shimcha imkoniyatlar va maxsus kurslar.</p>
            </div>
          </div>


          <div className="mt-20">
            <div className="inline-block px-12 py-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-black text-2xl font-black shadow-2xl animate-pulse">
              PREMIUM • BEPUL • KURSLAR
            </div>
          </div>
        </div>
      </section>

      {/* Финальный призыв */}
      <section className="py-20 text-center bg-gradient-to-t from-blue-50 to-white dark:from-gray-900 dark:to-black">
        <h2 className="text-5xl font-black mb-8">
          {isAuthenticated
            ? "Bugun qaysi kursni davom ettirasiz?"
            : "Bugun — eng yaxshi kun boshlash uchun"
          }
        </h2>

        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <NavLink
            to="/subjects"
            className="inline-block px-16 py-8 bg-gradient-to-r from-green-500 to-blue-600 text-white text-3xl font-black rounded-full shadow-2xl hover:scale-110 transition-all duration-300"
          >
            HOZIR BOSHLAYMIZ!
          </NavLink>

          {!isAuthenticated && (
            <NavLink
              to="/premium"
              className="inline-block px-16 py-8 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-3xl font-black rounded-full shadow-2xl hover:scale-110 transition-all duration-300"
            >
              PREMIUM SOTIB OLISH
            </NavLink>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;