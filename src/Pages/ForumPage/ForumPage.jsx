import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Получаем текущего пользователя
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  // Подписываемся на сообщения в реальном времени
  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel('forum_messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'forum_messages'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => [...prev, payload.new]);
          }
        }
      )
      .subscribe();

    // Подписываемся на статус онлайн
    const presenceChannel = supabase.channel('online_users', {
      config: {
        presence: {
          key: user?.id
        }
      }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users = Object.values(state).map(presence => presence[0]);
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user?.id,
            user_name: user?.email?.split('@')[0],
            online_at: new Date().toISOString()
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, [user]);

  // Автопрокрутка к новым сообщениям
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('forum_messages')
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from('forum_messages')
        .insert([
          {
            content: newMessage,
            user_id: user.id,
            image_url: selectedImage,
            type: selectedImage ? 'image' : 'text'
          }
        ])
        .select()
        .single();

      if (error) throw error;
      
      setNewMessage('');
      setSelectedImage(null);
      setShowEmojiPicker(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Здесь должна быть логика загрузки в Supabase Storage
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
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-full text-red-500">
                    <AlertCircle className="w-12 h-12 mb-2" />
                    <p>Ошибка загрузки сообщений</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Send className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-xl">Начните общение первым!</p>
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
                                {message.profiles?.username || 'Аноним'}
                              </span>
                            </div>
                            <span className="text-xs opacity-75">
                              <Clock className="inline w-3 h-3 mr-1" />
                              {format(new Date(message.created_at), 'HH:mm', { locale: ru })}
                            </span>
                          </div>

                          {/* Контент сообщения */}
                          {message.type === 'image' && message.image_url ? (
                            <img
                              src={message.image_url}
                              alt="Прикрепленное изображение"
                              className="rounded-lg max-w-full h-auto mb-2"
                            />
                          ) : null}
                          
                          <p className={`${message.user_id === user?.id ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
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
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
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
                      title="Прикрепить файл"
                    >
                      <Paperclip className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                      title="Добавить эмодзи"
                    >
                      <Smile className="w-5 h-5 text-gray-600 dark:text-gray-gray-300" />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current.click()}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                      title="Добавить изображение"
                    >
                      <ImageIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
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
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                  />

                  {/* Кнопка отправки */}
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
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
            </div>
          </div>

          {/* Сайдбар с пользователями */}
          <div className="lg:w-80">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
                Сейчас онлайн
              </h3>
              
              <div className="space-y-3">
                {onlineUsers.map((onlineUser, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-400 to-blue-400 flex items-center justify-center text-white">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white">
                        {onlineUser.user_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        онлайн
                      </p>
                    </div>
                  </div>
                ))}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForumPage;