// src/pages/Settings.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/ReactContext';
import { supabase } from '../../lib/supabase';

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { user, userData, logout } = useAuth();

  const [name, setName] = useState(userData?.full_name || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const currentLang = i18n.language;

  const changeLanguage = (lang) => {
    i18n.changeLanguage(lang);
    // Сохраняем в localStorage (уже делает detector, но на всякий)
  };

  const saveProfile = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: name })
        .eq('id', user.id);

      if (error) throw error;

      setMessage(t('success_saved'));
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-black dark:via-gray-900 dark:to-slate-900 py-12">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-5xl md:text-6xl font-black text-center mb-12 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          {t('settings')}
        </h1>

        <div className="grid gap-8">

          {/* Профиль */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
            <h2 className="text-3xl font-bold mb-6">{t('profile_settings')}</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-xl font-semibold mb-2">{t('name')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl border-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 text-xl"
                  placeholder="Ismingiz"
                />
              </div>

              <div>
                <label className="block text-xl font-semibold mb-2">{t('email')}</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-6 py-4 rounded-2xl bg-gray-100 dark:bg-gray-900 text-xl"
                />
              </div>

              <button
                onClick={saveProfile}
                disabled={loading}
                className="px-10 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xl rounded-full shadow-lg hover:scale-105 transition-all"
              >
                {loading ? t('loading') : t('save_changes')}
              </button>

              {message && (
                <p className="text-green-500 text-xl font-semibold text-center mt-4">{message}</p>
              )}
            </div>
          </div>

          {/* Язык */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
            <h2 className="text-3xl font-bold mb-6">{t('language')}</h2>
            <div className="grid grid-cols-2 gap-6 max-w-md">
              <button
                onClick={() => changeLanguage('uz')}
                className={`py-6 rounded-2xl text-2xl font-bold transition-all ${
                  currentLang === 'uz'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl scale-105'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white'
                }`}
              >
                🇺🇿 {t('uzbek')}
              </button>
              <button
                onClick={() => changeLanguage('ru')}
                className={`py-6 rounded-2xl text-2xl font-bold transition-all ${
                  currentLang === 'ru'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl scale-105'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white'
                }`}
              >
                🇷🇺 {t('russian')}
              </button>
            </div>
          </div>

          {/* Аккаунт */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
            <h2 className="text-3xl font-bold mb-6">{t('account')}</h2>
            <div className="space-y-4">
              <button
                onClick={logout}
                className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-bold text-xl rounded-2xl transition-all hover:scale-105"
              >
                {t('logout')}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Settings;