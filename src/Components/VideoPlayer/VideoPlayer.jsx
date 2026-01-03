// src/components/VideoPlayer.jsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase'; // Если нужна интеграция с Supabase

const VideoPlayer = ({ videoUrl, thumbnailUrl, title, courseId, lessonId, userId }) => {
  const videoRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isWatched, setIsWatched] = useState(false);
  const [progress, setProgress] = useState(0);

  // Загрузка прогресса из Supabase
  useEffect(() => {
    const loadProgress = async () => {
      if (!userId || !courseId || !lessonId) return;
      
      try {
        const { data, error } = await supabase
          .from('user_progress')
          .select('progress, is_completed')
          .eq('user_id', userId)
          .eq('course_id', courseId)
          .eq('lesson_id', lessonId)
          .single();

        if (!error && data) {
          setProgress(data.progress || 0);
          setIsWatched(data.is_completed || false);
          
          // Если есть сохраненное время, устанавливаем
          if (videoRef.current && data.last_position) {
            videoRef.current.currentTime = data.last_position;
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки прогресса:', error);
      }
    };

    loadProgress();
  }, [userId, courseId, lessonId]);

  // Обновление времени воспроизведения
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    
    const current = videoRef.current.currentTime;
    const total = videoRef.current.duration;
    
    setCurrentTime(current);
    setDuration(total);
    
    // Рассчитываем прогресс
    const newProgress = total > 0 ? (current / total) * 100 : 0;
    setProgress(newProgress);
    
    // Автосохранение прогресса каждые 10 секунд
    if (Math.floor(current) % 10 === 0 && userId) {
      saveProgress(newProgress, current);
    }
    
    // Автоматическое помечание как просмотренное при 95% просмотра
    if (newProgress >= 95 && !isWatched) {
      markAsWatched();
    }
  };

  // Сохранение прогресса в Supabase
  const saveProgress = async (progressValue, lastPosition) => {
    if (!userId || !courseId || !lessonId) return;

    try {
      const { error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: userId,
          course_id: courseId,
          lesson_id: lessonId,
          progress: progressValue,
          last_position: lastPosition,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,course_id,lesson_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Ошибка сохранения прогресса:', error);
    }
  };

  // Пометить урок как просмотренный
  const markAsWatched = async () => {
    if (!userId || !courseId || !lessonId) return;

    try {
      const { error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: userId,
          course_id: courseId,
          lesson_id: lessonId,
          progress: 100,
          is_completed: true,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,course_id,lesson_id'
        });

      if (error) throw error;
      
      setIsWatched(true);
      alert('✅ Урок отмечен как просмотренный!');
    } catch (error) {
      console.error('Ошибка отметки урока:', error);
    }
  };

  // Завершить просмотр вручную
  const handleComplete = () => {
    markAsWatched();
  };

  // Форматирование времени
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="bg-black rounded-xl overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-auto max-h-[70vh]"
        controls
        controlsList="nodownload"
        poster={thumbnailUrl}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <source src={videoUrl} type="video/mp4" />
        Ваш браузер не поддерживает видео.
      </video>
      
      {/* Прогресс бар */}
      <div className="w-full bg-gray-800 h-1">
        <div 
          className="bg-green-500 h-1 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Информация под видео */}
      <div className="p-4 bg-gray-900">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-bold">{title}</h3>
          <div className="flex gap-2">
            <button 
              className={`px-3 py-1 rounded-lg ${isWatched ? 'bg-green-700' : 'bg-blue-600'}`}
              onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
            >
              {videoRef.current?.paused ? '▶️ Воспроизвести' : '⏸️ Пауза'}
            </button>
            <button 
              className="px-3 py-1 bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-600"
              onClick={handleComplete}
              disabled={isWatched}
            >
              {isWatched ? '✅ Просмотрено' : '✅ Завершить просмотр'}
            </button>
          </div>
        </div>
        
        {/* Статус прогресса */}
        <div className="text-sm text-gray-400">
          <div className="flex justify-between">
            <span>
              Прогресс: {progress.toFixed(1)}% 
              {isWatched && ' • ✅ Просмотрено'}
            </span>
            <span>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          
          {/* Если видео из Supabase Storage */}
          {videoUrl?.includes('supabase.co/storage') && (
            <div className="mt-2 text-xs text-blue-400">
              📁 Видео загружено из Supabase Storage
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;