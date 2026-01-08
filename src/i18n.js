// src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Переводы (пока начнём с малого — всё для настроек + основные фразы)
const resources = {
  uz: {
    translation: {
      // Страница настроек
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

      // Общие
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
};

i18n
  .use(LanguageDetector) // определяет язык браузера
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'uz', // если не определён — узбекский
    interpolation: {
      escapeValue: false // React уже защищает от XSS
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    }
  });

export default i18n;