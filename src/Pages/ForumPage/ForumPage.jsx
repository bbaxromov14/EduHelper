import React, { useState, useEffect, useRef } from 'react';
import { supabase, forumApi, videoStorage } from '../../lib/supabase';
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
  const [typingUsers, setTypingUsers] = useState([]);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

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
        await supabase
          .from('profiles')
          .update({ 
            is_online: true,
            last_seen: new Date().toISOString()
          })
          .eq('id', user.id);
      }
    };
    
    getUser();
    
    // При размонтировании обновляем статус на оффлайн
    return () => {
      if (user) {
        supabase
          .from('profiles')
          .update({ 
            is_online: false,
            last_seen: new Date().toISOString()
          })
          .eq('id', user.id);
      }
    };
  }, []);

  // Загружаем сообщения и подписываемся на обновления
  useEffect(() => {
    fetchMessages();

    // Подписка на новые сообщения
    const channel = supabase
      .channel('forum_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'forum_messages'
        },
        async (payload) => {
          const newMessage = payload.new;
          
          // Получаем профиль пользователя для нового сообщения
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', newMessage.user_id)
            .single();
          
          setMessages(prev => [...prev, {
            ...newMessage,
            profiles: profile
          }]);
        }
      )
      .subscribe();

    // Загружаем онлайн пользователей
    fetchOnlineUsers();

    // Подписка на изменения статуса онлайн
    const onlineChannel = supabase
      .channel('online_status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          fetchOnlineUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(onlineChannel);
    };
  }, []);

  // Автопрокрутка к новым сообщениям
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const data = await forumApi.getForumMessages();
      setMessages(data);
    } catch (err) {
      console.error('Ошибка загрузки сообщений:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOnlineUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, is_online, last_seen')
        .eq('is_online', true)
        .order('last_seen', { ascending: false })
        .limit(20);

      if (error) throw error;
      setOnlineUsers(data || []);
    } catch (err) {
      console.error('Ошибка загрузки онлайн пользователей:', err);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      // Если есть изображение - загружаем его
      let imageUrl = selectedImage;
      
      // Если это base64 изображение (превью), загружаем в Storage
      if (selectedImage && selectedImage.startsWith('data:image')) {
        // Создаем файл из base64
        const file = await fetch(selectedImage)
          .then(res => res.blob())
          .then(blob => {
            return new File([blob], `forum_${Date.now()}.jpg`, { type: 'image/jpeg' });
          });
        
        // Загружаем в Storage
        imageUrl = await videoStorage.uploadForumImage(file, user.id);
      }

      // Отправляем сообщение
      await forumApi.sendMessage(newMessage, user.id, imageUrl);
      
      // Очищаем форму
      setNewMessage('');
      setSelectedImage(null);
      setShowEmojiPicker(false);
    } catch (err) {
      console.error('Ошибка отправки сообщения:', err);
      setError(err.message);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

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
  };

  const handleEmojiClick = (emojiData) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
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
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg">
            <AlertCircle className="inline w-5 h-5 mr-2" />
            {error}
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
                  {typingUsers.length > 0 && (
                    <div className="text-sm italic">
                      {typingUsers.join(', ')} печатает...
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
                          className={`max-w-[70%] rounded-2xl p-4 ${
                            message.user_id === user?.id
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-br-none'
                              : 'bg-white dark:bg-gray-700 rounded-bl-none'
                          } shadow-md`}
                        >
                          {/* Заголовок сообщения */}
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex items-center justify-center text-white">
                                <User className="w-5 h-5" />
                              </div>
                              <span className="font-semibold">
                                {getUserDisplayName(message)}
                              </span>
                            </div>
                            <span className="text-xs opacity-75">
                              <Clock className="inline w-3 h-3 mr-1" />
                              {format(new Date(message.created_at), 'HH:mm', { locale: ru })}
                            </span>
                          </div>

                          {/* Контент сообщения */}
                          {message.type === 'image' && message.image_url ? (
                            <div className="mb-2">
                              <img
                                src={message.image_url}
                                alt="Прикрепленное изображение"
                                className="rounded-lg max-w-full max-h-64 h-auto object-contain"
                              />
                            </div>
                          ) : null}
                          
                          <p className={`break-words ${message.user_id === user?.id ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
                            {message.content}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Форма отправки сообщения */}
              {user ? (
                <form onSubmit={sendMessage} className="p-4 border-t dark:border-gray-700">
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
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Напишите сообщение..."
                      className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />

                    {/* Кнопка отправки */}
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
                      aria-label="Отправить сообщение"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Emoji Picker */}
                  {showEmojiPicker && (
                    <div className="absolute bottom-20 left-4 z-50">
                      <EmojiPicker onEmojiClick={handleEmojiClick} />
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
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-400 to-blue-400 flex items-center justify-center text-white">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 dark:text-white truncate">
                          {onlineUser.full_name || onlineUser.email?.split('@')[0] || 'Пользователь'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          онлайн
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
                className="w-full mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
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