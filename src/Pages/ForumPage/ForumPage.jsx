import React, { useState, useEffect, useRef } from 'react';
import { supabase, forumApi } from '../../lib/supabase';
import { 
  Send, User, Clock, MoreVertical, Search, Volume2, Users,
  Paperclip, Smile, ThumbsUp, Heart, Laugh, Sad, Angry, 
  Reply, Edit, Delete, CheckCheck, X
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { format, formatDistanceToNow } from 'date-fns';
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
    const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
    const [replyingTo, setReplyingTo] = useState(null);
    const [showReactionsPicker, setShowReactionsPicker] = useState(null);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const inputRef = useRef(null);

    // Получаем текущего пользователя и его профиль
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
            if (user) {
                forumApi.updateOnlineStatus(user.id, false);
            }
        };
    }, []);

    // Инициализация чата
    useEffect(() => {
        const initChat = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('forum_messages')
                    .select(`
                        *,
                        profiles:user_id (
                            full_name,
                            avatar_url,
                            username
                        ),
                        reactions (
                            id,
                            user_id,
                            reaction_type,
                            profiles:user_id (
                                full_name
                            )
                        )
                    `)
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (error) throw error;
                setMessages(data.reverse());
                fetchOnlineUsers();
            } catch (err) {
                console.error('Ошибка загрузки сообщений:', err);
                setError(err.message);
            } finally {
                setLoading(false);
                setTimeout(() => {
                    scrollToBottom();
                }, 100);
            }
        };
        initChat();
    }, []);

    // Real-time подписка
    useEffect(() => {
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
                    try {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('full_name, avatar_url, username')
                            .eq('id', payload.new.user_id)
                            .single();
                        
                        setMessages(prev => [...prev, {
                            ...payload.new,
                            profiles: profile || {
                                full_name: 'Пользователь',
                                avatar_url: null,
                                username: null
                            },
                            reactions: []
                        }]);
                        
                        if (isScrolledToBottom) {
                            setTimeout(() => {
                                scrollToBottom();
                            }, 50);
                        }
                    } catch (error) {
                        console.error('Ошибка обработки сообщения:', error);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'message_reactions'
                },
                async (payload) => {
                    setMessages(prev => prev.map(msg => 
                        msg.id === payload.new.message_id 
                            ? { ...msg, reactions: [...(msg.reactions || []), payload.new] }
                            : msg
                    ));
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'message_reactions'
                },
                async (payload) => {
                    setMessages(prev => prev.map(msg => 
                        msg.id === payload.old.message_id 
                            ? { 
                                ...msg, 
                                reactions: (msg.reactions || []).filter(r => r.id !== payload.old.id) 
                            }
                            : msg
                    ));
                }
            )
            .subscribe();

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
                    fetchOnlineUsers();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(messagesChannel);
            supabase.removeChannel(onlineChannel);
        };
    }, [isScrolledToBottom]);

    // Обработка скролла
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
                    profiles:user_id (
                        full_name,
                        avatar_url,
                        username
                    ),
                    reactions (
                        id,
                        user_id,
                        reaction_type,
                        profiles:user_id (
                            full_name
                        )
                    )
                `)
                .lt('created_at', firstMessage.created_at)
                .order('created_at', { ascending: false })
                .limit(30);
            
            if (error) throw error;
            
            if (data.length > 0) {
                const reversedData = data.reverse();
                setMessages(prev => [...reversedData, ...prev]);
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

            const replyToId = replyingTo ? replyingTo.id : null;
            await forumApi.sendMessage(newMessage, user.id, imageUrl, replyToId);
            
            setNewMessage('');
            setSelectedImage(null);
            setReplyingTo(null);
            setShowEmojiPicker(false);
            scrollToBottom();
        } catch (err) {
            console.error('Ошибка отправки:', err);
            setError('Хабарни жўнатишда хатолик');
        }
    };

    const addReaction = async (messageId, reactionType) => {
        try {
            await forumApi.addReaction(messageId, user.id, reactionType);
        } catch (err) {
            console.error('Ошибка добавления реакции:', err);
        }
    };

    const removeReaction = async (reactionId) => {
        try {
            await forumApi.removeReaction(reactionId);
        } catch (err) {
            console.error('Ошибка удаления реакции:', err);
        }
    };

    const deleteMessage = async (messageId) => {
        if (!confirm('Хабарингизни ўчиришни истайсизми?')) return;
        
        try {
            await forumApi.deleteMessage(messageId);
        } catch (err) {
            console.error('Ошибка удаления сообщения:', err);
            setError('Хабарни ўчириб бўлмади');
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
        setIsScrolledToBottom(true);
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
                inputRef.current?.focus();
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
        inputRef.current?.focus();
    };

    const formatMessageTime = (date) => {
        return format(new Date(date), 'HH:mm');
    };

    const formatDateHeader = (date) => {
        const messageDate = new Date(date);
        const today = new Date();
        
        if (messageDate.toDateString() === today.toDateString()) {
            return 'Бугун';
        }
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (messageDate.toDateString() === yesterday.toDateString()) {
            return 'Кеча';
        }
        
        return format(messageDate, 'd MMMM yyyy', { locale: ru });
    };

    const groupMessagesByDate = () => {
        const groups = [];
        let currentDate = null;
        let currentGroup = [];

        messages.forEach((message, index) => {
            const messageDate = formatDateHeader(message.created_at);
            
            if (messageDate !== currentDate) {
                if (currentGroup.length > 0) {
                    groups.push({ date: currentDate, messages: currentGroup });
                }
                currentDate = messageDate;
                currentGroup = [message];
            } else {
                currentGroup.push(message);
            }
            
            if (index === messages.length - 1) {
                groups.push({ date: currentDate, messages: currentGroup });
            }
        });

        return groups;
    };

    const ReactionButton = ({ message, type, icon: Icon, color }) => {
        const userReaction = message.reactions?.find(r => r.user_id === user?.id && r.reaction_type === type);
        const count = message.reactions?.filter(r => r.reaction_type === type).length || 0;
        
        if (count === 0 && !userReaction) return null;

        return (
            <button
                onClick={() => userReaction 
                    ? removeReaction(userReaction.id) 
                    : addReaction(message.id, type)
                }
                className={`px-2 py-1 rounded-full flex items-center gap-1 text-xs ${userReaction 
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                }`}
            >
                <Icon className="w-3 h-3" style={{ color }} />
                {count > 0 && <span>{count}</span>}
            </button>
        );
    };

    const MessageItem = ({ message, isOwn }) => {
        const [showActions, setShowActions] = useState(false);
        const userReaction = message.reactions?.find(r => r.user_id === user?.id);

        return (
            <div 
                className={`group relative flex ${isOwn ? 'justify-end' : 'justify-start'} px-4 py-1 hover:bg-black/5 dark:hover:bg-white/5`}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
            >
                {!isOwn && (
                    <div className="mr-3 mt-1">
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                            {message.profiles?.avatar_url ? (
                                <img
                                    src={message.profiles.avatar_url}
                                    alt={message.profiles.full_name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                                    <User className="w-4 h-4 text-white" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className={`max-w-[70%] ${isOwn ? 'order-1' : 'order-2'}`}>
                    {!isOwn && (
                        <div className="flex items-center gap-2 mb-1 px-2">
                            <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
                                {message.profiles?.full_name || message.profiles?.username || 'Номаълум'}
                            </span>
                            <span className="text-xs text-gray-500">
                                {formatMessageTime(message.created_at)}
                            </span>
                        </div>
                    )}

                    <div className="relative">
                        {message.reply_to && (
                            <div className="mb-2 px-3 py-2 bg-gray-800/50 rounded-lg border-l-2 border-blue-500">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full overflow-hidden">
                                        {message.reply_to.profiles?.avatar_url ? (
                                            <img
                                                src={message.reply_to.profiles.avatar_url}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                                                <User className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-sm font-medium text-gray-300">
                                        {message.reply_to.profiles?.full_name || message.reply_to.profiles?.username || 'Номаълум'}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-400 mt-1 line-clamp-1">
                                    {message.reply_to.content || 'Расм'}
                                </p>
                            </div>
                        )}

                        <div className={`rounded-2xl px-4 py-2 ${isOwn 
                            ? 'bg-blue-500 text-white rounded-br-md' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md'
                        }`}>
                            {message.image_url && (
                                <div className="mb-2 -mx-2">
                                    <img
                                        src={message.image_url}
                                        alt="Илова килинган расм"
                                        className="rounded-lg max-w-full max-h-96 object-contain"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.parentElement.innerHTML = 
                                                '<div class="p-4 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400">Расм юкланмади</div>';
                                        }}
                                    />
                                </div>
                            )}

                            {message.content && (
                                <p className="whitespace-pre-wrap break-words">
                                    {message.content}
                                </p>
                            )}

                            <div className={`flex items-center justify-between mt-2 ${isOwn ? 'text-blue-200' : 'text-gray-500'}`}>
                                <span className="text-xs">
                                    {formatMessageTime(message.created_at)}
                                </span>
                                {isOwn && (
                                    <div className="flex items-center gap-1">
                                        <CheckCheck className="w-3 h-3" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Реакции */}
                        {(message.reactions?.length > 0 || showActions) && (
                            <div className={`flex flex-wrap gap-1 mt-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                <ReactionButton message={message} type="like" icon={ThumbsUp} color="#3b82f6" />
                                <ReactionButton message={message} type="heart" icon={Heart} color="#ef4444" />
                                <ReactionButton message={message} type="laugh" icon={Laugh} color="#f59e0b" />
                                <ReactionButton message={message} type="sad" icon={Sad} color="#8b5cf6" />
                                <ReactionButton message={message} type="angry" icon={Angry} color="#dc2626" />
                                
                                {showActions && !userReaction && (
                                    <button
                                        onClick={() => setShowReactionsPicker(showReactionsPicker === message.id ? null : message.id)}
                                        className="px-2 py-1 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded-full text-xs"
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                        )}

                        {showReactionsPicker === message.id && (
                            <div className="absolute top-full left-0 mt-2 bg-gray-800 rounded-full shadow-xl p-1 flex gap-1 z-50">
                                {[
                                    { type: 'like', icon: ThumbsUp, color: '#3b82f6' },
                                    { type: 'heart', icon: Heart, color: '#ef4444' },
                                    { type: 'laugh', icon: Laugh, color: '#f59e0b' },
                                    { type: 'sad', icon: Sad, color: '#8b5cf6' },
                                    { type: 'angry', icon: Angry, color: '#dc2626' }
                                ].map(({ type, icon: Icon, color }) => (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            addReaction(message.id, type);
                                            setShowReactionsPicker(null);
                                        }}
                                        className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                                    >
                                        <Icon className="w-4 h-4" style={{ color }} />
                                    </button>
                                ))}
                            </div>
                        )}

                        {showActions && (
                            <div className={`absolute top-1/2 transform -translate-y-1/2 flex items-center gap-1 ${isOwn 
                                ? '-left-14 flex-row-reverse' 
                                : '-right-14'
                            }`}>
                                <button 
                                    onClick={() => {
                                        setReplyingTo(message);
                                        inputRef.current?.focus();
                                    }}
                                    className="p-1.5 bg-gray-800 rounded-full shadow-lg hover:bg-gray-700"
                                >
                                    <Reply className="w-4 h-4 text-gray-300" />
                                </button>
                                {isOwn && (
                                    <button 
                                        onClick={() => deleteMessage(message.id)}
                                        className="p-1.5 bg-gray-800 rounded-full shadow-lg hover:bg-red-500/20"
                                    >
                                        <Delete className="w-4 h-4 text-gray-300" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {isOwn && (
                    <div className="ml-3 mt-1 order-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="h-screen bg-gray-900 flex flex-col">
            {/* Шапка чата */}
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button className="p-2 rounded-full hover:bg-gray-700 lg:hidden">
                        <Users className="w-5 h-5 text-gray-300" />
                    </button>
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full overflow-hidden">
                            {onlineUsers[0]?.avatar_url ? (
                                <img
                                    src={onlineUsers[0].avatar_url}
                                    alt="Группа"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-white" />
                                </div>
                            )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800"></div>
                    </div>
                    <div>
                        <h1 className="font-semibold text-white">EdduHelper Форуми</h1>
                        <p className="text-xs text-gray-400">
                            {onlineUsers.length} фойдаланувчи онлайн
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button className="p-2 rounded-full hover:bg-gray-700">
                        <Search className="w-5 h-5 text-gray-300" />
                    </button>
                    <button className="p-2 rounded-full hover:bg-gray-700">
                        <Volume2 className="w-5 h-5 text-gray-300" />
                    </button>
                </div>
            </div>

            {/* Основное содержимое */}
            <div className="flex flex-1 overflow-hidden">
                {/* Боковая панель (скрыта на мобильных) */}
                <div className="hidden lg:block w-80 border-r border-gray-700 bg-gray-800 overflow-y-auto">
                    <div className="p-4">
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-gray-300">Ҳозир онлайн</h3>
                                <span className="text-xs text-gray-500">{onlineUsers.length}</span>
                            </div>
                            <div className="space-y-2">
                                {onlineUsers.map((onlineUser) => (
                                    <div
                                        key={onlineUser.id}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700"
                                    >
                                        <div className="relative">
                                            <div className="w-10 h-10 rounded-full overflow-hidden">
                                                {onlineUser.avatar_url ? (
                                                    <img
                                                        src={onlineUser.avatar_url}
                                                        alt={onlineUser.full_name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                                                        <User className="w-5 h-5 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">
                                                {onlineUser.full_name || onlineUser.email?.split('@')[0]}
                                                {onlineUser.id === user?.id && ' (Сиз)'}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {formatDistanceToNow(new Date(onlineUser.last_seen), { 
                                                    locale: ru,
                                                    addSuffix: true 
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Область сообщений */}
                <div className="flex-1 flex flex-col">
                    {/* Сообщения */}
                    <div 
                        ref={messagesContainerRef}
                        className="flex-1 overflow-y-auto bg-gray-900"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%239C92AC' fill-opacity='0.05' fill-rule='evenodd'/%3E%3C/svg%3E")`
                        }}
                    >
                        {loading ? (
                            <div className="flex justify-center items-center h-full">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                <Send className="w-16 h-16 mb-4 opacity-50" />
                                <p className="text-xl text-gray-400">Биринчи бўлиб ёзинг!</p>
                                <p className="text-sm mt-2 text-gray-500">Хабар ёзиб, жўнатинг</p>
                            </div>
                        ) : (
                            <>
                                {loadingMore && (
                                    <div className="flex justify-center py-4">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                                    </div>
                                )}

                                {groupMessagesByDate().map((group, groupIndex) => (
                                    <div key={groupIndex}>
                                        <div className="sticky top-2 z-10 flex justify-center my-4">
                                            <div className="bg-gray-700/90 backdrop-blur-sm text-gray-300 text-xs px-3 py-1.5 rounded-full">
                                                {group.date}
                                            </div>
                                        </div>
                                        {group.messages.map((message) => (
                                            <MessageItem
                                                key={message.id}
                                                message={message}
                                                isOwn={message.user_id === user?.id}
                                            />
                                        ))}
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </>
                        )}
                    </div>

                    {/* Панель ответа */}
                    {replyingTo && (
                        <div className="border-t border-gray-700 bg-gray-800 px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Reply className="w-4 h-4 text-blue-400" />
                                <div className="text-sm">
                                    <span className="text-gray-300">
                                        {replyingTo.profiles?.full_name || replyingTo.profiles?.username || 'Номаълум'}
                                    </span>
                                    <span className="text-gray-400 ml-2">
                                        {replyingTo.content ? 
                                            (replyingTo.content.length > 50 ? 
                                                replyingTo.content.substring(0, 50) + '...' : 
                                                replyingTo.content
                                            ) : 
                                            'Расм'
                                        }
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setReplyingTo(null)}
                                className="p-1 hover:bg-gray-700 rounded-full"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>
                    )}

                    {/* Панель ввода сообщения */}
                    <div className="border-t border-gray-700 bg-gray-800">
                        {selectedImage && (
                            <div className="px-4 pt-3">
                                <div className="relative inline-block">
                                    <img
                                        src={selectedImage}
                                        alt="Кўриб чиқиш"
                                        className="rounded-lg max-h-32"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setSelectedImage(null)}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        )}

                        <form onSubmit={sendMessage} className="p-4 relative">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current.click()}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
                                >
                                    <Paperclip className="w-5 h-5" />
                                </button>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageUpload}
                                    accept="image/*"
                                    className="hidden"
                                />

                                <div className="flex-1 relative">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Хабарингизни ёзинг..."
                                        className="w-full px-4 py-3 bg-gray-700 text-white rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                                        onFocus={() => setShowEmojiPicker(false)}
                                    />
                                    
                                    <button
                                        type="button"
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                                    >
                                        <Smile className="w-5 h-5" />
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() && !selectedImage}
                                    className={`p-3 rounded-full transition-colors shadow-lg ${newMessage.trim() || selectedImage
                                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                    }`}
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>

                            {showEmojiPicker && (
                                <div className="absolute bottom-20 left-4 z-50">
                                    <div className="relative">
                                        <EmojiPicker
                                            onEmojiClick={handleEmojiClick}
                                            previewConfig={{ showPreview: false }}
                                            skinTonesDisabled
                                            searchDisabled={false}
                                        />
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            </div>

            {/* Кнопка прокрутки вниз */}
            {!isScrolledToBottom && (
                <button
                    onClick={scrollToBottom}
                    className="fixed bottom-24 right-4 p-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors z-50"
                >
                    <Send className="w-5 h-5 rotate-45" />
                </button>
            )}
        </div>
    );
};

export default ForumPage;