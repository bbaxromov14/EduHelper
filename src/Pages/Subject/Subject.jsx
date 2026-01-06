// src/Pages/Subject/Subject.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/ReactContext.jsx';
import { lessonService } from '../../services/lessonService.js';
import confetti from 'canvas-confetti';
import { supabase } from '../../lib/supabase';

const Subject = () => {
  const [videoModal, setVideoModal] = useState({
    open: false,
    url: '',
    title: '',
    isYouTube: false
  });
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [subject, setSubject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [justCompleted, setJustCompleted] = useState(null);
  const [progress, setProgress] = useState({
    completedLessons: [],
    progressPercent: 0,
    totalLessons: 0,
    completedCount: 0
  });

  useEffect(() => {
    const loadSubject = async () => {
      try {
        setLoading(true);

        const courseData = await lessonService.getCourse(subjectId);
        if (!courseData) {
          alert('Курс не найден');
          navigate('/subjects');
          return;
        }

        const lessonsData = await lessonService.getCourseLessons(subjectId);
        const lessons = lessonsData || [];

        let completedLessons = [];

        if (authUser?.id) {
          try {
            // 1. Получаем прогресс пользователя
            const progressData = await lessonService.getUserProgress(authUser.id, subjectId);
            const uniqueIds = new Set(
              progressData
                .filter(p => p?.completed)
                .map(p => p.lesson_id)
            );
            completedLessons = Array.from(uniqueIds);

            // 2. Дополнительная проверка: синхронизируем с реальными уроками курса
            // Это нужно чтобы удалить из completedLessons те уроки, которых нет в текущем курсе
            const validLessonIds = lessons.map(lesson => lesson.id);
            completedLessons = completedLessons.filter(id => validLessonIds.includes(id));

            // 3. Верификация: проверяем что прогресс действительно существует в базе
            if (completedLessons.length > 0) {
              const { data: verifiedProgress } = await supabase
                .from('user_progress')
                .select('lesson_id, completed')
                .eq('user_id', authUser.id)
                .in('lesson_id', completedLessons)
                .eq('completed', true);

              if (verifiedProgress) {
                // Обновляем completedLessons только подтвержденными записями
                const verifiedIds = new Set(verifiedProgress.map(p => p.lesson_id));
                completedLessons = completedLessons.filter(id => verifiedIds.has(id));
              }
            }

          } catch (err) {
            console.error('Ошибка загрузки прогресса:', err);
          }
        } else {
          // Guest progress
          const saved = localStorage.getItem('guest_progress') || '{}';
          const guestProgress = JSON.parse(saved);
          completedLessons = guestProgress[subjectId]?.completedLessons || [];

          // Фильтруем гостевой прогресс по реальным урокам
          const validLessonIds = lessons.map(lesson => lesson.id);
          completedLessons = completedLessons.filter(id => validLessonIds.includes(id));

          // Сохраняем обратно отфильтрованный прогресс
          if (completedLessons.length > 0) {
            guestProgress[subjectId] = { completedLessons };
            localStorage.setItem('guest_progress', JSON.stringify(guestProgress));
          }
        }

        const completedCount = completedLessons.length;
        const progressPercent = lessons.length > 0
          ? Math.min(100, Math.round((completedCount / lessons.length) * 100))
          : 0;

        setSubject({ ...courseData, lessons });
        setProgress({
          completedLessons,
          progressPercent,
          totalLessons: lessons.length,
          completedCount
        });

          уроки: lessons.length,
          завершено: completedCount,
          процент: progressPercent + '%'
        });
      } catch (error) {
        console.error('Ошибка загрузки курса:', error);
        alert('❌ Курсни юклаб бўлмади. Qayta urinib ko‘ring.');
        navigate('/subjects');
      } finally {
        setLoading(false);
      }
    };

    if (subjectId) loadSubject();
  }, [subjectId, authUser?.id, navigate]);

  useEffect(() => {
    const prevent = (e) => videoModal.open && e.preventDefault();
    if (videoModal.open) {
      document.addEventListener('contextmenu', prevent);
      document.addEventListener('keydown', prevent);
    }
    return () => {
      document.removeEventListener('contextmenu', prevent);
      document.removeEventListener('keydown', prevent);
    };
  }, [videoModal.open]);

  const extractYouTubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  const openVideoModal = (lesson) => {
    if (!lesson.video_url) return alert('❌ Бу дарсда видео мавжуд эмас!');

    const youtubeId = extractYouTubeId(lesson.video_url);
    setVideoModal({
      open: true,
      url: youtubeId ? `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1` : lesson.video_url,
      title: lesson.title,
      isYouTube: !!youtubeId
    });
  };

  const closeVideoModal = () => setVideoModal({ open: false, url: '', title: '', isYouTube: false });

  // Когда пользователь завершает последний урок курса:
  // Когда пользователь завершает последний урок курса:
  const checkAndUpdateReferralStatus = async (userId) => {
    try {
      // 1. Проверяем, есть ли реферал для этого пользователя
      const { data: referralData, error: referralError } = await supabase
        .from('referrals')
        .select('id, referrer_id, referral_code')
        .eq('referred_user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();

      if (referralError) {
        console.error('Ошибка поиска реферала:', referralError);
        return;
      }

      if (!referralData) {
        return;
      }

      // 2. Проверяем, завершил ли пользователь хотя бы один курс
      const { data: completedLessons, error: lessonsError } = await supabase
        .from('user_progress') // ← ИСПРАВЛЕНО: было user_lessons
        .select('lesson_id')
        .eq('user_id', userId)
        .eq('completed', true);

      if (lessonsError) {
        console.error('Ошибка проверки уроков:', lessonsError);
        return;
      }

      // 3. Если есть завершенные уроки, обновляем статус реферала
      if (completedLessons && completedLessons.length > 0) {
        const { error: updateError } = await supabase
          .from('referrals')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', referralData.id);

        if (updateError) {
          console.error('Ошибка обновления реферала:', updateError);
        } else {

          // 4. Можно также начислить баллы рефереру
          try {
            await supabase.rpc('increment_user_points', {
              user_uuid: referralData.referrer_id, // ← ПРАВИЛЬНЫЙ ПАРАМЕТР
              points_to_add: 10
            });
          } catch (pointsError) {
          }
        }
      }
    } catch (error) {
      console.error('Ошибка в checkAndUpdateReferralStatus:', error);
    }
  };

  useEffect(() => {
    // Проверяем, завершен ли весь курс
    if (progress.completedCount === progress.totalLessons && progress.totalLessons > 0) {
      if (authUser?.id) {
        checkAndUpdateReferralStatus(authUser.id);
      }
    }
  }, [progress, authUser?.id]);

  const handleLessonComplete = async (lessonId) => {
    // Проверяем локально
    if (progress.completedLessons.includes(lessonId)) {
      return;
    }

    try {
      let shouldUpdateLocalState = true;

      if (authUser?.id) {
        try {
          // Сначала проверяем есть ли уже запись в базе
          const { data: existingProgress } = await supabase
            .from('user_progress')
            .select('id, completed')
            .eq('user_id', authUser.id)
            .eq('lesson_id', lessonId)
            .maybeSingle();

          if (existingProgress?.completed) {
            // Не показываем анимацию повторно
            shouldUpdateLocalState = true; // Но обновляем локальное состояние
          } else {
            // Сохраняем прогресс
            await lessonService.updateProgress(authUser.id, lessonId, subjectId, true, 100);
          }
        } catch (progressError) {
          console.error('Ошибка при проверке/сохранении прогресса:', progressError);
          // Даже при ошибке можем обновить локальное состояние
        }
      } else {
        // Guest progress
        const saved = localStorage.getItem('guest_progress') || '{}';
        const guestProgress = JSON.parse(saved);
        if (!guestProgress[subjectId]) guestProgress[subjectId] = { completedLessons: [] };
        if (!guestProgress[subjectId].completedLessons.includes(lessonId)) {
          guestProgress[subjectId].completedLessons.push(lessonId);
          localStorage.setItem('guest_progress', JSON.stringify(guestProgress));
        }
      }

      // Обновляем локальное состояние только если нужно
      if (shouldUpdateLocalState && !progress.completedLessons.includes(lessonId)) {
        // Анимация только если урок действительно был завершен впервые
        if (!progress.completedLessons.includes(lessonId)) {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']
          });

          setJustCompleted(lessonId);
          setTimeout(() => setJustCompleted(null), 3000);
        }

        const newCompleted = [...progress.completedLessons, lessonId];
        const newCount = newCompleted.length;
        const newPercent = subject.lessons.length > 0
          ? Math.min(100, Math.round((newCount / subject.lessons.length) * 100))
          : 0;

        setProgress({
          ...progress,
          completedLessons: newCompleted,
          progressPercent: newPercent,
          completedCount: newCount
        });
      }
    } catch (error) {
      console.error('Ошибка завершения урока:', error);
      alert('Хатолик юз берди: ' + error.message);
    }
  };

  const getCourseImage = () => {
    if (subject?.cover_image_url?.startsWith('http')) return subject.cover_image_url;

    const defaults = {
      kimyo: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=1200',
      matematika: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1200',
      fizika: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=1200',
      biologiya: 'https://images.unsplash.com/photo-1530026405189-8745d6e7f4c8?w=1200',
      'ona tili': 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=1200',
      'ingliz tili': 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=1200',
      tarix: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=1200',
      geografiya: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200'
    };

    const lower = subject?.title?.toLowerCase() || '';
    for (const [key, img] of Object.entries(defaults)) {
      if (lower.includes(key)) return img;
    }
    return 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200';
  };

  const getCourseIcon = (title) => {
    const icons = {
      matematika: '🧮', kimyo: '⚗️', fizika: '⚛️', biologiya: '🔬',
      'ona tili': '📚', 'ingliz tili': '🇬🇧', tarix: '🏛️', geografiya: '🌍',
      informatika: '💻', python: '🐍', javascript: '⚡', dasturlash: '👨‍💻'
    };
    const lower = title.toLowerCase();
    for (const [key, icon] of Object.entries(icons)) {
      if (lower.includes(key)) return icon;
    }
    return '📖';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-white"></div>
          <div className="text-4xl font-black text-white animate-pulse">
            Kurs yuklanmoqda...
          </div>
        </div>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex flex-col items-center justify-center gap-6">
        <div className="text-6xl">😔</div>
        <div className="text-4xl font-black text-white text-center">
          Kurs topilmadi
        </div>
        <button
          onClick={() => navigate('/subjects')}
          className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl font-bold text-xl hover:scale-105 transition-all"
        >
          ← Barcha kurslarga qaytish
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white py-12 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden shadow-2xl mb-8 md:mb-12">
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent z-10"></div>
          <img
            src={getCourseImage()}
            alt={subject.title}
            className="w-full h-64 md:h-96 object-cover"
            onError={(e) => (e.target.src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200')}
            loading="lazy"
          />

          <div className="absolute inset-0 flex items-center z-20">
            <div className="container mx-auto px-4 md:px-8">
              <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 mb-4 md:mb-6">
                <div className="text-6xl md:text-8xl bg-black/60 backdrop-blur-lg rounded-3xl p-4 md:p-6 border border-white/20">
                  {getCourseIcon(subject.title)}
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h1 className="text-4xl md:text-6xl lg:text-8xl font-black mb-2">{subject.title}</h1>
                  {subject.description && (
                    <p className="text-lg md:text-2xl opacity-90 max-w-3xl bg-black/40 backdrop-blur-sm rounded-xl p-3 md:p-4 inline-block">
                      {subject.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 md:gap-4 mb-4 md:mb-6">
                <div className="px-3 md:px-4 py-2 bg-black/40 backdrop-blur rounded-xl border border-white/20 text-sm md:text-base">
                  <span className="opacity-80">📚 Darslar soni:</span> {subject.lessons.length}
                </div>
                <div className="px-3 md:px-4 py-2 bg-black/40 backdrop-blur rounded-xl border border-white/20 text-sm md:text-base">
                  <span className="opacity-80">⏱️ Taxminiy vaqt:</span> {subject.estimated_hours || 10} soat
                </div>
                <div className="px-3 md:px-4 py-2 bg-black/40 backdrop-blur rounded-xl border border-white/20 text-sm md:text-base">
                  <span className="opacity-80">📊 Daraja:</span> {subject.difficulty_level || 'O‘rta'}
                </div>
                {!subject.is_free && (
                  <div className="px-4 md:px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold rounded-full backdrop-blur-md text-sm md:text-base">
                    ⭐ PREMIUM
                  </div>
                )}
              </div>

              <div className="mt-6 md:mt-8 max-w-2xl backdrop-blur-md bg-black/30 rounded-2xl p-4 md:p-6 border border-white/20">
                <div className="flex flex-col md:flex-row justify-between gap-2 md:gap-0 mb-3">
                  <span className="text-lg md:text-xl font-bold">
                    {progress.completedCount} / {subject.lessons.length} dars bajarildi
                  </span>
                  <span className="text-3xl md:text-4xl font-black text-yellow-400">
                    {progress.progressPercent}%
                  </span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-4 md:h-6 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-purple-600 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${progress.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-3xl md:text-5xl font-black text-center mb-8 md:mb-12 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Darslar ro'yxati ({subject.lessons.length} ta)
        </h2>

        {subject.lessons.length === 0 ? (
          <div className="text-center py-12 bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20">
            <div className="text-8xl mb-6">📭</div>
            <h3 className="text-2xl md:text-3xl font-bold mb-4">Hozircha darslar mavjud emas</h3>
            <p className="opacity-80 mb-8">Tez orada yangi darslar qo'shiladi</p>
          </div>
        ) : (
          <div className="space-y-4 md:space-y-6">
            {subject.lessons.map((lesson, index) => {
              const isCompleted = progress.completedLessons.includes(lesson.id);
              const isJustCompleted = justCompleted === lesson.id;

              return (
                <div
                  key={lesson.id}
                  className={`group relative bg-white/10 backdrop-blur-xl rounded-3xl p-4 md:p-8 border border-white/20 hover:border-white/50 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl ${isJustCompleted ? 'animate-bounce' : ''}`}
                >
                  <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6">
                    <div className="flex items-center gap-4 md:gap-8 flex-1">
                      <div
                        className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl md:text-4xl font-black shadow-2xl ${isCompleted ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-blue-600 to-purple-600'}`}
                      >
                        {isCompleted ? '✓' : index + 1}
                      </div>

                      <div className="flex-1">
                        <h3 className="text-xl md:text-3xl font-bold mb-1 md:mb-2 flex items-center gap-2 md:gap-4">
                          {lesson.title}
                          {isCompleted && <span className="text-3xl md:text-5xl">🏆</span>}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-base md:text-xl opacity-80">
                          <span className="flex items-center gap-1 md:gap-2">
                            <span>⏱️</span> {lesson.duration_minutes || 15} min
                          </span>
                          {!lesson.is_free && (
                            <span className="px-2 md:px-3 py-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-full border border-yellow-500/30 text-sm md:text-base">
                              🔒 Premium
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 md:gap-4 w-full md:w-auto mt-4 md:mt-0">
                      {!isCompleted ? (
                        <button
                          onClick={() => handleLessonComplete(lesson.id)}
                          className="px-4 md:px-10 py-3 md:py-5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl font-bold text-lg md:text-xl shadow-2xl hover:scale-105 transition-all hover:shadow-green-500/50 text-center"
                        >
                          Bajarildi
                        </button>
                      ) : (
                        <div className="px-4 md:px-12 py-3 md:py-5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl font-bold text-lg md:text-xl shadow-2xl flex items-center justify-center gap-2 md:gap-3">
                          <span>✅</span> Bajarildi!
                        </div>
                      )}

                      {lesson.video_url && (
                        <button
                          onClick={() => openVideoModal(lesson)}
                          className="px-4 md:px-10 py-3 md:py-5 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-2xl font-bold text-lg md:text-xl shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2 md:gap-3"
                        >
                          <span>▶️</span> Video
                        </button>
                      )}

                      {isCompleted && lesson.has_test && (
                        <button
                          onClick={() => navigate(`/test/${subjectId}/${lesson.id}`)}
                          className="px-4 md:px-10 py-3 md:py-5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-2xl font-bold text-lg md:text-xl shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-2 md:gap-3 animate-pulse"
                        >
                          <span>❓</span> Test ishlash
                        </button>
                      )}
                    </div>
                  </div>

                  {isJustCompleted && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="text-6xl md:text-9xl animate-ping">⭐</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 md:mt-12 text-center">
          <button
            onClick={() => navigate('/subjects')}
            className="px-6 md:px-10 py-3 md:py-5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl font-bold text-lg md:text-xl hover:scale-105 transition-all shadow-2xl"
          >
            ← Barcha kurslarga qaytish
          </button>
        </div>

        {videoModal.open && (
          <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4" onClick={closeVideoModal}>
            <div
              className="relative w-full max-w-5xl bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-purple-600"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={closeVideoModal}
                className="absolute top-4 right-4 z-50 w-12 h-12 bg-black/70 hover:bg-red-600/80 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-2xl transition-all duration-300 hover:scale-110 hover:rotate-90"
              >
                ×
              </button>

              <div className="p-6 bg-gradient-to-r from-purple-900 to-blue-900">
                <h3 className="text-2xl md:text-3xl font-black text-white text-center truncate">
                  {videoModal.title}
                </h3>
              </div>

              <div className="relative pt-[56.25%] bg-black">
                {videoModal.isYouTube ? (
                  <iframe
                    src={videoModal.url}
                    className="absolute inset-0 w-full h-full rounded-b-3xl"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    title={videoModal.title}
                  />
                ) : (
                  <video
                    controls
                    controlsList="nodownload noplaybackrate"
                    className="absolute inset-0 w-full h-full rounded-b-3xl"
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <source src={videoModal.url} type="video/mp4" />
                    Браузерингиз видео қўлламайди.
                  </video>
                )}
              </div>

              <div className="p-4 text-center bg-gradient-to-r from-red-900/50 to-purple-900/50">
                <p className="text-yellow-400 font-bold text-lg">
                  ⚠️ ВИДЕО ЗАЩИЩЕНО! Копирование и скачивание запрещены!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Subject;