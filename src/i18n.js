// src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { supabase } from './lib/supabase';

// Загружаем переводы из Supabase
const loadTranslationsFromSupabase = async () => {
  try {
    const { data: translations, error } = await supabase
      .from('translations')
      .select('key, uz, ru, en');
    
    if (error) throw error;
    
    // Преобразуем в формат i18next
    const resources = {
      uz: { translation: {} },
      ru: { translation: {} },
      en: { translation: {} }
    };
    
    translations.forEach(trans => {
      if (trans.uz) resources.uz.translation[trans.key] = trans.uz;
      if (trans.ru) resources.ru.translation[trans.key] = trans.ru;
      if (trans.en) resources.en.translation[trans.key] = trans.en;
    });
    
    return resources;
  } catch (error) {
    console.error('Ошибка загрузки переводов:', error);
    // Fallback на локальные переводы
    return getFallbackResources();
  }
};

// Локальные переводы для fallback
const getFallbackResources = () => ({
  uz: {
    translation: {
      "settings": "Sozlamalar",
      "profile_settings": "Profil sozlamalari",
      "name": "Ism",
      "email": "Email",
      "language": "Til",
      "uzbek": "O‘zbekcha",
      "russian": "Русский",
      "notifications": "Bildirishnomalar",
      "dark_mode": "Tungi rejim",
      "save_changes": "O‘zgarishlarni saqlash",
      "account": "Akkaunt",
      "logout": "Chiqish",
      "delete_account": "Akkauntni o‘chirish",
      "loading": "Yuklanmoqda...",
      "success_saved": "Sozlamalar muvaffaqiyatli saqlandi!",
    }
  },
  ru: {
    translation: {
      "settings": "Настройки",
      "profile_settings": "Настройки профиля",
      "name": "Имя",
      "email": "Email",
      "language": "Язык",
      "uzbek": "O‘zbekcha",
      "russian": "Русский",
      "notifications": "Уведомления",
      "dark_mode": "Тёмная тема",
      "save_changes": "Сохранить изменения",
      "account": "Аккаунт",
      "logout": "Выйти",
      "delete_account": "Удалить аккаунт",
      "loading": "Загрузка...",
      "success_saved": "Настройки успешно сохранены!",
    }
  }
});

// Инициализация i18next с динамической загрузкой переводов
const initI18n = async () => {
  const resources = await loadTranslationsFromSupabase();
  
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'uz',
      lng: localStorage.getItem('preferred_language') || 'uz',
      interpolation: {
        escapeValue: false
      },
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        caches: ['localStorage'],
        lookupLocalStorage: 'preferred_language'
      },
      react: {
        useSuspense: false // Отключаем Suspense для совместимости
      }
    });
};

// Запускаем инициализацию
initI18n();

export default i18n;