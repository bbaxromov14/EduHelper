import React, { useState, useEffect, useRef } from 'react';
import { supabase, forumApi } from '../../lib/supabase';
import { Send, User, Clock, AlertCircle, Image as ImageIcon, Smile } from 'lucide-react';
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
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const messagesContainerRef = useRef(null);

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

        return () => {
            if (user) {
                forumApi.updateOnlineStatus(user.id, false);
            }
        };
    }, []);

    // Инициализация чата - загрузка последних 50 сообщений
    useEffect(() => {
        const initChat = async () => {
            try {
                setLoading(true);
                
                // Загружаем последние 50 сообщений
                const { data, error } = await supabase
                    .from('forum_messages')
                    .select(`
                        *,
                        profiles:user_id (
                            full_name,
                            avatar_url,
                            username
                        )
                    `)
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (error) throw error;
                
                // Переворачиваем массив, чтобы старые были сверху
                setMessages(data.reverse());
                
                // Загружаем онлайн пользователей
                fetchOnlineUsers();
            } catch (err) {
                console.error('Ошибка загрузки сообщений:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        initChat();
    }, []);

    // Real-time подписка на новые сообщения
    useEffect(() => {
        console.log('🔄 Подключаемся к Real-time...');
        
        // Канал для новых сообщений
        const messagesChannel = supabase
            .channel('forum-messages-telegram')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'forum_messages'
                },
                async (payload) => {
                    console.log('📨 Новое сообщение в реальном времени:', payload.new);
                    
                    try {
                        // Получаем профиль автора
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('full_name, avatar_url, username')
                            .eq('id', payload.new.user_id)
                            .single();
                        
                        // Добавляем сообщение в конец
                        setMessages(prev => [...prev, {
                            ...payload.new,
                            profiles: profile || {
                                full_name: 'Пользователь',
                                avatar_url: null,
                                username: null
                            }
                        }]);
                        
                        // Плавная прокрутка к новому сообщению
                        setTimeout(() => {
                            messagesEndRef.current?.scrollIntoView({ 
                                behavior: 'smooth',
                                block: 'end'
                            });
                        }, 100);
                    } catch (error) {
                        console.error('Ошибка обработки сообщения:', error);
                    }
                }
            )
            .subscribe((status) => {
                console.log('📡 Статус Real-time:', status);
            });
        
        // Канал для онлайн статуса
        const onlineChannel = supabase
            .channel('online-status-telegram')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: 'is_online=eq.true'
                },
                (payload) => {
                    console.log('🔄 Обновление онлайн статуса');
                    fetchOnlineUsers();
                }
            )
            .subscribe();
        
        // Фоновая проверка раз в 2 минуты (только для подстраховки)
        const backgroundCheck = setInterval(() => {
            fetchOnlineUsers();
        }, 120000);
        
        return () => {
            console.log('🧹 Отключаем Real-time...');
            supabase.removeChannel(messagesChannel);
            supabase.removeChannel(onlineChannel);
            clearInterval(backgroundCheck);
        };
    }, []);

    // Загрузка истории сообщений (как в Telegram)
    const loadMoreMessages = async () => {
        if (messages.length === 0 || loadingMore) return;
        
        try {
            setLoadingMore(true);
            
            const firstMessage = messages[0];
            
            // Загружаем 30 сообщений раньше первого
            const { data, error } = await supabase
                .from('forum_messages')
                .select(`
                    *,
                    profiles:user_id (
                        full_name,
                        avatar_url,
                        username
                    )
                `)
                .lt('created_at', firstMessage.created_at)
                .order('created_at', { ascending: false })
                .limit(30);
            
            if (error) throw error;
            
            if (data.length > 0) {
                // Переворачиваем и добавляем в начало
                const reversedData = data.reverse();
                setMessages(prev => [...reversedData, ...prev]);
                
                // Проверяем, есть ли еще сообщения
                setHasMoreMessages(data.length === 30);
            } else {
                setHasMoreMessages(false);
            }
        } catch (err) {
            console.error('Ошибка загрузки истории:', err);
        } finally {
            setLoadingMore(false);
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

            if (selectedImage && typeof selectedImage !== 'string') {
                const file = await dataURLtoFile(selectedImage, `image_${Date.now()}.png`);
                imageUrl = await forumApi.uploadForumImage(file, user.id);
            } else if (selectedImage) {
                imageUrl = selectedImage;
            }

            await forumApi.sendMessage(newMessage, user.id, imageUrl);
            
            setNewMessage('');
            setSelectedImage(null);
            setShowEmojiPicker(false);
        } catch (err) {
            console.error('Ошибка отправки:', err);
            setError('Хабарни жўнатишда хатолик');
        }
    };

    const dataURLtoFile = (dataurl, filename) => {
        return new Promise((resolve) => {
            const arr = dataurl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            
            while(n--) {
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
            if (!file.type.startsWith('image/')) {
                setError('Илтимос, расм танланг');
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                setError('Расм жуда катта. Максимал хажми: 5MB');
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result);
            };
            reader.readAsDataURL(file);

        } catch (err) {
            console.error('Файл юклашда хатолик:', err);
            setError('Расмни юклаб бўлмади');
        }
    };

    const handleEmojiClick = (emojiData) => {
        setNewMessage(prev => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    const getUserDisplayName = (message) => {
        if (message.profiles?.full_name) {
            return message.profiles.full_name;
        }
        if (message.profiles?.username) {
            return message.profiles.username;
        }
        if (userProfile && message.user_id === userProfile.id) {
            return userProfile.full_name || 'Сиз';
        }
        return 'Номаълум';
    };

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
                        EdduHelper Форуми
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300">
                        Фойдаланувчилар билан жонли мулокот
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
                                        <span>Онлайн: {onlineUsers.length} фойдаланувчи</span>
                                    </div>
                                </div>
                            </div>

                            {/* Сообщения */}
                            <div 
                                ref={messagesContainerRef}
                                className="h-[500px] overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900"
                            >
                                {loading ? (
                                    <div className="flex justify-center items-center h-full">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                        <Send className="w-16 h-16 mb-4 opacity-50" />
                                        <p className="text-xl">Биринчи бўлиб ёзинг!</p>
                                        <p className="text-sm mt-2">Хабар ёзиб, жўнатинг</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Кнопка загрузки истории */}
                                        {hasMoreMessages && (
                                            <div className="text-center py-4">
                                                <button
                                                    onClick={loadMoreMessages}
                                                    disabled={loadingMore}
                                                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {loadingMore ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                                            Юкланмоқда...
                                                        </div>
                                                    ) : '⬇ Олдинги хабарлар'}
                                                </button>
                                            </div>
                                        )}

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
                                                                    {message.user_id === user?.id && ' (Сиз)'}
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
                                                                    alt="Илова килинган расм"
                                                                    className="rounded-lg max-w-full max-h-64 h-auto object-contain bg-gray-100 dark:bg-gray-800"
                                                                    onError={(e) => {
                                                                        e.target.style.display = 'none';
                                                                        e.target.parentElement.innerHTML =
                                                                            '<div class="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500">Расм юкланмади</div>';
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
                                    </>
                                )}
                            </div>

                            {/* Форма отправки сообщения */}
                            {user ? (
                                <form onSubmit={sendMessage} className="p-4 border-t dark:border-gray-700 relative">
                                    {selectedImage && (
                                        <div className="mb-3 relative">
                                            <img
                                                src={selectedImage}
                                                alt="Кўриб чиқиш"
                                                className="rounded-lg max-h-32"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setSelectedImage(null)}
                                                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                                                aria-label="Расмни ўчириш"
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
                                                title="Расм қўшиш"
                                                aria-label="Расм қўшиш"
                                            >
                                                <ImageIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                                title="Эмоджи қўшиш"
                                                aria-label="Эмоджи қўшиш"
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
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder="Хабарингизни ёзинг..."
                                            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                                        />

                                        {/* Кнопка отправки */}
                                        <button
                                            type="submit"
                                            disabled={!newMessage.trim() && !selectedImage}
                                            className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
                                            aria-label="Хабарни жўнатиш"
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
                                            Тизимга киринг
                                        </a> хабар жўнатиш учун
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Сайдбар с пользователями */}
                    <div className="lg:w-80">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
                            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
                                Ҳозир онлайн
                            </h3>

                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {onlineUsers.length === 0 ? (
                                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                                        Онлайн фойдаланувчилар йўқ
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
                                                    {onlineUser.full_name || onlineUser.email?.split('@')[0] || 'Фойдаланувчи'}
                                                    {onlineUser.id === user?.id && ' (Сиз)'}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {format(new Date(onlineUser.last_seen), 'HH:mm', { locale: ru })}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Статистика (упрощенная) */}
                            <div className="mt-8 pt-6 border-t dark:border-gray-700">
                                <h4 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                                    Статистика
                                </h4>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-xl">
                                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                            {onlineUsers.length}
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                            Онлайн фойдаланувчи
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForumPage;