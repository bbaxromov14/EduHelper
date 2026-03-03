// src/components/VideoUploader.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const VideoUploader = ({ courseId, lessonId, onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedVideo, setUploadedVideo] = useState(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Проверка типа файла
    if (!file.type.includes('video/')) {
      alert('❌ Пожалуйста, выберите видеофайл (MP4, AVI, MOV и т.д.)');
      return;
    }

    // Проверка размера (макс 500MB)
    if (file.size > 500 * 1024 * 1024) {
      alert('❌ Максимальный размер видео: 500MB');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // 1. Создаем уникальный путь для файла
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `videos/${courseId}/${lessonId}/${fileName}`;

      // 2. Загружаем видео в Supabase Storage
      const { data, error } = await supabase.storage
        .from('edhelper-videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          // Для отслеживания прогресса (если нужно)
          // onUploadProgress: (progress) => {
          //   const percent = (progress.loaded / progress.total) * 100;
          //   setProgress(Math.round(percent));
          // }
        });

      if (error) throw error;

      // 3. Получаем публичный URL видео
      const { data: { publicUrl } } = supabase.storage
        .from('edhelper-videos')
        .getPublicUrl(filePath);

      // 4. Получаем длительность видео (опционально)
      const duration = await getVideoDuration(file);

      // 5. Сохраняем информацию в базу данных
      const { error: dbError } = await supabase
        .from('lessons')
        .update({
          video_url: publicUrl,
          video_duration: duration,
          has_video: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', lessonId);

      if (dbError) throw dbError;

      // УСПЕХ!
      const videoInfo = {
        url: publicUrl,
        path: filePath,
        duration: duration,
        size: file.size,
        name: file.name
      };

      setUploadedVideo(videoInfo);
      setProgress(100);

      alert(`✅ Видео загружено!\nДлительность: ${duration}\nURL: ${publicUrl}`);

      // Вызываем callback если есть
      if (onUploadSuccess) {
        onUploadSuccess(videoInfo);
      }

    } catch (error) {
      console.error('❌ Ошибка загрузки:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 2000);
    }
  };

  // Функция для получения длительности видео
  const getVideoDuration = (file) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        const duration = video.duration;
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        resolve(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      };
      
      video.onerror = () => {
        resolve('Неизвестно');
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  return (
    <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        🎬 Загрузка видео в Supabase Storage
      </h3>

      {/* Информация о загруженном видео */}
      {uploadedVideo && (
        <div className="mb-6 p-4 bg-green-900/20 rounded-lg border border-green-700/30">
          <h4 className="font-bold mb-2">✅ Видео загружено:</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Название: <span className="text-gray-300">{uploadedVideo.name}</span></div>
            <div>Длительность: <span className="text-gray-300">{uploadedVideo.duration}</span></div>
            <div className="col-span-2">
              URL: <a href={uploadedVideo.url} target="_blank" rel="noreferrer" className="text-blue-400 break-all">
                {uploadedVideo.url.substring(0, 60)}...
              </a>
            </div>
          </div>
          <button
            onClick={() => window.open(uploadedVideo.url, '_blank')}
            className="mt-3 px-4 py-2 bg-blue-600 rounded-lg text-sm hover:bg-blue-700"
          >
            🎬 Открыть видео
          </button>
        </div>
      )}

      {/* Прогресс загрузки */}
      {uploading && (
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span>Загрузка видео...</span>
            <span className="font-bold">{progress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Не закрывайте страницу до завершения
          </div>
        </div>
      )}

      {/* Кнопка загрузки */}
      <label className="block">
        <input
          type="file"
          accept="video/mp4,video/x-m4v,video/*"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
          id="video-upload"
        />
        <div className={`
          w-full p-4 text-center rounded-xl cursor-pointer transition-all
          ${uploading 
            ? 'bg-gray-700 cursor-not-allowed opacity-70' 
            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90'
          }
        `}>
          {uploading ? (
            <>📤 Загрузка видео... {progress}%</>
          ) : (
            <>📁 Выбрать видеофайл</>
          )}
        </div>
      </label>

      {/* Информация о требованиях */}
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>MP4, AVI, MOV</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <span>До 500MB</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span>Авто-превью</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
          <span>Публичная ссылка</span>
        </div>
      </div>

      {/* Кнопка тестирования */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <button
          onClick={() => {
            // Создаем тестовый файл для проверки
            const testFile = new File(
              ['test video content'], 
              'test_video.mp4', 
              { type: 'video/mp4' }
            );
            const event = { target: { files: [testFile] } };
            handleFileUpload(event);
          }}
          className="px-4 py-2 bg-yellow-600 rounded-lg text-sm hover:bg-yellow-700"
        >
          🧪 Тест загрузки (фейковый файл)
        </button>
        <p className="text-xs text-gray-500 mt-2">
          Нажмите для проверки без реального файла
        </p>
      </div>
    </div>
  );
};

export default VideoUploader;