import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import TestCreatorInline from '../../Components/TestCreatorInline/TestCreatorInline';

const CourseManage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [newLesson, setNewLesson] = useState({
    title: '',
    description: '',
    videoFile: null
  });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [selectedLessonForTest, setSelectedLessonForTest] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          alert('Требуется авторизация');
          navigate('/eh-secret-admin-2025');
          return;
        }
        
        setIsAuthenticated(true);
        setUser(session.user);
        setAuthLoading(false);
        
        await loadCourseData();
      } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        navigate('/eh-secret-admin-2025');
      }
    };
    
    checkAuthAndLoad();
  }, [courseId, navigate]);

  const loadCourseData = async () => {
    try {
      setLoading(true);

      if (!courseId) {
        alert('ID курса не указан');
        navigate('/eh-secret-admin-2025');
        return;
      }

      console.log('Загрузка курса с ID:', courseId, 'Тип:', typeof courseId);

      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError) {
        console.error('Ошибка загрузки курса:', courseError);
        
        if (courseError.code === 'PGRST116') {
          alert('Курс не найден');
        } else {
          alert('Ошибка загрузки курса: ' + courseError.message);
        }
        
        navigate('/eh-secret-admin-2025');
        return;
      }

      if (!courseData) {
        alert('Курс не найден');
        navigate('/eh-secret-admin-2025');
        return;
      }

      console.log('Курс загружен:', courseData);
      setCourse(courseData);

      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true });

      if (lessonsError) {
        console.error('Ошибка загрузки уроков:', lessonsError);
        alert('Ошибка загрузки уроков: ' + lessonsError.message);
        setLessons([]);
      } else {
        console.log('Уроки загружены:', lessonsData?.length || 0);
        setLessons(lessonsData || []);
      }

    } catch (error) {
      console.error('Неожиданная ошибка при загрузке данных курса:', error);
      alert('Произошла неожиданная ошибка: ' + error.message);
      navigate('/eh-secret-admin-2025');
    } finally {
      setLoading(false);
    }
  };

  const getVideoDuration = (file) => new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      const minutes = Math.floor(video.duration / 60);
      const seconds = Math.floor(video.duration % 60);
      resolve(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };
    video.onerror = () => resolve('15:00');
    video.src = URL.createObjectURL(file);
  });

  const addLesson = async () => {
    if (!newLesson.title.trim()) {
      alert("Введите название урока!");
      return;
    }

    if (!courseId) {
      alert('ID курса не найден');
      return;
    }

    setUploading(true);

    try {
      let videoUrl = null;
      let duration = '15:00';
      let hasVideo = false;

      if (newLesson.videoFile) {
        try {
          const fileName = `${Date.now()}_${newLesson.videoFile.name.replace(/\s+/g, '_')}`;
          const filePath = `videos/${courseId}/temp/${fileName}`;

          console.log('Начинаю загрузку видео:', fileName);

          const { error: uploadError } = await supabase.storage
            .from('videos')
            .upload(filePath, newLesson.videoFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('videos')
            .getPublicUrl(filePath);

          videoUrl = publicUrl;
          duration = await getVideoDuration(newLesson.videoFile);
          hasVideo = true;
          
          console.log('Видео загружено успешно:', publicUrl);
        } catch (videoError) {
          console.error('Ошибка загрузки видео:', videoError);
          alert('Ошибка загрузки видео: ' + videoError.message);
        }
      }

      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .insert([{
          course_id: courseId,
          title: newLesson.title.trim(),
          description: newLesson.description || '',
          video_url: videoUrl,
          duration: duration,
          has_video: hasVideo,
          order_index: lessons.length + 1
        }])
        .select()
        .single();

      if (lessonError) {
        console.error('Ошибка создания урока:', lessonError);
        throw lessonError;
      }

      console.log('Урок создан:', lesson);

      const newLessonCount = (course?.lesson_count || 0) + 1;
      console.log('Обновляю количество уроков на:', newLessonCount);

      const { error: updateError } = await supabase
        .from('courses')
        .update({ 
          lesson_count: newLessonCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', courseId);

      if (updateError) {
        console.error('Ошибка обновления счётчика уроков:', updateError);
      } else {
        console.log('Счётчик уроков обновлён');
      }

      setNewLesson({ title: '', description: '', videoFile: null });
      setCourse(prev => prev ? { ...prev, lesson_count: newLessonCount } : null);
      await loadCourseData();
      alert('Урок успешно добавлен!');

    } catch (error) {
      console.error('Критическая ошибка добавления урока:', error);
      
      let errorMessage = 'Неизвестная ошибка';
      if (error.message) errorMessage = error.message;
      if (error.code) errorMessage += ` (Код: ${error.code})`;
      
      alert('Ошибка добавления урока: ' + errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const addVideoToLesson = async (lessonId, lessonTitle) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setUploading(true);
      try {
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = `videos/${courseId}/${lessonId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('videos')
          .getPublicUrl(filePath);

        const duration = await getVideoDuration(file);

        await supabase
          .from('lessons')
          .update({
            video_url: publicUrl,
            duration: duration,
            has_video: true
          })
          .eq('id', lessonId);

        alert(`Видео добавлено к уроку "${lessonTitle}"!`);
        await loadCourseData();
      } catch (error) {
        alert('Ошибка загрузки видео: ' + error.message);
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const deleteLesson = async (lessonId) => {
    if (!confirm('Удалить урок навсегда? Видео тоже будет удалено.')) return;

    if (!courseId) {
      alert('ID курса не найден');
      return;
    }

    try {
      console.log('Удаляю урок:', lessonId);

      const { error: deleteError } = await supabase
        .from('lessons')
        .delete()
        .eq('id', lessonId);

      if (deleteError) throw deleteError;

      console.log('Урок удалён, обновляю счётчик');

      const newLessonCount = Math.max(0, (course?.lesson_count || 0) - 1);
      
      const { error: updateError } = await supabase
        .from('courses')
        .update({ 
          lesson_count: newLessonCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', courseId);

      if (updateError) {
        console.error('Ошибка обновления счётчика уроков:', updateError);
      } else {
        console.log('Счётчик уроков обновлён на:', newLessonCount);
      }

      setCourse(prev => prev ? { ...prev, lesson_count: newLessonCount } : null);
      setLessons(prev => prev.filter(lesson => lesson.id !== lessonId));
      
      alert('Урок успешно удалён!');

    } catch (error) {
      console.error('Ошибка удаления урока:', error);
      alert('Ошибка удаления урока: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  const handleDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetId) => {
    e.preventDefault();
    if (dragId === targetId) return;

    const draggedLesson = lessons.find(l => l.id === dragId);
    const targetLesson = lessons.find(l => l.id === targetId);

    const newLessons = lessons.map(l => {
      if (l.id === dragId) return { ...l, order_index: targetLesson.order_index };
      if (l.id === targetId) return { ...l, order_index: draggedLesson.order_index };
      return l;
    }).sort((a, b) => a.order_index - b.order_index);

    setLessons(newLessons);

    await supabase.from('lessons').update({ order_index: targetLesson.order_index }).eq('id', dragId);
    await supabase.from('lessons').update({ order_index: draggedLesson.order_index }).eq('id', targetId);

    setDragId(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-2xl text-gray-600 dark:text-gray-400">Проверка авторизации...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-2xl text-red-600">Доступ запрещен</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-2xl text-gray-600 dark:text-gray-400">Загрузка курса...</div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-2xl text-red-600">Курс не найден</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-6">
      <div className="max-w-5xl mx-auto">

        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-5xl font-black text-gray-800 dark:text-white mb-2">
              {course.title}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Управление уроками • {course.lesson_count || 0} уроков
            </p>
          </div>
          <button
            onClick={() => navigate('/eh-secret-admin-2025')}
            className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition"
          >
            ← Назад в админку
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 mb-12 border border-gray-200 dark:border-gray-700">
          <h2 className="text-3xl font-bold mb-8 text-gray-800 dark:text-white">Добавить новый урок</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Название урока *</label>
              <input
                type="text"
                placeholder="Например: Введение в Python"
                value={newLesson.title}
                onChange={e => setNewLesson({ ...newLesson, title: e.target.value })}
                className="w-full px-6 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-400 outline-none transition"
                disabled={uploading}
              />
            </div>

            <div>
              <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Видео урока (опционально)</label>
              <input
                type="file"
                accept="video/*"
                onChange={e => setNewLesson({ ...newLesson, videoFile: e.target.files[0] || null })}
                className="w-full px-6 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:bg-gradient-to-r file:from-indigo-600 file:to-purple-600 file:text-white file:font-bold hover:file:opacity-90 transition"
                disabled={uploading}
              />
              {newLesson.videoFile && (
                <p className="mt-2 text-sm text-green-600">Выбрано: {newLesson.videoFile.name}</p>
              )}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Описание урока</label>
            <textarea
              placeholder="Краткое описание содержания урока..."
              value={newLesson.description}
              onChange={e => setNewLesson({ ...newLesson, description: e.target.value })}
              rows="4"
              className="w-full px-6 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-400 outline-none transition resize-none"
              disabled={uploading}
            />
          </div>

          <button
            onClick={addLesson}
            disabled={uploading || !newLesson.title.trim()}
            className={`px-10 py-5 rounded-xl text-xl font-bold shadow-xl transition ${uploading || !newLesson.title.trim()
              ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-gray-600"
              : "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
              }`}
          >
            {uploading ? "Добавление урока..." : "Добавить урок"}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-3xl font-bold mb-8 text-gray-800 dark:text-white">Уроки курса ({lessons.length})</h2>

          {lessons.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-2xl text-gray-500 dark:text-gray-400">Уроков пока нет</p>
              <p className="text-lg text-gray-400 mt-4">Добавьте первый урок выше ↑</p>
            </div>
          ) : (
            <div className="space-y-8">
              {lessons.map((lesson, index) => (
                <div key={lesson.id}>
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, lesson.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, lesson.id)}
                    className={`p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-2xl border border-gray-300 dark:border-gray-600 hover:shadow-xl transition cursor-move ${dragId === lesson.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                          <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400">#{index + 1}</span>
                          <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{lesson.title}</h3>
                        </div>

                        {lesson.description && (
                          <p className="text-gray-600 dark:text-gray-400 mb-4">{lesson.description}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-6 text-sm">
                          <span className="flex items-center gap-2">
                            ⏱ <span className="font-bold">{lesson.duration || '--:--'}</span>
                          </span>
                          {lesson.has_video ? (
                            <span className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold">
                              ✅ Видео бор
                            </span>
                          ) : (
                            <span className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-bold">
                              ⚠ Видео йўқ
                            </span>
                          )}
                          {lesson.has_test ? (
                            <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
                              ❓ Тест бор
                            </span>
                          ) : (
                            <span className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                              ❓ Тест йўқ
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {!lesson.has_video && (
                          <button
                            onClick={() => addVideoToLesson(lesson.id, lesson.title)}
                            className="px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl shadow hover:shadow-lg hover:scale-105 transition"
                          >
                            ➕ Video qo'shish
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedLessonForTest(lesson)}
                          className="px-5 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl shadow hover:shadow-lg hover:scale-105 transition flex items-center gap-2"
                        >
                          <span className="text-lg">❓</span>
                          Test qo'shish
                        </button>

                        <button
                          onClick={() => deleteLesson(lesson.id)}
                          className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow hover:shadow-lg transition flex items-center gap-2"
                        >
                          <span className="text-lg">🗑</span>
                          O'chirish
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectedLessonForTest?.id === lesson.id && (
                    <div className="mt-8 p-8 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl border border-indigo-200 dark:border-indigo-800">
                      <div className="flex justify-between items-center mb-6">
                        <h4 className="text-2xl font-bold text-indigo-800 dark:text-indigo-300">
                          ❓ Test yaratish: {lesson.title}
                        </h4>
                        <button
                          onClick={() => setSelectedLessonForTest(null)}
                          className="text-2xl text-gray-600 hover:text-red-600 transition"
                        >
                          ×
                        </button>
                      </div>

                      <TestCreatorInline 
                        lessonId={lesson.id} 
                        courseId={courseId} 
                        onClose={() => setSelectedLessonForTest(null)} 
                        onSave={() => loadCourseData()} 
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseManage;