// src/Pages/Achievements/Achievements.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/ReactContext.jsx';
import { supabase } from '../../lib/supabase';
import Confetti from 'react-confetti';
import { motion } from 'framer-motion';

// Все достижения с улучшенной логикой
const ALL_ACHIEVEMENTS = [
  { 
    id: 1, 
    name: "Birinchi qadam", 
    icon: "👣", 
    description: "Birinchi darsni tugatish",
    category: "basic",
    req: { lessons: 1 }, 
    points: 50,
    color: "from-blue-500 to-cyan-500"
  },
  { 
    id: 2, 
    name: "Tez oʻrganuvchi", 
    icon: "⚡", 
    description: "3 kun ketma-ket dars qilish",
    category: "streak",
    req: { streak: 3 }, 
    points: 150,
    color: "from-yellow-500 to-orange-500"
  },
  { 
    id: 3, 
    name: "Marafonchi", 
    icon: "🏃", 
    description: "7 kun ketma-ket dars qilish",
    category: "streak",
    req: { streak: 7 }, 
    points: 300,
    color: "from-purple-500 to-pink-500"
  },
  { 
    id: 4, 
    name: "Olti kunlik olov", 
    icon: "🔥", 
    description: "30 kun ketma-ket dars qilish",
    category: "streak",
    req: { streak: 30 }, 
    points: 1000,
    color: "from-red-500 to-orange-500"
  },
  { 
    id: 5, 
    name: "100 kunlik afsona!", 
    icon: "👑", 
    description: "100 kun ketma-ket dars qilish",
    category: "streak",
    req: { streak: 100 }, 
    points: 5000,
    color: "from-yellow-500 to-amber-500"
  },
  
  // 📚 Прогресс по урокам
  { 
    id: 6, 
    name: "10 darslik boshlovchi", 
    icon: "📖", 
    description: "10 ta darsni tugatish",
    category: "progress",
    req: { lessons: 10 }, 
    points: 200,
    color: "from-green-500 to-emerald-500"
  },
  { 
    id: 7, 
    name: "50 darslik usta", 
    icon: "🎓", 
    description: "50 ta darsni tugatish",
    category: "progress",
    req: { lessons: 50 }, 
    points: 800,
    color: "from-blue-500 to-indigo-500"
  },
  { 
    id: 8, 
    name: "100 darslik chempion", 
    icon: "🎉", 
    description: "100 ta darsni tugatish",
    category: "progress",
    req: { lessons: 100 }, 
    points: 2000,
    color: "from-purple-500 to-pink-500"
  },
  
  // 🏆 Курсы
  { 
    id: 9, 
    name: "Birinchi kurs", 
    icon: "🥇", 
    description: "Birinchi kursni tugatish",
    category: "courses",
    req: { courses: 1 }, 
    points: 100,
    color: "from-yellow-500 to-orange-500"
  },
  { 
    id: 10, 
    name: "5 kurslik mutaxassis", 
    icon: "🏆", 
    description: "5 ta kursni tugatish",
    category: "courses",
    req: { courses: 5 }, 
    points: 500,
    color: "from-green-500 to-teal-500"
  },
  { 
    id: 11, 
    name: "10 kurslik professor", 
    icon: "👨‍🏫", 
    description: "10 ta kursni tugatish",
    category: "courses",
    req: { courses: 10 }, 
    points: 1500,
    color: "from-purple-500 to-violet-500"
  },
  
  // 💰 Баллы
  { 
    id: 12, 
    name: "Birinchi 100 ball", 
    icon: "💰", 
    description: "100 ball to'plashingiz",
    category: "points",
    req: { points: 100 }, 
    points: 50,
    color: "from-yellow-500 to-amber-500"
  },
  { 
    id: 13, 
    name: "500 ball ishbilarmon", 
    icon: "💎", 
    description: "500 ball to'plashingiz",
    category: "points",
    req: { points: 500 }, 
    points: 300,
    color: "from-blue-500 to-cyan-500"
  },
  { 
    id: 14, 
    name: "1000 ball millioner", 
    icon: "💵", 
    description: "1000 ball to'plashingiz",
    category: "points",
    req: { points: 1000 }, 
    points: 800,
    color: "from-green-500 to-emerald-500"
  },
  { 
    id: 15, 
    name: "Yengilmas", 
    icon: "🛡️", 
    description: "10000 ball to'plashingiz",
    category: "points",
    req: { points: 10000 }, 
    points: 3000,
    color: "from-red-500 to-rose-500"
  },
  
  // 🌙 Время занятий
  { 
    id: 16, 
    name: "Tungi oʻquvchi", 
    icon: "🦉", 
    description: "10 ta tungi dars (22:00-06:00)",
    category: "time",
    req: { nightLessons: 10 }, 
    points: 800,
    color: "from-indigo-500 to-purple-500"
  },
  { 
    id: 17, 
    name: "Erta turuvchi", 
    icon: "🐓", 
    description: "10 ta ertalabki dars (05:00-08:00)",
    category: "time",
    req: { morningLessons: 10 }, 
    points: 800,
    color: "from-orange-500 to-yellow-500"
  },
  
  // ⭐ Качество
  { 
    id: 18, 
    name: "Mukammal oʻquvchi", 
    icon: "⭐", 
    description: "20 ta darsni mukammal tugatish (100%)",
    category: "quality",
    req: { perfectLessons: 20 }, 
    points: 3000,
    color: "from-yellow-500 to-amber-500"
  },
  
  // 🏅 Рейтинг
  { 
    id: 19, 
    name: "Oʻzbekiston Top-100", 
    icon: "📈", 
    description: "Oʻzbekistonda top-100 reytingiga kirish",
    category: "rating",
    req: { rank: 100 }, 
    points: 1500,
    color: "from-blue-500 to-cyan-500"
  },
  { 
    id: 20, 
    name: "Oʻzbekiston Top-10", 
    icon: "🏆", 
    description: "Oʻzbekistonda top-10 reytingiga kirish",
    category: "rating",
    req: { rank: 10 }, 
    points: 5000,
    color: "from-purple-500 to-pink-500"
  },
  { 
    id: 21, 
    name: "OʻZBEKISTON №1!", 
    icon: "🥇", 
    description: "Oʻzbekistonda birinchi oʻrinni egallash",
    category: "rating",
    req: { rank: 1 }, 
    points: 25000,
    color: "from-yellow-500 to-orange-500"
  },
];

const CATEGORIES = [
  { id: 'all', name: 'Barchasi', icon: '🌟' },
  { id: 'basic', name: 'Asosiy', icon: '🎯' },
  { id: 'streak', name: 'Strek', icon: '🔥' },
  { id: 'progress', name: 'Progress', icon: '📈' },
  { id: 'courses', name: 'Kurslar', icon: '🏆' },
  { id: 'points', name: 'Ballar', icon: '💰' },
  { id: 'time', name: 'Vaqt', icon: '⏰' },
  { id: 'quality', name: 'Sifat', icon: '⭐' },
  { id: 'rating', name: 'Reyting', icon: '🏅' },
];

const Achievements = () => {
  const { user: authUser, isAuthenticated } = useAuth();
  const [userProgress, setUserProgress] = useState([]);
  const [courses, setCourses] = useState([]);
  const [userStats, setUserStats] = useState({
    lessons: 0,
    streak: 0,
    points: 0,
    courses: 0,
    nightLessons: 0,
    morningLessons: 0,
    perfectLessons: 0,
    rank: null
  });
  const [allUsers, setAllUsers] = useState([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState([]);
  const [newlyUnlocked, setNewlyUnlocked] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [totalPoints, setTotalPoints] = useState(0);

  // Функция расчета streak из Progress.jsx
  const calculateStreak = useCallback((progressData) => {
    if (!progressData?.length) return 0;

    const dates = progressData
      .filter(p => p.completed && p.completed_at)
      .map(p => {
        try {
          const date = new Date(p.completed_at);
          if (isNaN(date.getTime())) return null;
          return date.toISOString().split('T')[0];
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);

    const uniqueDates = [...new Set(dates)];
    if (uniqueDates.length === 0) return 0;

    uniqueDates.sort((a, b) => new Date(b) - new Date(a));
    const todayUTC = new Date().toISOString().split('T')[0];
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
  }, []);

  // Загрузка реальных данных из базы
  const loadUserData = useCallback(async () => {
    if (!isAuthenticated || !authUser?.id) return;

    try {
      setLoading(true);

      // 1. Загружаем прогресс уроков
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', authUser.id);

      if (progressError) throw progressError;
      setUserProgress(progressData || []);

      // 2. Загружаем курсы
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*, lessons:lessons(count)')
        .eq('is_published', true);

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // 3. Загружаем баллы из тестов
      const { data: testResults, error: testError } = await supabase
        .from('test_results')
        .select('points_earned')
        .eq('user_id', authUser.id);

      const totalTestPoints = testResults?.reduce((sum, r) => sum + (r.points_earned || 0), 0) || 0;

      // 4. Рассчитываем реальную статистику
      const completedLessons = progressData?.filter(p => p.completed) || [];
      const streak = calculateStreak(progressData);
      
      // Считаем завершенные курсы
      const completedCourseIds = new Set();
      progressData?.forEach(p => {
        if (p.completed && p.course_id) {
          completedCourseIds.add(p.course_id);
        }
      });

      // Считаем ночные и утренние уроки
      let nightLessons = 0;
      let morningLessons = 0;
      let perfectLessons = 0;

      progressData?.forEach(p => {
        if (p.completed && p.completed_at) {
          const date = new Date(p.completed_at);
          const hour = date.getHours();
          
          if (hour >= 22 || hour < 6) nightLessons++;
          if (hour >= 5 && hour < 8) morningLessons++;
        }
      });

      // 5. Загружаем всех пользователей для рейтинга
      const { data: allUsersData } = await supabase
        .from('test_results')
        .select(`
          user_id,
          profiles:profiles(username, full_name, avatar_url),
          points:points_earned
        `)
        .order('points_earned', { ascending: false });

      // Группируем баллы по пользователям
      const userPoints = {};
      if (allUsersData) {
        allUsersData.forEach(result => {
          if (!userPoints[result.user_id]) {
            userPoints[result.user_id] = {
              user_id: result.user_id,
              points: 0,
              profile: result.profiles
            };
          }
          userPoints[result.user_id].points += result.points || 0;
        });
      }

      const sortedUsers = Object.values(userPoints).sort((a, b) => b.points - a.points);
      setAllUsers(sortedUsers);

      let userRank = null;
      const rankIndex = sortedUsers.findIndex(u => u.user_id === authUser.id);
      if (rankIndex >= 0) userRank = rankIndex + 1;

      // 6. Формируем финальную статистику
      const stats = {
        lessons: completedLessons.length,
        streak: streak,
        points: totalTestPoints,
        courses: completedCourseIds.size,
        nightLessons: nightLessons,
        morningLessons: morningLessons,
        perfectLessons: perfectLessons,
        rank: userRank
      };

      setUserStats(stats);

      // 7. Загружаем разблокированные достижения
      const { data: userAchievements, error: achError } = await supabase
        .from('user_achievements')
        .select('achievement_id, created_at')
        .eq('user_id', authUser.id);

      if (!achError && userAchievements) {
        const unlockedIds = userAchievements.map(a => a.achievement_id);
        setUnlockedAchievements(unlockedIds);

        // Считаем общие баллы
        const total = ALL_ACHIEVEMENTS
          .filter(ach => unlockedIds.includes(ach.id))
          .reduce((sum, ach) => sum + ach.points, 0);
        setTotalPoints(total);

        // Проверяем новые достижения
        checkNewAchievements(stats, unlockedIds);
      } else {
        // Если нет таблицы user_achievements, создаем на основе статистики
        checkNewAchievements(stats, []);
      }

    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, authUser, calculateStreak]);

  // Проверка и разблокировка новых достижений
  const checkNewAchievements = async (stats, existingUnlocked) => {
    const newlyUnlocked = [];
    let currentUnlocked = [...existingUnlocked];
    
    ALL_ACHIEVEMENTS.forEach(achievement => {
      if (currentUnlocked.includes(achievement.id)) return;
      
      let unlocked = false;
      const req = achievement.req || {};
      
      if (req.lessons && stats.lessons >= req.lessons) unlocked = true;
      if (req.streak && stats.streak >= req.streak) unlocked = true;
      if (req.points && stats.points >= req.points) unlocked = true;
      if (req.courses && stats.courses >= req.courses) unlocked = true;
      if (req.rank && stats.rank && stats.rank <= req.rank) unlocked = true;
      if (req.nightLessons && stats.nightLessons >= req.nightLessons) unlocked = true;
      if (req.morningLessons && stats.morningLessons >= req.morningLessons) unlocked = true;
      if (req.perfectLessons && stats.perfectLessons >= req.perfectLessons) unlocked = true;
      
      if (unlocked) {
        newlyUnlocked.push(achievement);
      }
    });

    // Сохраняем новые достижения
    if (newlyUnlocked.length > 0) {
      const newAchievements = newlyUnlocked.map(ach => ({
        user_id: authUser.id,
        achievement_id: ach.id,
        earned_at: new Date().toISOString()
      }));

      try {
        const { error } = await supabase
          .from('user_achievements')
          .insert(newAchievements);

        if (error) throw error;

        // Обновляем локальное состояние
        const newIds = newlyUnlocked.map(ach => ach.id);
        setUnlockedAchievements(prev => [...prev, ...newIds]);
        setNewlyUnlocked(newlyUnlocked);
        setShowConfetti(true);

        // Обновляем общие баллы
        const newPoints = newlyUnlocked.reduce((sum, ach) => sum + ach.points, 0);
        setTotalPoints(prev => prev + newPoints);

        // Прячем конфетти
        setTimeout(() => {
          setShowConfetti(false);
          setTimeout(() => setNewlyUnlocked([]), 1000);
        }, 5000);

      } catch (error) {
        console.error('Ошибка сохранения достижений:', error);
      }
    }
  };

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Real-time подписка на изменения
  useEffect(() => {
    if (!authUser?.id) return;

    const channel = supabase
      .channel(`achievements_${authUser.id}`)
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_progress',
          filter: `user_id=eq.${authUser.id}`
        },
        () => {
          loadUserData();
        }
      )
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'test_results',
          filter: `user_id=eq.${authUser.id}`
        },
        () => {
          loadUserData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser?.id, loadUserData]);

  // Проверка прогресса для конкретного достижения
  const getAchievementProgress = (achievement) => {
    const req = achievement.req || {};
    
    if (req.lessons) {
      return {
        current: userStats.lessons,
        required: req.lessons,
        percent: Math.min(100, Math.round((userStats.lessons / req.lessons) * 100))
      };
    }
    
    if (req.streak) {
      return {
        current: userStats.streak,
        required: req.streak,
        percent: Math.min(100, Math.round((userStats.streak / req.streak) * 100))
      };
    }
    
    if (req.points) {
      return {
        current: userStats.points,
        required: req.points,
        percent: Math.min(100, Math.round((userStats.points / req.points) * 100))
      };
    }
    
    if (req.courses) {
      return {
        current: userStats.courses,
        required: req.courses,
        percent: Math.min(100, Math.round((userStats.courses / req.courses) * 100))
      };
    }
    
    if (req.rank && userStats.rank) {
      return {
        current: userStats.rank,
        required: req.rank,
        percent: Math.min(100, Math.round((req.rank / userStats.rank) * 100))
      };
    }
    
    if (req.nightLessons) {
      return {
        current: userStats.nightLessons,
        required: req.nightLessons,
        percent: Math.min(100, Math.round((userStats.nightLessons / req.nightLessons) * 100))
      };
    }
    
    if (req.morningLessons) {
      return {
        current: userStats.morningLessons,
        required: req.morningLessons,
        percent: Math.min(100, Math.round((userStats.morningLessons / req.morningLessons) * 100))
      };
    }
    
    if (req.perfectLessons) {
      return {
        current: userStats.perfectLessons,
        required: req.perfectLessons,
        percent: Math.min(100, Math.round((userStats.perfectLessons / req.perfectLessons) * 100))
      };
    }
    
    return { current: 0, required: 0, percent: 0 };
  };

  // Фильтрация достижений по категории
  const filteredAchievements = ALL_ACHIEVEMENTS.filter(achievement => {
    if (selectedCategory === 'all') return true;
    return achievement.category === selectedCategory;
  });

  // Общая статистика
  const totalAchievements = ALL_ACHIEVEMENTS.length;
  const unlockedCount = unlockedAchievements.length;
  const unlockedPercent = Math.round((unlockedCount / totalAchievements) * 100);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-6xl mb-6">🔒</div>
          <h1 className="text-3xl font-bold text-white mb-4">Yutuqlarni ko'rish uchun</h1>
          <p className="text-gray-300 mb-8">Iltimos, tizimga kiring</p>
          <a href="/login" className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full font-bold hover:scale-105 transition">
            Kirish sahifasiga o'tish
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-t-blue-500 border-r-purple-500 border-b-pink-500 border-l-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Yutuqlar yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white py-8 px-4">
      {showConfetti && <Confetti recycle={false} numberOfPieces={500} />}
      
      {newlyUnlocked.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 10 }}
            className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-3xl p-8 max-w-md mx-4 shadow-2xl"
          >
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-black mb-2">YANGI YUTUQ!</h2>
              <div className="space-y-4">
                {newlyUnlocked.map((ach, index) => (
                  <motion.div
                    key={ach.id}
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: index * 0.2 }}
                    className="bg-black/30 rounded-xl p-4"
                  >
                    <div className="text-4xl mb-2">{ach.icon}</div>
                    <div className="text-xl font-bold">{ach.name}</div>
                    <div className="text-sm opacity-90">{ach.description}</div>
                    <div className="text-green-300 font-bold">+{ach.points} ball</div>
                  </motion.div>
                ))}
              </div>
              <button
                onClick={() => {
                  setShowConfetti(false);
                  setNewlyUnlocked([]);
                }}
                className="mt-6 px-6 py-3 bg-white text-black rounded-full font-bold hover:scale-105 transition"
              >
                Davom etish
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-black mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400">
              Yutuqlar va Mukofotlar
            </span>
          </h1>
          <p className="text-xl opacity-90">Bilimingizni kengaytiring, yutuqlarni qo'lga kiriting!</p>
        </div>

        {/* Общая статистика */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-black/30 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
            <div className="text-center">
              <div className="text-4xl font-black text-green-400 mb-2">
                {unlockedCount}/{totalAchievements}
              </div>
              <div className="text-lg">Olingan yutuqlar</div>
              <div className="mt-4 w-full bg-white/10 rounded-full h-3">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-1000"
                  style={{ width: `${unlockedPercent}%` }}
                />
              </div>
              <div className="text-sm text-gray-400 mt-2">{unlockedPercent}% tugallandi</div>
            </div>
          </div>
          
          <div className="bg-black/30 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
            <div className="text-center">
              <div className="text-4xl font-black text-yellow-400 mb-2">
                {totalPoints}
              </div>
              <div className="text-lg">Jami ball</div>
              <div className="mt-4 text-sm text-gray-300">
                Yutuqlardan olingan ballar
              </div>
            </div>
          </div>
          
          <div className="bg-black/30 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
            <div className="text-center">
              <div className="text-4xl font-black text-purple-400 mb-2">
                #{userStats.rank || '-'}
              </div>
              <div className="text-lg">Oʻzbekistonda reyting</div>
              <div className="mt-4 text-sm text-gray-300">
                {userStats.rank ? `Top ${userStats.rank}` : 'Reytingda emas'}
              </div>
            </div>
          </div>
        </div>

        {/* Фильтры категорий */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Kategoriyalar</h2>
          <div className="flex flex-wrap gap-3">
            {CATEGORIES.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                  selectedCategory === category.id
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'bg-white/10 hover:bg-white/20 text-gray-300'
                }`}
              >
                <span>{category.icon}</span>
                <span>{category.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Список достижений */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAchievements.map(achievement => {
            const isUnlocked = unlockedAchievements.includes(achievement.id);
            const progress = getAchievementProgress(achievement);
            
            return (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`relative rounded-2xl p-6 border transition-all duration-300 ${
                  isUnlocked
                    ? 'bg-gradient-to-br from-white/10 to-white/5 border-green-500/30'
                    : 'bg-black/30 border-white/10 opacity-80'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`text-3xl p-3 rounded-xl ${
                    isUnlocked 
                      ? `bg-gradient-to-br ${achievement.color}`
                      : 'bg-white/10'
                  }`}>
                    {achievement.icon}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-1">{achievement.name}</h3>
                    <p className="text-gray-300 text-sm mb-3">{achievement.description}</p>
                    
                    {!isUnlocked && progress.required > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Progress: {progress.current}/{progress.required}</span>
                          <span>{progress.percent}%</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-4 flex justify-between items-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        isUnlocked
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-gray-700/50 text-gray-400'
                      }`}>
                        {isUnlocked ? '✅ Olingan' : '🔒 Olinmagan'}
                      </span>
                      <span className="text-yellow-400 font-bold">
                        +{achievement.points} ball
                      </span>
                    </div>
                  </div>
                </div>
                
                {isUnlocked && (
                  <div className="absolute top-3 right-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">✓</span>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Текущая статистика */}
        <div className="mt-12 text-center">
          <div className="inline-block bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-2xl p-6 border border-green-500/30">
            <h3 className="text-xl font-bold mb-2">💡 Maslahat</h3>
            <p className="text-gray-300 mb-4">
              Har kuni kamida bitta dars qiling, strekni saqlang va barcha yutuqlarni oching!
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-4">
              <div className="text-center">
                <div className="text-2xl">{userStats.lessons}</div>
                <div className="text-sm text-gray-400">Darslar</div>
              </div>
              <div className="text-center">
                <div className="text-2xl">{userStats.streak}</div>
                <div className="text-sm text-gray-400">Strek</div>
              </div>
              <div className="text-center">
                <div className="text-2xl">{userStats.courses}</div>
                <div className="text-sm text-gray-400">Kurslar</div>
              </div>
              <div className="text-center">
                <div className="text-2xl">{userStats.points}</div>
                <div className="text-sm text-gray-400">Ballar</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Achievements;