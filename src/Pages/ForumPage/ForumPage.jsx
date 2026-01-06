import React, { useState, useEffect, useRef } from 'react';
import { supabase, forumApi } from '../../lib/supabase';
import {
    Send, User, Clock, AlertCircle, Image as ImageIcon,
    Smile, MoreVertical, Search, Pin, Volume2, Users,
    Paperclip, Mic, ThumbsUp, Reply, Edit, Delete,
    Check, CheckCheck, MoreHorizontal, LogOut, Heart,
    X, MessageCircle, Eye
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { format, formatDistanceToNow } from 'date-fns';
import { NavLink } from 'react-router-dom';

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
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showOnlineUsers, setShowOnlineUsers] = useState(false);
    const [replyTo, setReplyTo] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [messageReactions, setMessageReactions] = useState({});

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
                        replies:forum_messages!parent_id (
                            id,
                            content,
                            created_at,
                            profiles:user_id (
                                full_name,
                                avatar_url
                            )
                        ),
                        reactions:message_reactions (
                            id,
                            reaction,
                            user_id,
                            profiles:user_id (
                                full_name,
                                avatar_url
                            )
                        )
                    `)
                    .is('parent_id', null)
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (error) throw error;
                
                // Формируем объект реакций
                const reactionsObj = {};
                data.forEach(msg => {
                    reactionsObj[msg.id] = msg.reactions || [];
                });
                setMessageReactions(reactionsObj);
                
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
                        // Загружаем полные данные нового сообщения
                        const { data: message } = await supabase
                            .from('forum_messages')
                            .select(`
                                *,
                                profiles:user_id (
                                    full_name,
                                    avatar_url,
                                    username
                                ),
                                replies:forum_messages!parent_id (
                                    id,
                                    content,
                                    created_at,
                                    profiles:user_id (
                                        full_name,
                                        avatar_url
                                    )
                                ),
                                reactions:message_reactions (
                                    id,
                                    reaction,
                                    user_id,
                                    profiles:user_id (
                                        full_name,
                                        avatar_url
                                    )
                                )
                            `)
                            .eq('id', payload.new.id)
                            .single();

                        if (message) {
                            // Если это ответ на существующее сообщение
                            if (message.parent_id) {
                                setMessages(prev => prev.map(msg => {
                                    if (msg.id === message.parent_id) {
                                        return {
                                            ...msg,
                                            replies: [...(msg.replies || []), message]
                                        };
                                    }
                                    return msg;
                                }));
                            } else {
                                // Если это новое основное сообщение
                                setMessages(prev => [...prev, message]);
                                setMessageReactions(prev => ({
                                    ...prev,
                                    [message.id]: message.reactions || []
                                }));
                            }

                            if (isScrolledToBottom) {
                                setTimeout(() => {
                                    scrollToBottom();
                                }, 50);
                            }
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
                    try {
                        const { data: reaction } = await supabase
                            .from('message_reactions')
                            .select(`
                                *,
                                profiles:user_id (
                                    full_name,
                                    avatar_url
                                )
                            `)
                            .eq('id', payload.new.id)
                            .single();

                        if (reaction) {
                            setMessageReactions(prev => ({
                                ...prev,
                                [reaction.message_id]: [
                                    ...(prev[reaction.message_id] || []),
                                    reaction
                                ]
                            }));
                        }
                    } catch (error) {
                        console.error('Ошибка обработки реакции:', error);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'message_reactions'
                },
                (payload) => {
                    setMessageReactions(prev => {
                        const messageId = payload.old.message_id;
                        const existingReactions = prev[messageId] || [];
                        const newReactions = existingReactions.filter(
                            r => r.id !== payload.old.id
                        );
                        return {
                            ...prev,
                            [messageId]: newReactions
                        };
                    });
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
                    replies:forum_messages!parent_id (
                        id,
                        content,
                        created_at,
                        profiles:user_id (
                            full_name,
                            avatar_url
                        )
                    ),
                    reactions:message_reactions (
                        id,
                        reaction,
                        user_id,
                        profiles:user_id (
                            full_name,
                            avatar_url
                        )
                    )
                `)
                .is('parent_id', null)
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

            if (editingMessage) {
                // Редактирование сообщения
                await forumApi.updateMessage(editingMessage.id, newMessage, imageUrl);
                setEditingMessage(null);
            } else {
                // Отправка нового сообщения
                await forumApi.sendMessage(
                    newMessage, 
                    user.id, 
                    imageUrl, 
                    replyTo?.id
                );
            }

            setNewMessage('');
            setSelectedImage(null);
            setShowEmojiPicker(false);
            setReplyTo(null);
            scrollToBottom();
        } catch (err) {
            console.error('Ошибка отправки:', err);
            setError('Хабарни жўнатишда хатолик');
        }
    };

    const handleReaction = async (messageId, reaction) => {
        if (!user) return;

        try {
            // Проверяем, есть ли уже такая реакция от пользователя
            const existingReactions = messageReactions[messageId] || [];
            const userReaction = existingReactions.find(r => r.user_id === user.id);

            if (userReaction) {
                if (userReaction.reaction === reaction) {
                    // Удаляем реакцию
                    await forumApi.removeReaction(userReaction.id);
                } else {
                    // Изменяем реакцию
                    await forumApi.updateReaction(userReaction.id, reaction);
                }
            } else {
                // Добавляем новую реакцию
                await forumApi.addReaction(messageId, user.id, reaction);
            }
        } catch (err) {
            console.error('Ошибка реакции:', err);
        }
    };

    const deleteMessage = async (messageId) => {
        if (!window.confirm('Хабарни ўчиришни хоҳлайсизми?')) return;

        try {
            await forumApi.deleteMessage(messageId);
            setMessages(prev => prev.filter(msg => msg.id !== messageId));
        } catch (err) {
            console.error('Ошибка удаления:', err);
            setError('Хабарни ўчиришда хатолик');
        }
    };

    const startReply = (message) => {
        setReplyTo(message);
        inputRef.current?.focus();
    };

    const cancelReply = () => {
        setReplyTo(null);
    };

    const startEdit = (message) => {
        setEditingMessage(message);
        setNewMessage(message.content);
        if (message.image_url) {
            setSelectedImage(message.image_url);
        }
        inputRef.current?.focus();
    };

    const cancelEdit = () => {
        setEditingMessage(null);
        setNewMessage('');
        setSelectedImage(null);
    };

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

    const uzLocale = {
        months: [
            'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
            'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
        ],
        monthsShort: [
            'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn',
            'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'
        ],
        weekdays: [
            'Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba',
            'Payshanba', 'Juma', 'Shanba'
        ],
        weekdaysShort: ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan']
    };

    const formatDateHeader = (date) => {
        const messageDate = new Date(date);
        const today = new Date();

        if (messageDate.toDateString() === today.toDateString()) {
            return 'Bugun';
        }

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (messageDate.toDateString() === yesterday.toDateString()) {
            return 'Kecha';
        }

        const day = messageDate.getDate();
        const monthIndex = messageDate.getMonth();
        const year = messageDate.getFullYear();

        return `${day} ${uzLocale.months[monthIndex]} ${year}`;
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

    const MessageItem = ({ message, isOwn }) => {
        const [showActions, setShowActions] = useState(false);
        const [showReactions, setShowReactions] = useState(false);

        const reactions = messageReactions[message.id] || [];

        // Группируем реакции по типу
        const groupedReactions = reactions.reduce((acc, reaction) => {
            if (!acc[reaction.reaction]) {
                acc[reaction.reaction] = {
                    count: 0,
                    users: []
                };
            }
            acc[reaction.reaction].count++;
            acc[reaction.reaction].users.push(reaction.profiles);
            return acc;
        }, {});

        return (
            <div
                className={`group relative flex ${isOwn ? 'justify-end' : 'justify-start'} px-2 md:px-4 py-1 hover:bg-black/5 dark:hover:bg-white/5`}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
            >
                {!isOwn && (
                    <div className="mr-2 md:mr-3 mt-1">
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full overflow-hidden flex-shrink-0">
                            {message.profiles?.avatar_url ? (
                                <img
                                    src={message.profiles.avatar_url}
                                    alt={message.profiles.full_name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                                    <User className="w-3 h-3 md:w-4 md:h-4 text-white" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className={`max-w-[85%] md:max-w-[70%] ${isOwn ? 'order-1' : 'order-2'}`}>
                    {!isOwn && (
                        <div className="flex items-center gap-1 md:gap-2 mb-1 px-1 md:px-2">
                            <span className="font-medium text-xs md:text-sm text-gray-700 dark:text-gray-300 truncate">
                                {message.profiles?.full_name || message.profiles?.username || 'Номаълум'}
                            </span>
                            <span className="text-[10px] md:text-xs text-gray-500 whitespace-nowrap">
                                {formatMessageTime(message.created_at)}
                            </span>
                        </div>
                    )}

                    <div className="relative">
                        {replyTo?.id === message.id && (
                            <div className="mb-1 ml-2 p-1 bg-blue-500/10 rounded-lg border-l-2 border-blue-500">
                                <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                                    {replyTo.content?.substring(0, 50)}...
                                </p>
                            </div>
                        )}

                        <div className={`rounded-xl md:rounded-2xl px-2 md:px-4 py-1.5 md:py-2 ${isOwn
                            ? 'bg-blue-500 text-white rounded-br-md'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md'
                            }`}>
                            {message.image_url && (
                                <div className="mb-1 md:mb-2 -mx-1 md:-mx-2">
                                    <img
                                        src={message.image_url}
                                        alt="Илова килинган расм"
                                        className="rounded-lg max-w-full max-h-64 md:max-h-96 object-contain"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.parentElement.innerHTML =
                                                '<div class="p-2 md:p-4 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 text-xs md:text-sm">Расм юкланмади</div>';
                                        }}
                                    />
                                </div>
                            )}

                            {message.content && (
                                <p className="whitespace-pre-wrap break-words text-sm md:text-base">
                                    {message.content}
                                </p>
                            )}

                            {/* Отображение ответов */}
                            {message.replies && message.replies.length > 0 && (
                                <div className="mt-2 border-l-2 border-blue-300 pl-2 md:pl-3">
                                    {message.replies.slice(0, 3).map((reply, idx) => (
                                        <div key={reply.id} className="mb-1 last:mb-0">
                                            <div className="flex items-start gap-1">
                                                <div className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
                                                    {reply.profiles?.avatar_url ? (
                                                        <img
                                                            src={reply.profiles.avatar_url}
                                                            alt={reply.profiles.full_name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                                                            <User className="w-2 h-2 text-gray-600" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                                                        {reply.profiles?.full_name}
                                                    </p>
                                                    <p className="text-xs text-gray-700 dark:text-gray-300">
                                                        {reply.content}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {message.replies.length > 3 && (
                                        <button
                                            onClick={() => setSelectedMessage(message)}
                                            className="text-xs text-blue-500 hover:text-blue-600 mt-1"
                                        >
                                            + {message.replies.length - 3} та жавоб
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Реакции */}
                            {Object.keys(groupedReactions).length > 0 && (
                                <div className="mt-1.5 flex items-center gap-1">
                                    {Object.entries(groupedReactions).map(([reaction, data]) => (
                                        <button
                                            key={reaction}
                                            onClick={() => handleReaction(message.id, reaction)}
                                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs ${reactions.find(r => r.user_id === user?.id && r.reaction === reaction)
                                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                                } hover:bg-gray-200 dark:hover:bg-gray-600`}
                                            onMouseEnter={() => setShowReactions(true)}
                                            onMouseLeave={() => setShowReactions(false)}
                                            title={`${data.users.map(u => u.full_name).join(', ')}`}
                                        >
                                            <span>{reaction}</span>
                                            <span>{data.count}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className={`flex items-center justify-end gap-1 mt-0.5 md:mt-1 ${isOwn ? 'text-blue-200' : 'text-gray-500'}`}>
                                <span className="text-[10px] md:text-xs">
                                    {formatMessageTime(message.created_at)}
                                </span>
                                {isOwn && (
                                    <CheckCheck className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                )}
                            </div>
                        </div>

                        {showActions && (
                            <div className={`absolute top-1/2 transform -translate-y-1/2 flex items-center gap-0.5 md:gap-1 ${isOwn
                                ? '-left-10 md:-left-14 flex-row-reverse'
                                : '-right-10 md:-right-14'
                                }`}>
                                <button
                                    onClick={() => startReply(message)}
                                    className="p-1 md:p-1.5 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                                    title="Жавоб бериш"
                                >
                                    <Reply className="w-3 h-3 md:w-4 md:h-4" />
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => handleReaction(message.id, '👍')}
                                        className="p-1 md:p-1.5 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                                        title="Реакция қўшиш"
                                    >
                                        <ThumbsUp className="w-3 h-3 md:w-4 md:h-4" />
                                    </button>
                                    {/* Попап с выбором реакции */}
                                    <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 hidden group-hover:block">
                                        <div className="flex gap-1 bg-white dark:bg-gray-800 rounded-full p-1 shadow-lg">
                                            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                                <button
                                                    key={emoji}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleReaction(message.id, emoji);
                                                    }}
                                                    className="p-1 hover:scale-110 transition-transform text-lg"
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {isOwn && (
                                    <>
                                        <button
                                            onClick={() => startEdit(message)}
                                            className="p-1 md:p-1.5 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                                            title="Таҳрирлаш"
                                        >
                                            <Edit className="w-3 h-3 md:w-4 md:h-4" />
                                        </button>
                                        <button
                                            onClick={() => deleteMessage(message.id)}
                                            className="p-1 md:p-1.5 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-red-500"
                                            title="Ўчириш"
                                        >
                                            <Delete className="w-3 h-3 md:w-4 md:h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {isOwn && (
                    <div className="ml-1 md:ml-3 mt-1 order-2 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">
                        <button className="p-1 md:p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                            <MoreVertical className="w-3 h-3 md:w-4 md:h-4 text-gray-500" />
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="h-screen bg-gray-900 flex flex-col">
            {/* Шапка */}
            <div className="bg-gray-800 border-b border-gray-700 px-3 md:px-4 py-2 md:py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                    <button
                        onClick={() => setShowOnlineUsers(!showOnlineUsers)}
                        className="p-1.5 md:p-2 rounded-full hover:bg-gray-700 lg:hidden"
                    >
                        <Users className="w-5 h-5 text-gray-300" />
                    </button>
                    <div className="relative">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden">
                            {onlineUsers[0]?.avatar_url ? (
                                <img
                                    src={onlineUsers[0].avatar_url}
                                    alt="Группа"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center">
                                    <Users className="w-4 h-4 md:w-5 md:h-5 text-white" />
                                </div>
                            )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 md:w-4 md:h-4 bg-green-500 rounded-full border-2 border-gray-800"></div>
                    </div>
                    <div>
                        <h1 className="font-semibold text-white text-sm md:text-base">EdduHelper Forum</h1>
                        <p className="text-xs text-gray-400">
                            {onlineUsers.length} Online
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1 md:gap-2">
                    <button className="p-1.5 md:p-2 rounded-full hover:bg-gray-700">
                        <Search className="w-4 h-4 md:w-5 md:h-5 text-gray-300" />
                    </button>
                    <button className="p-1.5 md:p-2 rounded-full hover:bg-gray-700">
                        <Volume2 className="w-4 h-4 md:w-5 md:h-5 text-gray-300" />
                    </button>
                    <NavLink
                        to={"/"}
                        className="p-1.5 md:p-2 rounded-full hover:bg-gray-700 text-gray-300"
                        title="Forumdan chiqish"
                    >
                        <div className="flex items-center gap-1 md:gap-2">
                            <LogOut className="w-4 h-4 md:w-5 md:h-5" />
                            <span className="hidden md:inline text-sm">Чиқиш</span>
                        </div>
                    </NavLink>
                </div>
            </div>

            {/* Основное содержимое */}
            <div className="flex flex-1 overflow-hidden">
                {/* Боковая панель */}
                {(showOnlineUsers || window.innerWidth >= 1024) && (
                    <div className={`lg:block ${showOnlineUsers ? 'absolute inset-0 z-50 bg-gray-800' : 'hidden'} lg:relative lg:w-80 lg:inset-auto`}>
                        <div className="h-full lg:border-r lg:border-gray-700 bg-gray-800 overflow-y-auto">
                            {showOnlineUsers && (
                                <div className="lg:hidden p-4 border-b border-gray-700 flex justify-between items-center">
                                    <h2 className="font-semibold text-gray-300">Онлайн фойдаланувчилар</h2>
                                    <button
                                        onClick={() => setShowOnlineUsers(false)}
                                        className="p-2 rounded-full hover:bg-gray-700"
                                    >
                                        <span className="text-gray-300 text-xl">×</span>
                                    </button>
                                </div>
                            )}

                            <div className="p-3 md:p-4">
                                <div className="mb-4 md:mb-6">
                                    <div className="flex items-center justify-between mb-2 md:mb-3">
                                        <h3 className="font-semibold text-gray-300 text-sm md:text-base">Hozir Online</h3>
                                        <span className="text-xs text-gray-500">{onlineUsers.length}</span>
                                    </div>
                                    <div className="space-y-1 md:space-y-2">
                                        {onlineUsers.map((onlineUser) => (
                                            <div
                                                key={onlineUser.id}
                                                className="flex items-center gap-2 md:gap-3 p-1.5 md:p-2 rounded-lg hover:bg-gray-700"
                                            >
                                                <div className="relative">
                                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden">
                                                        {onlineUser.avatar_url ? (
                                                            <img
                                                                src={onlineUser.avatar_url}
                                                                alt={onlineUser.full_name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                                                                <User className="w-4 h-4 md:w-5 md:h-5 text-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 md:w-3 md:h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs md:text-sm font-medium text-white truncate">
                                                        {onlineUser.full_name || onlineUser.email?.split('@')[0]}
                                                        {onlineUser.id === user?.id && ' (Сиз)'}
                                                    </p>
                                                    <p className="text-[10px] md:text-xs text-gray-400">
                                                        {(() => {
                                                            const lastSeen = new Date(onlineUser.last_seen);
                                                            const now = new Date();
                                                            const diffInSeconds = Math.floor((now - lastSeen) / 1000);

                                                            if (diffInSeconds < 60) {
                                                                return 'Online';
                                                            }

                                                            const formatUzTimeAgo = (date) => {
                                                                const now = new Date();
                                                                const seconds = Math.floor((now - date) / 1000);

                                                                const minutes = Math.floor(seconds / 60);
                                                                if (minutes < 60) return `${minutes} daqiqa oldin`;

                                                                const hours = Math.floor(minutes / 60);
                                                                if (hours < 24) return `${hours} soat oldin`;

                                                                const days = Math.floor(hours / 24);
                                                                if (days < 30) return `${days} kun oldin`;

                                                                const months = Math.floor(days / 30);
                                                                if (months < 12) return `${months} oy oldin`;

                                                                const years = Math.floor(months / 12);
                                                                return `${years} yil oldin`;
                                                            };

                                                            return formatUzTimeAgo(lastSeen);
                                                        })()}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-gray-900/50 rounded-xl p-3 md:p-4">
                                    <h4 className="text-xs md:text-sm font-medium text-gray-300 mb-2 md:mb-3">Statistika</h4>
                                    <div className="grid grid-cols-2 gap-2 md:gap-3">
                                        <div className="bg-gray-800 rounded-lg p-2 md:p-3">
                                            <p className="text-base md:text-lg font-bold text-white">{onlineUsers.length}</p>
                                            <p className="text-[10px] md:text-xs text-gray-400">Online</p>
                                        </div>
                                        <div className="bg-gray-800 rounded-lg p-2 md:p-3">
                                            <p className="text-base md:text-lg font-bold text-white">{messages.length}</p>
                                            <p className="text-[10px] md:text-xs text-gray-400">Xabarlar</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Область сообщений */}
                <div className={`flex-1 flex flex-col ${showOnlineUsers ? 'hidden lg:flex' : 'flex'}`}>
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
                                <div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-b-2 border-blue-500"></div>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
                                <Send className="w-12 h-12 md:w-16 md:h-16 mb-3 md:mb-4 opacity-50" />
                                <p className="text-base md:text-xl text-gray-400 text-center">Биринчи бўлиб ёзинг!</p>
                                <p className="text-xs md:text-sm mt-1 md:mt-2 text-gray-500 text-center">Хабар ёзиб, жўнатинг</p>
                            </div>
                        ) : (
                            <>
                                {loadingMore && (
                                    <div className="flex justify-center py-3 md:py-4">
                                        <div className="animate-spin rounded-full h-5 w-5 md:h-6 md:w-6 border-b-2 border-blue-500"></div>
                                    </div>
                                )}

                                {groupMessagesByDate().map((group, groupIndex) => (
                                    <div key={groupIndex}>
                                        <div className="sticky top-1 md:top-2 z-10 flex justify-center my-2 md:my-4">
                                            <div className="bg-gray-700/90 backdrop-blur-sm text-gray-300 text-xs px-2 py-1 md:px-3 md:py-1.5 rounded-full">
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

                    {/* Панель ввода сообщения с индикатором ответа/редактирования */}
                    <div className="border-t border-gray-700 bg-gray-800">
                        {replyTo && (
                            <div className="px-3 md:px-4 pt-2 md:pt-3">
                                <div className="bg-blue-500/10 border-l-2 border-blue-500 rounded-r-lg p-2 md:p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Reply className="w-3 h-3 md:w-4 md:h-4 text-blue-500" />
                                            <span className="text-xs md:text-sm text-blue-500 font-medium">
                                                {replyTo.profiles?.full_name} га жавоб
                                            </span>
                                        </div>
                                        <button
                                            onClick={cancelReply}
                                            className="p-1 hover:bg-blue-500/20 rounded-full"
                                        >
                                            <X className="w-3 h-3 md:w-4 md:h-4 text-blue-500" />
                                        </button>
                                    </div>
                                    <p className="text-xs md:text-sm text-gray-300 mt-1 truncate">
                                        {replyTo.content}
                                    </p>
                                </div>
                            </div>
                        )}

                        {editingMessage && (
                            <div className="px-3 md:px-4 pt-2 md:pt-3">
                                <div className="bg-yellow-500/10 border-l-2 border-yellow-500 rounded-r-lg p-2 md:p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Edit className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" />
                                            <span className="text-xs md:text-sm text-yellow-500 font-medium">
                                                Хабарни таҳрирлаш
                                            </span>
                                        </div>
                                        <button
                                            onClick={cancelEdit}
                                            className="p-1 hover:bg-yellow-500/20 rounded-full"
                                        >
                                            <X className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedImage && (
                            <div className="px-3 md:px-4 pt-2 md:pt-3">
                                <div className="relative inline-block">
                                    <img
                                        src={selectedImage}
                                        alt="Кўриб чиқиш"
                                        className="rounded-lg max-h-24 md:max-h-32"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setSelectedImage(null)}
                                        className="absolute -top-1.5 -right-1.5 md:-top-2 md:-right-2 bg-red-500 text-white rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center hover:bg-red-600 text-xs md:text-base"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        )}

                        <form onSubmit={sendMessage} className="p-3 md:p-4 relative">
                            <div className="flex items-center gap-1 md:gap-2">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current.click()}
                                    className="p-1.5 md:p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
                                    title="Расм юклаш"
                                >
                                    <Paperclip className="w-4 h-4 md:w-5 md:h-5" />
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
                                        placeholder={replyTo ? "Жавобингизни ёзинг..." : editingMessage ? "Хабарни таҳрирлаш..." : "Хабарингизни ёзинг..."}
                                        className="w-full px-3 md:px-4 py-2 md:py-3 bg-gray-700 text-white rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 text-sm md:text-base"
                                        onFocus={() => setShowEmojiPicker(false)}
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        className="absolute right-2 md:right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                                        title="Эмоциялар"
                                    >
                                        <Smile className="w-4 h-4 md:w-5 md:h-5" />
                                    </button>
                                </div>

                                {(newMessage.trim() || selectedImage) ? (
                                    <button
                                        type="submit"
                                        className="p-2 md:p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors shadow-lg"
                                        title={editingMessage ? "Таҳрирлаш" : "Жўнатиш"}
                                    >
                                        {editingMessage ? (
                                            <Check className="w-4 h-4 md:w-5 md:h-5" />
                                        ) : (
                                            <Send className="w-4 h-4 md:w-5 md:h-5" />
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="p-2 md:p-3 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
                                        title="Овозли хабар"
                                    >
                                        <Mic className="w-4 h-4 md:w-5 md:h-5" />
                                    </button>
                                )}
                            </div>

                            {showEmojiPicker && (
                                <div className="absolute bottom-16 md:bottom-20 left-2 md:left-4 z-50">
                                    <div className="relative">
                                        <EmojiPicker
                                            onEmojiClick={handleEmojiClick}
                                            previewConfig={{ showPreview: false }}
                                            skinTonesDisabled
                                            searchDisabled={false}
                                            width={window.innerWidth < 768 ? 280 : 350}
                                            height={400}
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
                    className="fixed bottom-20 md:bottom-24 right-3 md:right-4 p-2.5 md:p-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors z-40"
                    title="Охирга ўтиш"
                >
                    <Send className="w-4 h-4 md:w-5 md:h-5 rotate-45" />
                </button>
            )}
        </div>
    );
};

export default ForumPage;