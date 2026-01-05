import React, { useState, useEffect, useRef } from 'react';
import { supabase, forumApi } from '../../lib/supabase';
import { Send, User, Clock, AlertCircle, Image as ImageIcon, Smile, Paperclip } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const ForumPage = () => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [isTyping, setIsTyping] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Получаем текущего пользователя и его профиль
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);

            if (user) {
                // Получаем профиль пользователя
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                setUserProfile(profile);

                // Обновляем онлайн статус
                await forumApi.updateOnlineStatus(user.id, true);
            }
        };

        getUser();

        // При размонтировании обновляем статус на оффлайн
        return () => {
            if (user) {
                forumApi.updateOnlineStatus(user.id, false);
            }
        };
    }, []);

// Подписка на новые сообщения
useEffect(() => {
    fetchMessages();
    fetchOnlineUsers();
    
    console.log('🔄 Настраиваем Real-time подписку...');
    
    // Канал для сообщений
    const messagesChannel = supabase
        .channel('forum-messages-realtime')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'forum_messages'
            },
            async (payload) => {
                console.log('📨 Новое сообщение (Real-time):', payload.new);
                
                try {
                    // Получаем профиль автора
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name, avatar_url, username')
                        .eq('id', payload.new.user_id)
                        .single();
                    
                    // Добавляем сообщение в список
                    setMessages(prev => [...prev, {
                        ...payload.new,
                        profiles: profile || {
                            full_name: 'Пользователь',
                            avatar_url: null,
                            username: null
                        }
                    }]);
                    
                    // Автопрокрутка
                    setTimeout(scrollToBottom, 100);
                } catch (error) {
                    console.error('Ошибка обработки сообщения:', error);
                }
            }
        )
        .subscribe((status) => {
            console.log('📡 Статус подписки на сообщения:', status);
        });
    
    // Канал для онлайн статуса
    const onlineChannel = supabase
        .channel('online-status-realtime')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles'
            },
            (payload) => {
                console.log('🔄 Изменение статуса пользователя:', payload.new);
                // Обновляем список онлайн пользователей
                fetchOnlineUsers();
            }
        )
        .subscribe((status) => {
            console.log('📡 Статус подписки на статусы:', status);
        });
    
    // Периодическое обновление на всякий случай
    const intervalId = setInterval(() => {
        console.log('⏰ Периодическое обновление сообщений...');
        fetchMessages();
        fetchOnlineUsers();
    }, 15000); // Каждые 15 секунд
    
    return () => {
        console.log('🧹 Очистка подписок...');
        supabase.removeChannel(messagesChannel);
        supabase.removeChannel(onlineChannel);
        clearInterval(intervalId);
    };
}, []);

    // Автопрокрутка к новым сообщениям
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchMessages = async () => {
        try {
            setLoading(true);
            const messages = await forumApi.getForumMessages();
            setMessages(messages);
        } catch (err) {
            console.error('Ошибка загрузки сообщений:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchOnlineUsers = async () => {
        try {
            const users = await forumApi.getOnlineUsers();
            setOnlineUsers(users);
        } catch (err) {
            console.error('Ошибка загрузки онлайн пользователей:', err);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() && !selectedImage) return;

        try {
            let imageUrl = null;

            // Если есть выбранное изображение, загружаем его
            if (selectedImage && typeof selectedImage !== 'string') {
                const file = await dataURLtoFile(selectedImage, `image_${Date.now()}.png`);
                imageUrl = await forumApi.uploadForumImage(file, user.id);
            } else if (selectedImage) {
                // Если это уже строка (base64 или URL)
                imageUrl = selectedImage;
            }

            // Отправляем сообщение
            await forumApi.sendMessage(newMessage, user.id, imageUrl);

            // Очищаем форму
            setNewMessage('');
            setSelectedImage(null);
            setShowEmojiPicker(false);
        } catch (err) {
            console.error('Ошибка отправки:', err);
            setError(err.message);
        }
    };

    // Функция для конвертации DataURL в File
    const dataURLtoFile = (dataurl, filename) => {
        return new Promise((resolve) => {
            const arr = dataurl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);

            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }

            resolve(new File([u8arr], filename, { type: mime }));
        });
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !user) return;

        try {
            // Проверяем тип файла
            if (!file.type.startsWith('image/')) {
                setError('Пожалуйста, выберите изображение');
                return;
            }

            // Проверяем размер (макс 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setError('Изображение слишком большое. Максимальный размер: 5MB');
                return;
            }

            // Создаем превью
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result);
            };
            reader.readAsDataURL(file);

        } catch (err) {
            console.error('Ошибка загрузки файла:', err);
            setError('Не удалось загрузить изображение');
        }
    };

    const handleEmojiClick = (emojiData) => {
        setNewMessage(prev => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    // Обработка набора текста
    const handleInputChange = (e) => {
        setNewMessage(e.target.value);

        // Сбрасываем таймер набора текста
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Устанавливаем новый таймер
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
        }, 1000);
    };

    // Получаем имя пользователя для отображения
    const getUserDisplayName = (message) => {
        if (message.profiles?.full_name) {
            return message.profiles.full_name;
        }
        if (message.profiles?.username) {
            return message.profiles.username;
        }
        if (userProfile && message.user_id === userProfile.id) {
            return userProfile.full_name || 'Вы';
        }
        return 'Аноним';
    };

    // Получаем аватар пользователя
    const getUserAvatar = (message) => {
        if (message.profiles?.avatar_url) {
            return message.profiles.avatar_url;
        }
        return null;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Заголовок */}
                <div className="mb-8 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-white mb-3">
                        Форум EdduHelper
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300">
                        Общайтесь с другими пользователями в реальном времени
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg flex items-center justify-between">
                        <div>
                            <AlertCircle className="inline w-5 h-5 mr-2" />
                            {error}
                        </div>
                        <button
                            onClick={() => setError(null)}
                            className="text-red-500 hover:text-red-700"
                        >
                            ×
                        </button>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Основной чат */}
                    <div className="flex-1">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
                            {/* Статус онлайн */}
                            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                                        <span>Онлайн: {onlineUsers.length} пользователей</span>
                                    </div>
                                    {isTyping && (
                                        <div className="text-sm italic flex items-center">
                                            <div className="flex space-x-1 mr-2">
                                                <div className="w-1 h-1 bg-white rounded-full animate-bounce"></div>
                                                <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                                <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                            </div>
                                            кто-то печатает...
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Сообщения */}
                            <div className="h-[500px] overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
                                {loading ? (
                                    <div className="flex justify-center items-center h-full">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                        <Send className="w-16 h-16 mb-4 opacity-50" />
                                        <p className="text-xl">Начните общение первым!</p>
                                        <p className="text-sm mt-2">Напишите сообщение и отправьте его</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {messages.map((message) => (
                                            <div
                                                key={message.id}
                                                className={`flex ${message.user_id === user?.id ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div
                                                    className={`max-w-[70%] rounded-2xl p-4 ${message.user_id === user?.id
                                                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-br-none'
                                                        : 'bg-white dark:bg-gray-700 rounded-bl-none'
                                                        } shadow-md`}
                                                >
                                                    {/* Заголовок сообщения */}
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="flex items-center gap-2">
                                                            {getUserAvatar(message) ? (
                                                                <img
                                                                    src={getUserAvatar(message)}
                                                                    alt={getUserDisplayName(message)}
                                                                    className="w-8 h-8 rounded-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex items-center justify-center text-white">
                                                                    <User className="w-5 h-5" />
                                                                </div>
                                                            )}
                                                            <span className="font-semibold">
                                                                {getUserDisplayName(message)}
                                                                {message.user_id === user?.id && ' (Вы)'}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs opacity-75">
                                                            <Clock className="inline w-3 h-3 mr-1" />
                                                            {format(new Date(message.created_at), 'HH:mm', { locale: ru })}
                                                        </span>
                                                    </div>

                                                    {/* Контент сообщения */}
                                                    {message.image_url && (
                                                        <div className="mb-2">
                                                            <img
                                                                src={message.image_url}
                                                                alt="Прикрепленное изображение"
                                                                className="rounded-lg max-w-full max-h-64 h-auto object-contain bg-gray-100 dark:bg-gray-800"
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                    e.target.parentElement.innerHTML =
                                                                        '<div class="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500">Изображение не загружено</div>';
                                                                }}
                                                            />
                                                        </div>
                                                    )}

                                                    {message.content && (
                                                        <p className={`break-words ${message.user_id === user?.id ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                                                            {message.content}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </div>

                            {/* Форма отправки сообщения */}
                            {user ? (
                                <form onSubmit={sendMessage} className="p-4 border-t dark:border-gray-700 relative">
                                    {selectedImage && (
                                        <div className="mb-3 relative">
                                            <img
                                                src={selectedImage}
                                                alt="Preview"
                                                className="rounded-lg max-h-32"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setSelectedImage(null)}
                                                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                                                aria-label="Удалить изображение"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2">
                                        {/* Кнопки действий */}
                                        <div className="flex gap-1">
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current.click()}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                                title="Добавить изображение"
                                                aria-label="Добавить изображение"
                                            >
                                                <ImageIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                                title="Добавить эмодзи"
                                                aria-label="Добавить эмодзи"
                                            >
                                                <Smile className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                            </button>
                                        </div>

                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleImageUpload}
                                            accept="image/*"
                                            className="hidden"
                                        />

                                        {/* Поле ввода */}
                                        <input
                                            type="text"
                                            value={newMessage}
                                            onChange={handleInputChange}
                                            placeholder="Напишите сообщение..."
                                            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                                        />

                                        {/* Кнопка отправки */}
                                        <button
                                            type="submit"
                                            disabled={!newMessage.trim() && !selectedImage}
                                            className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
                                            aria-label="Отправить сообщение"
                                        >
                                            <Send className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {/* Emoji Picker */}
                                    {showEmojiPicker && (
                                        <div className="absolute bottom-20 left-4 z-50">
                                            <EmojiPicker
                                                onEmojiClick={handleEmojiClick}
                                                previewConfig={{
                                                    showPreview: false
                                                }}
                                            />
                                        </div>
                                    )}
                                </form>
                            ) : (
                                <div className="p-4 text-center border-t dark:border-gray-700">
                                    <p className="text-gray-600 dark:text-gray-300">
                                        <a href="/login" className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                                            Войдите
                                        </a> в систему, чтобы отправлять сообщения
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Сайдбар с пользователями */}
                    <div className="lg:w-80">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
                            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
                                Сейчас онлайн
                            </h3>

                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {onlineUsers.length === 0 ? (
                                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                                        Нет пользователей онлайн
                                    </p>
                                ) : (
                                    onlineUsers.map((onlineUser) => (
                                        <div
                                            key={onlineUser.id}
                                            className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                        >
                                            <div className="relative">
                                                {onlineUser.avatar_url ? (
                                                    <img
                                                        src={onlineUser.avatar_url}
                                                        alt={onlineUser.full_name}
                                                        className="w-10 h-10 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-400 to-blue-400 flex items-center justify-center text-white">
                                                        <User className="w-5 h-5" />
                                                    </div>
                                                )}
                                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-800 dark:text-white truncate">
                                                    {onlineUser.full_name || onlineUser.email?.split('@')[0] || 'Пользователь'}
                                                    {onlineUser.id === user?.id && ' (Вы)'}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    был(а) {format(new Date(onlineUser.last_seen), 'HH:mm', { locale: ru })}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Статистика */}
                            <div className="mt-8 pt-6 border-t dark:border-gray-700">
                                <h4 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                                    Статистика чата
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl">
                                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                            {messages.length}
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                            Сообщений
                                        </p>
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-xl">
                                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                            {onlineUsers.length}
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                            Онлайн
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Кнопка обновления */}
                            <button
                                onClick={() => {
                                    fetchMessages();
                                    fetchOnlineUsers();
                                }}
                                className="w-full mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Обновить
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForumPage;