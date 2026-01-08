// src/Pages/Settings.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/ReactContext';
import { supabase } from '../../lib/supabase';
import premiumManager from '../../Utils/premiumManager';

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { user, userData, logout } = useAuth();

  const [name, setName] = useState(userData?.full_name || '');
  const [avatar, setAvatar] = useState(userData?.avatar_url || '');
  const [language, setLanguage] = useState(i18n.language);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [premiumStatus, setPremiumStatus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Загружаем премиум и настройки
  useEffect(() => {
    const loadSettings = async () => {
      if (user?.id) {
        const status = await premiumManager.checkPremiumStatus(user.id);
        setPremiumStatus(!!status?.is_active);

        // Если в профиле сохранён язык — берём оттуда
        if (userData?.preferred_language) {
          i18n.changeLanguage(userData.preferred_language);
          setLanguage(userData.preferred_language);
        }
      }

      // Тёмная тема из localStorage или системы
      const savedDark = localStorage.getItem('darkMode') === 'true';
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(savedDark || systemDark);
      if (savedDark || systemDark) document.documentElement.classList.add('dark');
    };
    loadSettings();
  }, [user, userData, i18n]);

  const changeLanguage = async (lang) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    // Сохраняем в профиль
    if (user?.id) {
      await supabase.from('profiles').update({ preferred_language: lang }).eq('id', user.id);
    }
  };

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

  const saveProfile = async () => {
    setLoading(true);
    try {
      const updates = {
        full_name: name,
        preferred_language: language,
      };
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
      setMessage(t('success_saved') || 'Saqlandi!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Xatolik!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-purple-100 dark:from-black dark:via-gray-900 dark:to-purple-900 py-12 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Приветствие как в кабине пилота */}
        <div className="text-center mb-12">
          <h1 className="text-6xl md:text-7xl font-black mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            {t('settings') || 'Sozlamalar'}
          </h1>
          <p className="text-2xl text-gray-700 dark:text-gray-300">
            Salom, <span className="font-bold text-purple-600 dark:text-yellow-400">{name || user?.email}</span> 👨‍✈️
          </p>
          <p className="text-lg mt-2 opacity-80">Sizning shaxsiy boshqaruv panelingiz</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Левая колонка: Аватар + Статистика */}
          <div className="space-y-8">
            {/* Аватар */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 text-center">
              <div className="w-40 h-40 mx-auto rounded-full overflow-hidden border-4 border-purple-500 shadow-xl mb-6">
                <img
                  src={avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=6366f1&color=fff&size=256`}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-bold hover:scale-105 transition">
                Rasmni o‘zgartirish
              </button>
              {premiumStatus && (
                <div className="mt-6 text-2xl">⭐ PREMIUM</div>
              )}
            </div>

            {/* Статистика */}
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl shadow-2xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-6 text-center">📊 Progress</h3>
              <div className="space-y-4 text-xl">
                <div className="flex justify-between"><span>O‘rganilgan kurslar</span> <b>12</b></div>
                <div className="flex justify-between"><span>Bajarilgan darslar</span> <b>156</b></div>
                <div className="flex justify-between"><span>Muvaffaqiyat</span> <b className="text-yellow-300">94%</b></div>
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
                  <label className="block text-xl font-semibold mb-2">{t('name') || 'Ism'}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:border-purple-500 text-xl"
                  />
                </div>
                <div>
                  <label className="block text-xl font-semibold mb-2">Email</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-6 py-4 rounded-2xl bg-gray-100 dark:bg-gray-900 text-xl"
                  />
                </div>
              </div>
            </div>

            {/* Язык и тема */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
                <h3 className="text-2xl font-bold mb-6">🌍 Til</h3>
                <div className="space-y-4">
                  <button
                    onClick={() => changeLanguage('uz')}
                    className={`w-full py-5 rounded-2xl text-2xl font-bold transition-all ${language === 'uz' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl' : 'bg-gray-200 dark:bg-gray-700'}`}
                  >
                    🇺🇿 O‘zbekcha
                  </button>
                  <button
                    onClick={() => changeLanguage('ru')}
                    className={`w-full py-5 rounded-2xl text-2xl font-bold transition-all ${language === 'ru' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl' : 'bg-gray-200 dark:bg-gray-700'}`}
                  >
                    🇷🇺 Русский
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
                <h3 className="text-2xl font-bold mb-6">🌙 Tema</h3>
                <button
                  onClick={toggleDarkMode}
                  className={`w-full py-5 rounded-2xl text-2xl font-bold transition-all flex items-center justify-center gap-4 ${darkMode ? 'bg-gray-900 text-yellow-400' : 'bg-yellow-400 text-gray-900'}`}
                >
                  {darkMode ? '🌚 Tungi rejim' : '☀️ Kunduzgi rejim'}
                </button>
                <div className="mt-6 text-center text-lg opacity-80">
                  {notifications ? '🔔 Bildirishnomalar yoqilgan' : '🔕 Bildirishnomalar o‘chirilgan'}
                </div>
              </div>
            </div>

            {/* Сохранение */}
            <div className="text-center">
              <button
                onClick={saveProfile}
                disabled={loading}
                className="px-16 py-6 bg-gradient-to-r from-green-500 to-blue-600 text-white text-2xl font-black rounded-full shadow-2xl hover:scale-110 transition-all"
              >
                {loading ? 'Saqlanmoqda...' : '🚀 O‘zgarishlarni saqlash'}
              </button>
              {message && <p className="mt-6 text-2xl font-bold text-green-500">{message}</p>}
            </div>

            {/* Аккаунт */}
            <div className="bg-red-50 dark:bg-red-900/30 rounded-3xl shadow-2xl p-8">
              <h3 className="text-3xl font-bold mb-6 text-red-600 dark:text-red-400">⚙️ Akkaunt</h3>
              <div className="space-y-4">
                <button
                  onClick={logout}
                  className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-bold text-xl rounded-2xl transition-all hover:scale-105"
                >
                  🚪 Chiqish
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;