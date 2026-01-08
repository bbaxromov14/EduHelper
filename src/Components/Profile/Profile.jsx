import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/ReactContext.jsx';
import Confetti from 'react-confetti';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

// 🔒 Безопасные функции
const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  return DOMPurify.sanitize(str).substring(0, 50);
};

const formatNumber = (num) => {
  const safeNum = Number(num) || 0;
  if (safeNum >= 1000000) return (safeNum / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (safeNum >= 1000) return (safeNum / 1000).toFixed(1).replace('.0', '') + 'k';
  return safeNum.toString();
};

// 🔄 Правильная функция расчета streak с учетом UTC
const calculateStreak = (progressData) => {
  if (!progressData?.length) return 0;

  // Получаем уникальные даты завершенных уроков в UTC
  const dates = progressData
    .filter(p => p.completed && p.completed_at)
    .map(p => {
      try {
        const dateStr = p.completed_at;
        const date = new Date(dateStr);

        if (isNaN(date.getTime())) {
          return null;
        }

        const utcDateStr = date.toISOString().split('T')[0];
        return utcDateStr;
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);

  const uniqueDates = [...new Set(dates)];

  if (uniqueDates.length === 0) {
    return 0;
  }

  uniqueDates.sort((a, b) => new Date(b) - new Date(a));

  const now = new Date();
  const todayUTC = now.toISOString().split('T')[0];
  const hasToday = uniqueDates[0] === todayUTC;

  let streak = 0;
  let expectedDate = new Date(hasToday ? todayUTC : uniqueDates[0]);

  for (const dateStr of uniqueDates) {
    const currentDate = new Date(dateStr);

    if (currentDate.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
      streak++;
      expectedDate.setUTCDate(expectedDate.getUTCDate() - 1);
    } else {
      break;
    }
  }

  return streak;
};

const Profile = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [showConfetti, setShowConfetti] = useState(false);
  const [userProgress, setUserProgress] = useState({
    lessons_completed: 0,
    streak: 0,
    points: 0,
    night_lessons: 0,
    morning_lessons: 0,
    perfect_lessons: 0,
    total_courses_completed: 0
  });
  const [allUsers, setAllUsers] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [justLeveledUp, setJustLeveledUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [oldLevel, setOldLevel] = useState(1);
  const [testPoints, setTestPoints] = useState(0);
  const [completedLessonsCount, setCompletedLessonsCount] = useState(0);
  const [completedCoursesCount, setCompletedCoursesCount] = useState(0);
  const [allProgressData, setAllProgressData] = useState([]);
  const [currentStreak, setCurrentStreak] = useState(0);

  // 🔒 Безопасные данные пользователя
  const safeUser = {
    fullName: sanitizeString(user?.fullName || user?.full_name || ''),
    email: sanitizeString(user?.email || ''),
    firstName: sanitizeString(user?.fullName?.split(' ')[0] || t('user_default'))
  };

  // 🔄 ЗАГРУЗКА ДАННЫХ ИЗ SUPABASE
  useEffect(() => {
    if (!user?.id) return;

    const loadUserData = async () => {
      try {
        setLoading(true);

        // 1. Загружаем ВСЕ данные прогресса пользователя
        const { data: allProgressData, error: allProgressError } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', user.id);

        if (!allProgressError) {
          setAllProgressData(allProgressData || []);
          const calculatedStreak = calculateStreak(allProgressData || []);
          setCurrentStreak(calculatedStreak);
        }

        // 2. Загружаем основную запись прогресса
        const { data: progressData, error: progressError } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        let saved = {
          lessons_completed: 0,
          streak: 0,
          points: 0,
          night_lessons: 0,
          morning_lessons: 0,
          perfect_lessons: 0,
          total_courses_completed: 0
        };

        if (!progressError && progressData) {
          saved = {
            ...saved,
            ...progressData,
            points: progressData.points || 0
          };
        }

        // 3. Загружаем баллы из тестов
        let totalTestPoints = 0;
        const { data: testResults = [] } = await supabase
          .from('test_results')
          .select('points_earned')
          .eq('user_id', user.id);

        if (testResults) {
          totalTestPoints = testResults.reduce((sum, r) => sum + (r.points_earned || 0), 0);
        }

        setTestPoints(totalTestPoints);

        // 4. Подсчитываем выполненные уроки
        const { count: lessonsCount } = await supabase
          .from('user_progress')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('completed', true);

        setCompletedLessonsCount(lessonsCount || 0);

        // 5. Подсчитываем выполненные курсы
        const { data: allCourses } = await supabase
          .from('courses')
          .select(`
            id,
            lessons:lessons(count)
          `)
          .eq('is_published', true);

        let completedCourses = 0;
        if (allCourses) {
          for (const course of allCourses) {
            const { count: completedInCourse } = await supabase
              .from('user_progress')
              .select('*', { count: 'exact' })
              .eq('user_id', user.id)
              .eq('course_id', course.id)
              .eq('completed', true);

            const totalLessons = course.lessons?.[0]?.count || 0;
            if (completedInCourse === totalLessons && totalLessons > 0) {
              completedCourses++;
            }
          }
        }
        setCompletedCoursesCount(completedCourses);

        // 6. Рассчитываем ОБЩИЕ баллы
        const totalPoints = (saved.points || 0) + totalTestPoints;
        const oldLvl = Math.max(1, Math.floor((totalPoints || 0) / 100) + 1);
        setOldLevel(oldLvl);

        // 7. ЗАГРУЖАЕМ ГЛОБАЛЬНЫЙ РЕЙТИНГ
        const { data: globalRanking, error: rankingError } = await supabase
          .rpc('get_global_ranking');

        if (!rankingError && globalRanking && globalRanking.length > 0) {
          const uniqueUsers = [];
          const seenUsers = new Set();

          globalRanking.forEach(userRank => {
            if (!seenUsers.has(userRank.user_uuid)) {
              seenUsers.add(userRank.user_uuid);
              uniqueUsers.push({
                id: userRank.user_uuid,
                email: userRank.user_email,
                fullName: userRank.user_full_name,
                points: userRank.total_points,
                level: userRank.user_level,
                rank: userRank.ranking
              });
            }
          });

          setAllUsers(uniqueUsers);
          const myRank = uniqueUsers.findIndex(u => u.id === user.id) + 1;
          setMyRank(myRank > 0 ? myRank : null);
        } else {
          const { data: fallbackRanking } = await supabase
            .from('user_progress')
            .select(`
              user_id, 
              points,
              profiles!inner(email, full_name)
            `)
            .order('points', { ascending: false })
            .limit(10);

          if (fallbackRanking && fallbackRanking.length > 0) {
            const users = fallbackRanking.map((u, index) => ({
              id: u.user_id,
              email: u.profiles?.email || 'anonymous',
              fullName: u.profiles?.full_name || 'User',
              points: u.points || 0,
              level: Math.max(1, Math.floor((u.points || 0) / 100) + 1),
              rank: index + 1
            }));

            setAllUsers(users);
            const myRank = users.findIndex(u => u.id === user.id) + 1;
            setMyRank(myRank > 0 ? myRank : null);
          }
        }

        // 8. Проверяем повышение уровня
        const newLevel = Math.max(1, Math.floor((totalPoints || 0) / 100) + 1);
        if (newLevel > oldLvl) {
          setJustLeveledUp(true);
          setShowConfetti(true);
          setTimeout(() => {
            setShowConfetti(false);
            setJustLeveledUp(false);
          }, 5000);
        }

        // 9. Обновляем состояние
        setUserProgress({
          ...saved,
          points: totalPoints
        });

      } catch (error) {
        console.error('❌ Ошибка загрузки данных профиля:', error);
        setUserProgress({
          lessons_completed: 0,
          streak: 0,
          points: 0,
          night_lessons: 0,
          morning_lessons: 0,
          perfect_lessons: 0,
          total_courses_completed: 0
        });
        setAllUsers([]);
        setMyRank(null);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();

    // Подписка на обновления
    const channel = supabase
      .channel('profile-updates')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_progress',
          filter: `user_id=eq.${user.id}`
        },
        async () => {
          await loadUserData();
        }
      )
      .subscribe();

    const testChannel = supabase
      .channel('profile-test-updates')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'test_results',
          filter: `user_id=eq.${user.id}`
        },
        async () => {
          await loadUserData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(testChannel);
    };
  }, [user, t]);

  // 🔒 Расчет статистик
  const stats = {
    level: Math.max(1, Math.floor((userProgress.points || 0) / 100) + 1),
    xpCurrent: Math.max(0, Math.min(100, (userProgress.points || 0) % 100)),
    xpNeeded: 100 - Math.max(0, Math.min(100, (userProgress.points || 0) % 100)),
    streak: currentStreak,
    points: userProgress.points || 0,
    testPoints: testPoints,
    progressPoints: Math.max(0, (userProgress.points || 0) - testPoints),
    lessons: completedLessonsCount,
    courses: completedCoursesCount,
    nightLessons: Math.max(0, userProgress.night_lessons || 0),
    morningLessons: Math.max(0, userProgress.morning_lessons || 0),
    perfectLessons: Math.max(0, userProgress.perfect_lessons || 0)
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-[#0AB685] border-r-transparent border-b-purple-500 border-l-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showConfetti && <Confetti recycle={false} numberOfPieces={500} gravity={0.06} />}

      {justLeveledUp && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 10 }}
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4"
        >
          <div className="bg-black/95 backdrop-blur-2xl border-4 border-purple-500 rounded-3xl p-6 md:p-8 lg:p-10 shadow-2xl text-center max-w-xs md:max-w-sm w-full">
            <motion.div initial={{ y: -50 }} animate={{ y: 0 }} transition={{ delay: 0.3 }}>
              <div className="text-5xl md:text-6xl lg:text-7xl mb-3 md:mb-4">
                ⭐
              </div>
              <div className="text-xl md:text-2xl lg:text-3xl font-black text-yellow-400 mb-2">
                {t('new_level')}
              </div>
              <div className="text-4xl md:text-5xl lg:text-6xl font-black text-purple-400 mb-2">
                {stats.level}
              </div>
              <div className="text-base md:text-lg lg:text-xl text-white mb-3">
                {t('level_increased')}
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                className="text-lg md:text-xl lg:text-2xl text-green-400 font-bold"
              >
                {t('congratulations')}
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen bg-[#0a0e17] text-white pb-20 md:pb-24 lg:pb-28"
      >
        <div className="px-3 sm:px-4 md:px-6 lg:px-8 pt-4 md:pt-6 lg:pt-8 space-y-4 sm:space-y-5 md:space-y-6 max-w-2xl mx-auto">

          {/* ГЛАВНАЯ КАРТОЧКА */}
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
            className="relative group"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-[#0AB685] via-purple-600 to-pink-600 rounded-2xl sm:rounded-3xl blur opacity-70 group-hover:opacity-100 transition duration-300"></div>
            <div className="relative bg-black/90 backdrop-blur-3xl rounded-2xl sm:rounded-3xl p-3 sm:p-4 md:p-6 border border-white/20">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 4 }}
                    className="relative"
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-[#0AB685] to-purple-600 flex items-center justify-center text-xl sm:text-2xl md:text-3xl font-black ring-3 sm:ring-4 ring-[#0AB685]/50 shadow-lg">
                      {safeUser.fullName.charAt(0).toUpperCase() || t('user_default').charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 bg-green-400 rounded-full border-2 border-black animate-ping"></div>
                  </motion.div>
                  <div>
                    <h1 className="text-sm sm:text-base md:text-lg font-black bg-gradient-to-r from-[#0AB685] to-purple-400 bg-clip-text text-transparent leading-tight">
                      {safeUser.fullName}
                    </h1>
                    <p className="text-xs text-cyan-300 opacity-80">{safeUser.email.split('@')[0]}</p>
                  </div>
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="text-right"
                >
                  <div className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                    #{myRank || '-'}
                  </div>
                  <p className="text-xs text-gray-400">{t('rating')}</p>
                </motion.div>
              </div>

              {/* УРОВЕНЬ */}
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.7, duration: 0.8 }}>
                <div className="mb-3 sm:mb-4">
                  <div className="flex justify-between text-xs sm:text-sm mb-1">
                    <span className="font-bold">{t('level')} {stats.level}</span>
                    <span className="text-cyan-300">{stats.xpCurrent}/100 XP</span>
                  </div>
                  <div className="h-7 sm:h-8 md:h-9 bg-white/10 rounded-full overflow-hidden border border-[#0AB685]/50 relative">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#0AB685] to-purple-600 flex items-center justify-end pr-2 text-xs font-bold text-white"
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.xpCurrent}%` }}
                      transition={{ delay: 0.9, duration: 1.2, ease: "easeOut" }}
                    >
                      {stats.xpCurrent >= 10 && stats.xpCurrent}
                    </motion.div>
                    <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center pointer-events-none">
                      <span className="text-xs opacity-70">
                        {stats.xpNeeded} {t('until_next_level', { level: stats.level + 1 })}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* ОСНОВНЫЕ СТАТИСТИКИ */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  {
                    key: 'streak',
                    value: stats.streak,
                    label: t('streak'),
                    icon: "🔥",
                    color: "orange",
                    tooltip: t('consecutive_days')
                  },
                  {
                    key: 'points',
                    value: stats.points,
                    label: t('points'),
                    icon: "⭐",
                    gradient: true,
                    tooltip: t('total_points_tooltip', { 
                      progress: stats.progressPoints, 
                      test: stats.testPoints 
                    })
                  },
                  {
                    key: 'lessons',
                    value: stats.lessons,
                    label: t('lessons'),
                    icon: "📚",
                    color: "purple",
                    tooltip: t('completed_lessons')
                  }
                ].map((stat, i) => (
                  <motion.div
                    key={stat.key}
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1 + i * 0.2 }}
                    className="bg-white/5 rounded-lg sm:rounded-xl p-2 sm:p-3 text-center border border-orange-500/30 group/stat relative"
                    title={stat.tooltip}
                  >
                    <div className="text-lg sm:text-xl md:text-2xl mb-1">
                      {stat.icon}
                    </div>
                    <div className={`text-lg sm:text-xl md:text-2xl font-black ${stat.gradient ? 'bg-gradient-to-r from-[#0AB685] to-cyan-400 bg-clip-text text-transparent' : stat.color === 'orange' ? 'text-orange-400' : 'text-purple-400'}`}>
                      {formatNumber(stat.value)}
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-400">{stat.label}</p>

                    {/* Подсказка при наведении */}
                    {stat.tooltip && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 backdrop-blur-sm text-white text-xs rounded-lg opacity-0 invisible group-hover/stat:opacity-100 group-hover/stat:visible transition-all duration-300 pointer-events-none whitespace-nowrap z-10 border border-white/20">
                        {stat.tooltip}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black/90"></div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* ИНФОРМАЦИЯ О БАЛЛАХ */}
              {stats.testPoints > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.5 }}
                  className="mt-3 p-2 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg border border-blue-500/20"
                >
                </motion.div>
              )}

            </div>
          </motion.div>

          {/* ТОП-10 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="bg-black/60 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/10 p-3 sm:p-4"
          >
            <h2 className="text-lg sm:text-xl md:text-2xl font-black text-center mb-3 sm:mb-4 bg-gradient-to-r from-[#0AB685] to-purple-400 bg-clip-text text-transparent">
              {t('uzbekistan_top_10')}
            </h2>
            <div className="space-y-2">
              {allUsers.slice(0, 10).map((u, i) => (
                <motion.div
                  key={i}
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 2.1 + i * 0.1 }}
                  className={`flex items-center justify-between p-2 sm:p-3 rounded-lg text-sm ${i < 3 ? 'bg-gradient-to-r from-yellow-600/80 to-orange-600/80' : 'bg-white/5'} ${u.email === safeUser.email ? 'ring-2 ring-cyan-400' : ''}`}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-base sm:text-lg md:text-xl min-w-6 text-center">
                      {i === 0 && "🥇"}
                      {i === 1 && "🥈"}
                      {i === 2 && "🥉"}
                      {i > 2 && `${i + 1}`}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold truncate text-xs sm:text-sm md:text-base">
                        {u.email?.split('@')[0] || t('user_default')}
                      </div>
                      <div className="text-cyan-300 text-[10px] sm:text-xs">
                        L{Math.max(1, Math.floor((u.points || 0) / 100) + 1)}
                      </div>
                    </div>
                  </div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 2.3 + i * 0.1 }}
                    className="font-black text-yellow-300 text-sm sm:text-base md:text-lg"
                  >
                    {formatNumber(u.points || 0)}
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </motion.div>

        </div>

        {/* КНОПКА ВЫХОДА */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 2.8 }}
          className="mt-12 text-center"
        >
          <button
            onClick={logout}
            className="relative group px-12 py-4 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 active:from-red-700 active:to-rose-800 rounded-full text-white text-xl font-black tracking-wider uppercase overflow-hidden transform-gpu transition-all duration-300 active:scale-95 shadow-2xl"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-red-500/50 to-rose-600/50 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 scale-150" />
            <span className="absolute -inset-2 rounded-full bg-red-500/30 animate-ping opacity-75" />
            <span className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-full" />
            <span className="relative z-10 flex items-center justify-center gap-3">
              {t('logout')}
            </span>
            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-10 bg-black/40 blur-3xl scale-0 group-hover:scale-100 transition-transform duration-300" />
          </button>
        </motion.div>
      </motion.div>
    </>
  );
};

export default Profile;