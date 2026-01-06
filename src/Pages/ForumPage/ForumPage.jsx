import React, { useState, useEffect, useRef } from 'react';
import { supabase, forumApi } from '../../lib/supabase';
import {
  Send, User, Clock, MoreVertical, Paperclip, Smile,
  ThumbsUp, Heart, Laugh, Sad, Angry,
  Reply, Trash2, CheckCheck, X
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

const ForumPage = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showReactionsPicker, setShowReactionsPicker] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Получение текущего пользователя
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setUserProfile(profile);
        await forumApi.updateOnlineStatus(user.id, true);
      }
    };
    getUser();

    return () => {
      if (user) forumApi.updateOnlineStatus(user.id, false);
    };
  }, []);

  // Загрузка начальных сообщений
  useEffect(() => {
    const initChat = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('forum_messages')
          .select(`
            *,
            profiles:user_id (full_name, avatar_url, username),
            reactions (
              id, user_id, reaction_type,
              profiles:user_id (full_name)
            ),
            reply_to:reply_to_id (
              id, content, image_url,
              profiles:user_id (full_name, username)
            )
          `)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        setMessages(data.reverse());
        fetchOnlineUsers();
      } catch (err) {
        console.error('Ошибка загрузки сообщений:', err);
      } finally {
        setLoading(false);
        setTimeout(scrollToBottom, 100);
      }
    };
    initChat();
  }, []);

  // Real-time подписки
  useEffect(() => {
    const messagesChannel = supabase
      .channel('forum-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_messages' }, async (payload) => {
        const newMsg = payload.new;
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, username')
          .eq('id', newMsg.user_id)
          .single();

        setMessages(prev => [...prev, {
          ...newMsg,
          profiles: profile || { full_name: 'Пользователь', avatar_url: null, username: null },
          reactions: [],
          reply_to: null
        }]);

        if (isScrolledToBottom) scrollToBottom();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, (payload) => {
        setMessages(prev => prev.map(msg =>
          msg.id === payload.new.message_id
            ? { ...msg, reactions: [...(msg.reactions || []), payload.new] }
            : msg
        ));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, (payload) => {
        setMessages(prev => prev.map(msg =>
          msg.id === payload.old.message_id
            ? { ...msg, reactions: (msg.reactions || []).filter(r => r.id !== payload.old.id) }
            : msg
        ));
      })
      .subscribe();

    const onlineChannel = supabase
      .channel('online-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'is_online=eq.true' }, () => {
        fetchOnlineUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(onlineChannel);
    };
  }, [isScrolledToBottom]);

  // Скролл и подгрузка старых сообщений
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 100;
      setIsScrolledToBottom(isBottom);

      if (scrollTop < 100 && hasMoreMessages && !loadingMore) {
        loadMoreMessages();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMoreMessages, loadingMore]);

  const loadMoreMessages = async () => {
    if (messages.length === 0 || loadingMore) return;
    try {
      setLoadingMore(true);
      const firstMessage = messages[0];
      const { data, error } = await supabase
        .from('forum_messages')
        .select(`
          *,
          profiles:user_id (full_name, avatar_url, username),
          reactions (*),
          reply_to:reply_to_id (id, content, image_url, profiles:user_id (full_name, username))
        `)
        .lt('created_at', firstMessage.created_at)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      if (data.length > 0) {
        const reversed = data.reverse();
        setMessages(prev => [...reversed, ...prev]);
        setHasMoreMessages(data.length === 30);
      } else {
        setHasMoreMessages(false);
      }
    } catch (err) {
      console.error('Ошибка подгрузки:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchOnlineUsers = async () => {
    try {
      const users = await forumApi.getOnlineUsers();
      setOnlineUsers(users);
    } catch (err) {
      console.error('Ошибка онлайн:', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsScrolledToBottom(true);
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

      const replyToId = replyingTo ? replyingTo.id : null;
      await forumApi.sendMessage(newMessage.trim(), user.id, imageUrl, replyToId);

      setNewMessage('');
      setSelectedImage(null);
      setReplyingTo(null);
      setShowEmojiPicker(false);
      scrollToBottom();
    } catch (err) {
      console.error('Ошибка отправки:', err);
      alert('Хабар жўнатишда хатолик');
    }
  };

  const addReaction = async (messageId, type) => {
    try {
      await forumApi.addReaction(messageId, user.id, type);
    } catch (err) {
      console.error('Реакция ошибка:', err);
    }
  };

  const removeReaction = async (reactionId) => {
    try {
      await forumApi.removeReaction(reactionId);
    } catch (err) {
      console.error('Удаление реакции:', err);
    }
  };

  const deleteMessage = async (messageId) => {
    if (!confirm('Хабарни ўчиришни хоҳлайсизми?')) return;
    try {
      await forumApi.deleteMessage(messageId);
    } catch (err) {
      console.error('Удаление сообщения:', err);
    }
  };

  const dataURLtoFile = (dataurl, filename) => {
    return new Promise((resolve) => {
      const arr = dataurl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      resolve(new File([u8arr], filename, { type: mime }));
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Фақат расм танланг');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Расм ҳажми 5MB дан ошмаслиги керак');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setSelectedImage(reader.result);
    reader.readAsDataURL(file);
  };

  const handleEmojiClick = (emojiData) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const formatMessageTime = (date) => format(new Date(date), 'HH:mm');
  const formatDateHeader = (date) => {
    const d = new Date(date);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Бугун';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Кеча';
    return format(d, 'd MMMM yyyy', { locale: ru });
  };

  const groupMessagesByDate = () => {
    const groups = [];
    let currentDate = null;
    let currentGroup = [];

    messages.forEach((msg, i) => {
      const dateStr = formatDateHeader(msg.created_at);
      if (dateStr !== currentDate) {
        if (currentGroup.length > 0) groups.push({ date: currentDate, messages: currentGroup });
        currentDate = dateStr;
        currentGroup = [msg];
      } else {
        currentGroup.push(msg);
      }
      if (i === messages.length - 1) groups.push({ date: currentDate, messages: currentGroup });
    });
    return groups;
  };

  const ReactionButton = ({ message, type, icon: Icon, color }) => {
    const userReaction = message.reactions?.find(r => r.user_id === user?.id && r.reaction_type === type);
    const count = message.reactions?.filter(r => r.reaction_type === type).length || 0;
    if (count === 0 && !userReaction) return null;

    return (
      <button
        onClick={() => userReaction ? removeReaction(userReaction.id) : addReaction(message.id, type)}
        className={`px-2 py-1 rounded-full flex items-center gap-1 text-xs transition-colors ${
          userReaction ? 'bg-blue-500/30 text-blue-300' : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
        }`}
      >
        <Icon size={14} style={{ color }} />
        {count > 0 && <span>{count}</span>}
      </button>
    );
  };

  const MessageItem = ({ message, isOwn }) => {
    const [showActions, setShowActions] = useState(false);

    return (
      <div
        className={`flex gap-3 my-3 ${isOwn ? 'flex-row-reverse' : ''}`}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {!isOwn && (
          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
            {message.profiles?.avatar_url ? (
              <img src={message.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-600 flex items-center justify-center">
                <User size={20} className="text-gray-400" />
              </div>
            )}
          </div>
        )}

        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-lg`}>
          {message.reply_to && (
            <div className="bg-gray-700/50 rounded-lg p-2 mb-2 text-sm">
              <div className="font-medium text-gray-300">
                {message.reply_to.profiles?.full_name || message.reply_to.profiles?.username || 'Номаълум'}
              </div>
              <div className="text-gray-400 truncate">
                {message.reply_to.content || 'Расм'}
              </div>
            </div>
          )}

          {message.image_url && (
            <img
              src={message.image_url}
              alt="attachment"
              className="max-w-sm rounded-lg mb-2"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentNode.innerHTML += '<div class="text-red-400 text-sm">Расм юкланмади</div>';
              }}
            />
          )}

          {message.content && (
            <div className={`px-4 py-2 rounded-2xl ${isOwn ? 'bg-blue-600' : 'bg-gray-700'}`}>
              {message.content}
            </div>
          )}

          <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
            {formatMessageTime(message.created_at)}
            {isOwn && <CheckCheck size={14} className="text-blue-300" />}
          </div>

          <div className="flex items-center gap-1 mt-2 flex-wrap">
            <ReactionButton message={message} type="like" icon={ThumbsUp} color="#3b82f6" />
            <ReactionButton message={message} type="heart" icon={Heart} color="#ef4444" />
            <ReactionButton message={message} type="laugh" icon={Laugh} color="#f59e0b" />
            <ReactionButton message={message} type="sad" icon={Sad} color="#8b5cf6" />
            <ReactionButton message={message} type="angry" icon={Angry} color="#dc2626" />

            {showActions && (
              <>
                <button
                  onClick={() => { setReplyingTo(message); inputRef.current?.focus(); }}
                  className="p-1.5 bg-gray-700 rounded-full hover:bg-gray-600"
                >
                  <Reply size={14} />
                </button>
                {isOwn && (
                  <button
                    onClick={() => deleteMessage(message.id)}
                    className="p-1.5 bg-red-900/50 rounded-full hover:bg-red-800/50"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Шапка */}
      <div className="border-b border-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Users size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold">EdduHelper Форуми</h1>
            <p className="text-sm text-gray-400">{onlineUsers.length} онлайн</p>
          </div>
        </div>
      </div>

      {/* Сообщения */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-6">
        {loading ? (
          <div className="text-center text-gray-400">Юкланмоқда...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-2xl mb-4">Биринчи бўлиб ёзинг!</p>
            <p>Хабар ёзиб, жўнатинг</p>
          </div>
        ) : (
          <>
            {loadingMore && <div className="text-center text-gray-500 py-2">Эски хабарлар юкланмоқда...</div>}
            {groupMessagesByDate().map((group) => (
              <div key={group.date} className="mb-8">
                <div className="text-center text-xs text-gray-500 mb-4 relative">
                  <span className="bg-gray-900 px-3 py-1 rounded-full">{group.date}</span>
                </div>
                {group.messages.map((msg) => (
                  <MessageItem key={msg.id} message={msg} isOwn={msg.user_id === user?.id} />
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Панель ответа */}
      {replyingTo && (
        <div className="mx-4 mb-2 bg-gray-800 rounded-lg p-3 flex justify-between items-center">
          <div className="text-sm">
            <span className="text-blue-400">Жавоб:</span>{' '}
            {replyingTo.content ? replyingTo.content.substring(0, 50) + (replyingTo.content.length > 50 ? '...' : '') : 'Расм'}
          </div>
          <button onClick={() => setReplyingTo(null)}>
            <X size={18} className="text-gray-400 hover:text-white" />
          </button>
        </div>
      )}

      {/* Превью изображения */}
      {selectedImage && (
        <div className="mx-4 mb-2 relative">
          <img src={selectedImage} alt="preview" className="max-h-64 rounded-lg" />
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-2 right-2 bg-red-600 rounded-full p-2 hover:bg-red-700"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Поле ввода */}
      <form onSubmit={sendMessage} className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 bg-gray-800 rounded-full px-4 py-3">
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-white">
            <Paperclip size={22} />
          </button>

          <input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Хабарингизни ёзинг..."
            className="flex-1 bg-transparent outline-none text-white placeholder-gray-500"
          />

          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="text-gray-400 hover:text-white"
          >
            <Smile size={22} />
          </button>

          <button type="submit" className="text-blue-400 hover:text-blue-300">
            <Send size={22} />
          </button>
        </div>

        {showEmojiPicker && (
          <div className="absolute bottom-20 right-4 z-10">
            <EmojiPicker onEmojiClick={handleEmojiClick} theme="dark" />
          </div>
        )}
      </form>

      {/* Кнопка прокрутки вниз */}
      {!isScrolledToBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-24 right-6 bg-blue-600 rounded-full p-3 shadow-lg hover:bg-blue-700"
        >
          <Send size={18} className="rotate-180" />
        </button>
      )}
    </div>
  );
};

export default ForumPage;