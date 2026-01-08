// src/Pages/Settings.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/ReactContext';
import { supabase } from '../../lib/supabase';
import premiumManager from '../../Utils/premiumManager';
import saveIcon from '../../Pages/Settings/save_icon.png';

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

    // Список запрещенных слов и имен
    const forbiddenWords = [
        'admin', 'administrator', 'moderator', 'support', 'system', 'root', 'superuser',
        'eduhelper', 'edu helper', 'eduhelper admin', 'admin eduhelper',
        'ehelper', 'education helper', 'курс', 'course', 'обучение',
        'am', 'kot', 'ko\'t', 'qotoq', 'qo\'toq', 'jalab', 'foxisha',
        'сука', 'блядь', 'пизда', 'хуй', 'ебать', 'пидор', 'гандон',
        'jinni', 'jallob', 'ahmoq', 'tentak', 'gelak', 'gandon',
        'shaitan', 'iblis', 'jin', 'dev', 'шайтан', 'ибис',
        'sex', 'porn', 'xxx', 'onlyfans', 'порно', 'секс', 'шлюха',
        'prostitute', 'hooker', 'escort', 'проститутка', 'курва',
        'fuck', 'shit', 'bitch', 'asshole', 'dick', 'cock',
        'hack', 'hacker', 'cracker', 'взлом', 'взломщик',
        'scam', 'fraud', 'мошенник', 'аферист',
        'drug', 'наркотик', 'наркоман', 'алкоголь',
        'kofir', 'kofr', 'язычник', 'еретик', 'blasphemy',
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
                        .select('preferred_language, full_name, avatar_url, username')
                        .eq('id', user.id)
                        .single();

                    if (!error && profileData) {
                        // Устанавливаем язык
                        const savedLanguage = profileData.preferred_language ||
                            localStorage.getItem('preferred_language') ||
                            'uz';
                        i18n.changeLanguage(savedLanguage);
                        setLanguage(savedLanguage);

                        // Устанавливаем имя
                        const displayName = profileData.full_name || user.email;
                        setName(displayName);

                        // Устанавливаем аватар
                        if (profileData.avatar_url) {
                            setAvatar(profileData.avatar_url);
                        }
                    }
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

    // Проверка имени на запрещенные слова
    const validateName = (name) => {
        if (!name || name.trim().length < 2) {
            return { valid: false, message: t('min_chars') };
        }

        if (name.length > 50) {
            return { valid: false, message: t('name_too_long') || 'Name must not exceed 50 characters' };
        }

        const nameLower = name.toLowerCase();

        // Проверка на запрещенные слова
        for (const word of forbiddenWords) {
            if (nameLower.includes(word.toLowerCase())) {
                return {
                    valid: false,
                    message: t('name_contains_forbidden', { word: word }) ||
                        `Name contains forbidden word "${word}". Please choose another name.`
                };
            }
        }

        // Проверка на специальные символы
        const validCharsRegex = /^[a-zA-Zа-яА-ЯёЁўЎғҒқҚҳҲөӨүҮ0-9\s\-']+$/;
        if (!validCharsRegex.test(name)) {
            return {
                valid: false,
                message: t('invalid_name_chars') || 'Name can only contain letters, numbers, spaces and hyphens'
            };
        }

        // Проверка на повторяющиеся пробелы
        if (/\s{2,}/.test(name)) {
            return { valid: false, message: t('no_double_spaces') || 'Name cannot contain consecutive spaces' };
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
                    .update({
                        preferred_language: lang,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', user.id);

                // Сохраняем в localStorage как резервную копию
                localStorage.setItem('preferred_language', lang);
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
            setMessage(t('photo_too_large'));
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        // Проверка типа файла
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setMessage(t('invalid_photo_format'));
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        setLoading(true);
        setMessage(t('photo_uploading'));

        try {
            // Создаем превью для пользователя
            const reader = new FileReader();
            reader.onload = (e) => {
                setAvatar(e.target.result);
            };
            reader.readAsDataURL(file);

            // Удаляем старый аватар если он существует в storage
            if (avatar && avatar.includes('supabase.co/storage/v1/object/public/avatars/')) {
                try {
                    const oldFileName = avatar.split('/').pop();
                    await supabase.storage
                        .from('avatars')
                        .remove([`${user.id}/${oldFileName}`]);
                } catch (deleteError) {
                    console.warn('Старый аватар не удален:', deleteError);
                }
            }

            // Создаем уникальное имя файла
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}/${Date.now()}.${fileExt}`;

            // Загружаем в Supabase Storage
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

            setMessage(t('photo_uploaded'));

            setTimeout(() => {
                setMessage(t('profile_updated'));
                setTimeout(() => setMessage(''), 5000);
            }, 1000);

        } catch (err) {
            console.error('Ошибка загрузки аватара:', err);
            setMessage(t('photo_upload_error'));

            // Если нет storage, пробуем сохранить как base64
            try {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64Avatar = e.target.result;
                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            avatar_url: base64Avatar,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', user.id);

                    if (!error) {
                        setMessage(t('photo_uploaded_base64'));
                    }
                };
                reader.readAsDataURL(file);
            } catch (fallbackError) {
                console.error('Fallback error:', fallbackError);
            }
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
        setMessage(t('saving'));

        try {
            // Генерируем username из имени
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
                setMessage(t('profile_saved'));

                // Показываем подробности обновления
                setTimeout(() => {
                    setMessage(t('all_data_saved'));
                    setTimeout(() => setMessage(''), 5000);
                }, 1000);
            }

        } catch (err) {
            console.error('Ошибка сохранения профиля:', err);
            setMessage(t('save_error') + ': ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 5000);
        }
    };

    // Функция удаления аватара
    const handleRemoveAvatar = async () => {
        if (!window.confirm(t('confirm_delete_avatar'))) return;

        setLoading(true);
        try {
            // Удаляем из storage
            if (avatar.includes('supabase.co/storage/v1/object/public/avatars/')) {
                const fileName = avatar.split('/').pop();
                await supabase.storage
                    .from('avatars')
                    .remove([`${user.id}/${fileName}`]);
            }

            // Обновляем профиль
            await supabase
                .from('profiles')
                .update({
                    avatar_url: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id);

            // Очищаем локальное состояние
            setAvatar('');
            setMessage(t('avatar_deleted'));
        } catch (err) {
            setMessage(t('delete_error'));
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-purple-100 dark:from-black dark:via-gray-900 dark:to-purple-900 py-12 px-4">
            <div className="max-w-5xl mx-auto">

                {/* Приветствие */}
                <div className="text-center mb-12">
                    <h1 className="text-6xl md:text-7xl font-black mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                        {t('settings')}
                    </h1>
                    <p className="text-2xl text-gray-700 dark:text-gray-300">
                        {t('welcome_message')} <span className="font-bold text-purple-600 dark:text-yellow-400">{name || user?.email}</span> 👨‍✈️
                    </p>
                    <p className="text-lg mt-2 opacity-80">{t('personal_control_panel')}</p>
                </div>

                {/* Сообщения */}
                {message && (
                    <div className={`text-center p-4 rounded-2xl mb-6 text-xl font-bold ${message.includes('❌') || message.includes('Xatolik') || message.toLowerCase().includes('error') || message.toLowerCase().includes('taqiqlangan')
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        }`}>
                        {message}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Левая колонка: Аватар */}
                    <div className="space-y-8">
                        {/* Аватар */}
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 text-center">
                            <div className="w-40 h-40 mx-auto rounded-full overflow-hidden border-4 border-purple-500 shadow-xl mb-6 relative group">
                                <img
                                    src={avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=6366f1&color=fff&size=256`}
                                    alt={t('avatar')}
                                    className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="bg-white text-black px-4 py-2 rounded-full font-bold hover:bg-gray-100 transition"
                                    >
                                        📷 {t('change')}
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
                                {loading ? t('photo_uploading') : `🖼️ ${t('change_photo')}`}
                            </button>

                            {avatar && avatar.includes('supabase.co') && (
                                <button
                                    onClick={handleRemoveAvatar}
                                    className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full text-sm font-bold transition"
                                >
                                    🗑️ {t('delete_avatar')}
                                </button>
                            )}

                            {premiumStatus && (
                                <div className="mt-6 text-2xl animate-pulse">⭐ {t('premium')}</div>
                            )}

                            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                                {t('photo_size_limit')}
                                <br />
                                {t('photo_formats')}
                            </div>
                        </div>
                    </div>

                    {/* Центральная колонка: Основные настройки */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Профиль */}
                        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
                            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                                👤 {t('profile_settings')}
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xl font-semibold mb-2">
                                        {t('full_name')}
                                        <span className="text-sm text-gray-500 ml-2">({t('required')})</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-6 py-4 rounded-2xl border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:border-purple-500 text-xl"
                                        placeholder={t('example_name')}
                                    />
                                    <div className="mt-2 text-sm text-gray-500">
                                        {t('min_chars')} {t('forbidden_words_info')}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xl font-semibold mb-2">{t('email_address')}</label>
                                    <input
                                        type="email"
                                        value={user?.email || ''}
                                        disabled
                                        className="w-full px-6 py-4 rounded-2xl bg-gray-100 dark:bg-gray-900 text-xl cursor-not-allowed"
                                    />
                                    <div className="mt-2 text-sm text-gray-500">
                                        {t('contact_support_email')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Язык и тема */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
                                <h3 className="text-2xl font-bold mb-6">🌍 {t('app_language')}</h3>
                                <div className="space-y-4">
                                    <button
                                        onClick={() => changeLanguage('uz')}
                                        className={`w-full py-5 rounded-2xl text-2xl font-bold transition-all ${language === 'uz'
                                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl scale-105'
                                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                                            }`}
                                    >
                                        🇺🇿 {t('uzbek')}
                                    </button>
                                    <button
                                        onClick={() => changeLanguage('ru')}
                                        className={`w-full py-5 rounded-2xl text-2xl font-bold transition-all ${language === 'ru'
                                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl scale-105'
                                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                                            }`}
                                    >
                                        🇷🇺 {t('russian')}
                                    </button>
                                    <button
                                        onClick={() => changeLanguage('en')}
                                        className={`w-full py-5 rounded-2xl text-2xl font-bold transition-all ${language === 'en'
                                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl scale-105'
                                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                                            }`}
                                    >
                                        EN {t('english')}
                                    </button>
                                </div>
                                <div className="mt-6 text-center text-sm text-gray-500">
                                    {t('language_changes_instantly')}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8">
                                <h3 className="text-2xl font-bold mb-6">🎨 {t('interface_theme')}</h3>
                                <button
                                    onClick={toggleDarkMode}
                                    className={`w-full py-5 rounded-2xl text-2xl font-bold transition-all flex items-center justify-center gap-4 ${darkMode
                                            ? 'bg-gray-900 text-yellow-400 hover:bg-gray-800'
                                            : 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
                                        }`}
                                >
                                    {darkMode ? `🌚 ${t('night_mode')}` : `☀️ ${t('day_mode')}`}
                                </button>

                                <div className="mt-6">
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <span className="text-xl">🔔 {t('notifications')}</span>
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                checked={notifications}
                                                onChange={(e) => setNotifications(e.target.checked)}
                                                className="sr-only"
                                            />
                                            <div className={`block w-14 h-8 rounded-full transition-colors ${notifications ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                                                }`}></div>
                                            <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${notifications ? 'transform translate-x-6' : ''
                                                }`}></div>
                                        </div>
                                    </label>
                                </div>

                                <div className="mt-6 text-center text-sm text-gray-500">
                                    {t('theme_saved_browser')}
                                </div>
                            </div>
                        </div>

                        {/* Сохранение */}
                        <div className="text-center">
                            <button
                                onClick={saveProfile}
                                disabled={loading || !name.trim()}
                                className={`px-16 py-6 text-white text-2xl font-black rounded-full shadow-2xl transition-all ${loading || !name.trim()
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-green-500 to-blue-600 hover:scale-110 hover:shadow-3xl'
                                    }`}
                            >
                                {loading ? `⏳ ${t('loading')}` : (
                                    <>
                                        <img src={saveIcon} alt="save" className="w-6 h-6 inline-block mr-2" />
                                        {t('save_all_changes')}
                                    </>
                                )}
                            </button>

                            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                                {t('save_button_info')} <br />
                                1. {t('save_step1')} <br />
                                2. {t('save_step2')} <br />
                                3. {t('save_step3')}
                            </div>
                        </div>

                        {/* Аккаунт */}
                        <div className="bg-red-50 dark:bg-red-900/30 rounded-3xl shadow-2xl p-8">
                            <h3 className="text-3xl font-bold mb-6 text-red-600 dark:text-red-400">
                                ⚙️ {t('account_management')}
                            </h3>
                            <div className="space-y-4">
                                <button
                                    onClick={logout}
                                    className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-bold text-xl rounded-2xl transition-all hover:scale-105 flex items-center justify-center gap-3"
                                >
                                    <span>🚪</span>
                                    <span>{t('logout_button')}</span>
                                </button>
                                <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                                    {t('logout_info')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Подвал с информацией */}
                <div className="mt-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                    <p>{t('copyright')}</p>
                </div>
            </div>
        </div>
    );
};

export default Settings;