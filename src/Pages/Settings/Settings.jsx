// src/Pages/Settings.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/ReactContext';
import { supabase } from '../../lib/supabase';
import premiumManager from '../../Utils/premiumManager';

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  
  const fileInputRef = useRef(null);
  
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [language, setLanguage] = useState(i18n.language);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [premiumStatus, setPremiumStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState({
    coursesCompleted: 0,
    lessonsCompleted: 0,
    successRate: 0,
  });
  
  // Список запрещенных слов и имен
  const forbiddenWords = [
    // Административные/системные слова
    'admin', 'administrator', 'moderator', 'support', 'system', 'root', 'superuser',
    'eduhelper', 'edu helper', 'eduhelper admin', 'admin eduhelper',
    'ehelper', 'education helper', 'курс', 'course', 'обучение',
    
    // Нецензурные/оскорбительные слова (рус/узб)
    'am', 'kot', 'ko\'t', 'qotoq', 'qo\'toq', 'jalab', 'foxisha',
    'сука', 'блядь', 'пизда', 'хуй', 'ебать', 'пидор', 'гандон',
    'jinni', 'jallob', 'ahmoq', 'tentak', 'gelak', 'gandon',
    'shaitan', 'iblis', 'jin', 'dev', 'шайтан', 'ибис',
    
    // 18+ контент
    'sex', 'porn', 'xxx', 'onlyfans', 'порно', 'секс', 'шлюха',
    'prostitute', 'hooker', 'escort', 'проститутка', 'курва',
    'fuck', 'shit', 'bitch', 'asshole', 'dick', 'cock',
    
    // Другие запрещенные
    'hack', 'hacker', 'cracker', 'взлом', 'взломщик',
    'scam', 'fraud', 'мошенник', 'аферист',
    'drug', 'наркотик', 'наркоман', 'алкоголь',
    
    // Религиозные оскорбления
    'kofir', 'kofr', 'язычник', 'еретик', 'blasphemy',
    
    // Расистские/дискриминационные
    'nigger', 'ниггер', 'чурка', 'хач', 'blackie',
  ];

  // Загружаем профиль и настройки
  useEffect(() => {
    const loadSettings = async () => {
      if (user?.id) {
        try {
          // Загружаем премиум статус
          const status = await premiumManager.checkPremiumStatus(user.id);
          setPremiumStatus(!!status?.is_active);

          // Загружаем профиль пользователя
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('preferred_language, full_name, avatar_url, username, points, total_points')
            .eq('id', user.id)
            .single();

          if (!error && profileData) {
            // Устанавливаем язык
            if (profileData.preferred_language) {
              i18n.changeLanguage(profileData.preferred_language);
              setLanguage(profileData.preferred_language);
            }
            
            // Устанавливаем имя (приоритет: username > full_name > email)
            const displayName = profileData.username || profileData.full_name || user.email;
            setName(displayName);
            
            // Устанавливаем аватар
            if (profileData.avatar_url) {
              setAvatar(profileData.avatar_url);
            }
          }

          // Загружаем статистику
          await loadUserStats(user.id);
        } catch (err) {
          console.error('Ошибка загрузки настроек:', err);
        }
      }

      // Тёмная тема из localStorage или системы
      const savedDark = localStorage.getItem('darkMode') === 'true';
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(savedDark || systemDark);
      if (savedDark || systemDark) document.documentElement.classList.add('dark');
    };
    
    loadSettings();
  }, [user, i18n]);

  // Загрузка статистики пользователя
  const loadUserStats = async (userId) => {
    try {
      // Получаем прогресс пользователя
      const { data: progressData, error } = await supabase
        .from('user_progress')
        .select('course_id, completed, points, score')
        .eq('user_id', userId);

      if (error) throw error;

      // Получаем завершенные курсы
      const { data: completionsData } = await supabase
        .from('course_completions')
        .select('course_id')
        .eq('user_id', userId);

      // Рассчитываем статистику
      const completedLessons = progressData?.filter(p => p.completed).length || 0;
      const totalPoints = progressData?.reduce((sum, p) => sum + (p.points || 0), 0) || 0;
      const completedCourses = completionsData?.length || 0;
      
      // Процент успеха (минимум 50%, максимум 94%)
      const successRate = completedLessons > 0 
        ? Math.min(94, Math.max(50, Math.round((totalPoints / (completedLessons * 100)) * 100)))
        : 50;

      setStats({
        coursesCompleted: completedCourses,
        lessonsCompleted: completedLessons,
        successRate: successRate,
      });
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
    }
  };

  // Проверка имени на запрещенные слова
  const validateName = (name) => {
    if (!name || name.trim().length < 2) {
      return { valid: false, message: 'Ism kamida 2 ta belgidan iborat bo\'lishi kerak' };
    }
    
    if (name.length > 50) {
      return { valid: false, message: 'Ism 50 ta belgidan oshmasligi kerak' };
    }
    
    const nameLower = name.toLowerCase();
    
    // Проверка на запрещенные слова
    for (const word of forbiddenWords) {
      if (nameLower.includes(word.toLowerCase())) {
        return { 
          valid: false, 
          message: `Ismda "${word}" so'zi taqiqlangan. Iltimos, boshqa ism tanlang.`
        };
      }
    }
    
    // Проверка на специальные символы (разрешены только буквы, цифры, пробелы и дефисы)
    const validCharsRegex = /^[a-zA-Zа-яА-ЯёЁўЎғҒқҚҳҲөӨүҮ0-9\s\-']+$/;
    if (!validCharsRegex.test(name)) {
      return { 
        valid: false, 
        message: 'Ismda faqat harflar, raqamlar, probellar va tire belgilari ishlatilishi mumkin' 
      };
    }
    
    // Проверка на повторяющиеся пробелы
    if (/\s{2,}/.test(name)) {
      return { valid: false, message: 'Ismda ketma-ket probellar ishlatilishi mumkin emas' };
    }
    
    return { valid: true, message: '' };
  };

  // Смена языка
  const changeLanguage = async (lang) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    
    // Сохраняем в профиль
    if (user?.id) {
      try {
        await supabase
          .from('profiles')
          .update({ preferred_language: lang })
          .eq('id', user.id);
      } catch (err) {
        console.error('Ошибка сохранения языка:', err);
      }
    }
  };

  // Переключение темы
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Обработка загрузки фото
  const handleAvatarChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Проверка размера файла (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Rasm hajmi 5MB dan oshmasligi kerak!');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      setMessage('Faqat rasm fayllari yuklash mumkin! (JPG, PNG, GIF)');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setLoading(true);
    setMessage('Rasm yuklanmoqda...');

    try {
      // Создаем уникальное имя файла
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      // Загружаем в Supabase Storage (предполагается, что bucket 'avatars' существует)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Получаем публичный URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Обновляем аватар в профиле
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Обновляем локальное состояние
      setAvatar(publicUrl);
      setMessage('Rasm muvaffaqiyatli yuklandi! ✅');
      
      // Показываем сообщение об успехе
      setTimeout(() => {
        setMessage('Profil yangilandi! Барча маълумотлар базада сақланди.');
        setTimeout(() => setMessage(''), 5000);
      }, 1000);

    } catch (err) {
      console.error('Ошибка загрузки аватара:', err);
      
      // Если нет storage, используем base64 как fallback
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Avatar = e.target.result;
        
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ 
              avatar_url: base64Avatar,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

          if (error) throw error;
          
          setAvatar(base64Avatar);
          setMessage('Rasm muvaffaqiyatli yuklandi! (Base64) ✅');
        } catch (fallbackError) {
          setMessage('Rasm yuklashda xatolik!');
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // Сохранение профиля
  const saveProfile = async () => {
    // Валидация имени
    const validation = validateName(name);
    if (!validation.valid) {
      setMessage(validation.message);
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    setLoading(true);
    setMessage('Saqlanmoqda...');

    try {
      // Генерируем username из имени (убираем пробелы, приводим к нижнему регистру)
      const username = name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .substring(0, 30);

      const updates = {
        full_name: name.trim(),
        username: username,
        preferred_language: language,
        updated_at: new Date().toISOString(),
      };

      const { error, data } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Проверяем, что данные обновились
      if (data) {
        setMessage('✅ Profil muvaffaqiyatli saqlandi! Барча маълумотлар базада сақланди.');
        
        // Показываем подробности обновления
        setTimeout(() => {
          setMessage(`✅ Yangilangan: Ism → ${data.full_name}, Username → ${data.username}, Til → ${data.preferred_language}`);
          setTimeout(() => setMessage(''), 5000);
        }, 1000);
      }

    } catch (err) {
      console.error('Ошибка сохранения профиля:', err);
      setMessage('❌ Xatolik yuz berdi: ' + (err.message || 'Noma\'lum xatolik'));
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // Форматирование сообщения
  const renderMessage = () => {
    if (!message) return null;
    
    const isError = message.includes('Xatolik') || message.includes('taqiqlangan');
    const isSuccess = message.includes('✅') || message.includes('saqlandi');
    
    return (
      <div className={`text-center p-4 rounded-2xl mb-6 text-xl font-bold ${
        isError 
          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
          : isSuccess
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
      }`}>
        {message}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-purple-100 dark:from-black dark:via-gray-900 dark:to-purple-900 py-12 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Приветствие */}
        <div className="text-center mb-12">
          <h1 className="text-6xl md:text-7xl font-black mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            {t('settings') || 'Sozlamalar'}
          </h1>
          <p className="text-2xl text-gray-700 dark:text-gray-300">
            Salom, <span className="font-bold text-purple-600 dark:text-yellow-400">{name || user?.email}</span> 👨‍✈️
          </p>
          <p className="text-lg mt-2 opacity-80">Sizning shaxsiy boshqaruv panelingiz</p>
        </div>

        {/* Сообщения */}
        {renderMessage()}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Левая колонка: Аватар + Статистика */}
          <div className="space-y-8">
            {/* Аватар */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 text-center">
              <div className="w-40 h-40 mx-auto rounded-full overflow-hidden border-4 border-purple-500 shadow-xl mb-6 relative group">
                <img
                  src={avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=6366f1&color=fff&size=256`}
                  alt="Avatar"
                  className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                />
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white text-black px-4 py-2 rounded-full font-bold hover:bg-gray-100 transition"
                  >
                    📷 O'zgartirish
                  </button>
                </div>
              </div>
              
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-bold hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Yuklanmoqda...' : '🖼️ Rasmni o‘zgartirish'}
              </button>
              
              {premiumStatus && (
                <div className="mt-6 text-2xl animate-pulse">⭐ PREMIUM</div>
              )}
              
              <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                Rasm o'lchami: maks 5MB
                <br />
                Formatlar: JPG, PNG, GIF
              </div>
            </div>

            {/* Статистика */}
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl shadow-2xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-6 text-center">📊 Sizning Progressingiz</h3>
              <div className="space-y-4 text-xl">
                <div className="flex justify-between">
                  <span>O‘rganilgan kurslar</span> 
                  <b>{stats.coursesCompleted}</b>
                </div>
                <div className="flex justify-between">
                  <span>Bajarilgan darslar</span> 
                  <b>{stats.lessonsCompleted}</b>
                </div>
                <div className="flex justify-between">
                  <span>Muvaffaqiyat darajasi</span> 
                  <b className="text-yellow-300">{stats.successRate}%</b>
                </div>
                <div className="mt-6 pt-6 border-t border-white/20">
                  <div className="text-center text-sm opacity-80">
                    Har kuni dars qilishni unutmang! 🚀
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Центральная колонка: Основные настройки */}
          <div className="lg:col-span-2 space-y-8">
            {/* Профиль */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                👤 {t('profile_settings') || 'Profil sozlamalari'}
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-xl font-semibold mb-2">
                    {t('name') || 'Ism va Familiya'} 
                    <span className="text-sm text-gray-500 ml-2">(Majburiy)</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:border-purple-500 text-xl"
                    placeholder="Masalan: Azizbek Alimov"
                  />
                  <div className="mt-2 text-sm text-gray-500">
                    Kamida 2 ta belgi. Taqiqlangan so'zlar: Admin, EduHelper, 18+ so'zlar va boshqalar.
                  </div>
                </div>
                <div>
                  <label className="block text-xl font-semibold mb-2">📧 Email manzili</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-6 py-4 rounded-2xl bg-gray-100 dark:bg-gray-900 text-xl cursor-not-allowed"
                  />
                  <div className="mt-2 text-sm text-gray-500">
                    Email manzilni o'zgartirish uchun support@eduhelper.uz ga murojaat qiling.
                  </div>
                </div>
              </div>
            </div>

            {/* Язык и тема */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
                <h3 className="text-2xl font-bold mb-6">🌍 Dastur tili</h3>
                <div className="space-y-4">
                  <button
                    onClick={() => changeLanguage('uz')}
                    className={`w-full py-5 rounded-2xl text-2xl font-bold transition-all ${
                      language === 'uz' 
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl scale-105' 
                        : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    🇺🇿 O‘zbekcha
                  </button>
                  <button
                    onClick={() => changeLanguage('ru')}
                    className={`w-full py-5 rounded-2xl text-2xl font-bold transition-all ${
                      language === 'ru' 
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl scale-105' 
                        : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    🇷🇺 Русский
                  </button>
                </div>
                <div className="mt-6 text-center text-sm text-gray-500">
                  Til darhol o'zgaradi va bazada saqlanadi
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
                <h3 className="text-2xl font-bold mb-6">🎨 Interfeys mavzusi</h3>
                <button
                  onClick={toggleDarkMode}
                  className={`w-full py-5 rounded-2xl text-2xl font-bold transition-all flex items-center justify-center gap-4 ${
                    darkMode 
                      ? 'bg-gray-900 text-yellow-400 hover:bg-gray-800' 
                      : 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
                  }`}
                >
                  {darkMode ? '🌚 Tungi rejim' : '☀️ Kunduzgi rejim'}
                </button>
                
                <div className="mt-6">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xl">🔔 Bildirishnomalar</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={notifications}
                        onChange={(e) => setNotifications(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`block w-14 h-8 rounded-full transition-colors ${
                        notifications ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                        notifications ? 'transform translate-x-6' : ''
                      }`}></div>
                    </div>
                  </label>
                </div>
                
                <div className="mt-6 text-center text-sm text-gray-500">
                  Mavzu va bildirishnomalar brauzeringizda saqlanadi
                </div>
              </div>
            </div>

            {/* Сохранение */}
            <div className="text-center">
              <button
                onClick={saveProfile}
                disabled={loading || !name.trim()}
                className={`px-16 py-6 text-white text-2xl font-black rounded-full shadow-2xl transition-all ${
                  loading || !name.trim()
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-blue-600 hover:scale-110 hover:shadow-3xl'
                }`}
              >
                {loading ? '⏳ Saqlanmoqda...' : '🚀 Barcha o‘zgarishlarni saqlash'}
              </button>
              
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                Tugmani bosganda: <br />
                1. Ismingiz tekshiriladi va bazaga yoziladi <br />
                2. Tanlangan til saqlanadi <br />
                3. Barcha ma'lumotlar yangilanadi
              </div>
            </div>

            {/* Информация о безопасности */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-3xl shadow-2xl p-8">
              <h3 className="text-3xl font-bold mb-6 text-yellow-600 dark:text-yellow-400 flex items-center gap-3">
                ⚠️ Diqqat! Taqiqlangan so'zlar
              </h3>
              <div className="space-y-4">
                <p className="text-lg">
                  Ismingizda quyidagi so'zlar ishlatilishi <strong>taqiqlanadi</strong>:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {forbiddenWords.slice(0, 12).map((word, index) => (
                    <div 
                      key={index} 
                      className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-center"
                    >
                      {word}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                  Agar ismingizda taqiqlangan so'z bo'lsa, profil saqlanmaydi va xabar beriladi.
                </p>
              </div>
            </div>

            {/* Аккаунт */}
            <div className="bg-red-50 dark:bg-red-900/30 rounded-3xl shadow-2xl p-8">
              <h3 className="text-3xl font-bold mb-6 text-red-600 dark:text-red-400">⚙️ Akkaunt boshqaruvi</h3>
              <div className="space-y-4">
                <button
                  onClick={logout}
                  className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-bold text-xl rounded-2xl transition-all hover:scale-105 flex items-center justify-center gap-3"
                >
                  <span>🚪</span>
                  <span>Hisobdan chiqish</span>
                </button>
                <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                  Chiqish qilganda, sizning ma'lumotlaringiz saqlanib qoladi va keyinroq qayta kira olasiz.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Подвал с информацией */}
        <div className="mt-12 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>© 2024 EduHelper. Barcha huquqlar himoyalangan.</p>
          <p className="mt-2">
            Profil ma'lumotlari: <strong>Supabase PostgreSQL</strong> bazasida xavfsiz saqlanadi.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;