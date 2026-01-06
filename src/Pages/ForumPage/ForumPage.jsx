import React, { useState, useEffect, useRef } from 'react';
import { supabase, forumApi } from '../../lib/supabase';
import {
    Send, User, Clock, MoreVertical, Search, Volume2, Users,
    Paperclip, Smile, ThumbsUp, Heart, Laugh, Frown, Angry,
    Reply, Delete, CheckCheck, X
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { format } from 'date-fns';

const ForumPage = () => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [replyingTo, setReplyingTo] = useState(null);
    const [showReactionsPicker, setShowReactionsPicker] = useState(null);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            if (user) {
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

    useEffect(() => {
        const initChat = async () => {
            try {
                setLoading(true);
                const data = await forumApi.getForumMessages();
                setMessages(data);
                fetchOnlineUsers();
            } catch (err) {
                console.error('Ошибка загрузки сообщений:', err);
            } finally {
                setLoading(false);
                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        };
        initChat();
    }, []);

    useEffect(() => {
        const messagesChannel = supabase
            .channel('forum-messages')
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'forum_messages' },
                async (payload) => {
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
                        message_reactions: []
                    }]);
                    
                    setTimeout(() => {
                        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 50);
                }
            )
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'message_reactions' },
                async (payload) => {
                    setMessages(prev => prev.map(msg => 
                        msg.id === payload.new.message_id 
                            ? { ...msg, message_reactions: [...(msg.message_reactions || []), payload.new] }
                            : msg
                    ));
                }
            )
            .on('postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'message_reactions' },
                async (payload) => {
                    setMessages(prev => prev.map(msg => 
                        msg.id === payload.old.message_id 
                            ? { ...msg, message_reactions: (msg.message_reactions || []).filter(r => r.id !== payload.old.id) }
                            : msg
                    ));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(messagesChannel);
        };
    }, []);

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
            let imageUrl = selectedImage;
            
            if (selectedImage && typeof selectedImage !== 'string') {
                const reader = new FileReader();
                const base64 = await new Promise((resolve) => {
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(selectedImage);
                });
                imageUrl = base64;
            }

            const replyToId = replyingTo ? replyingTo.id : null;
            await forumApi.sendMessage(newMessage, user.id, imageUrl, replyToId);
            
            setNewMessage('');
            setSelectedImage(null);
            setReplyingTo(null);
            setShowEmojiPicker(false);
        } catch (err) {
            console.error('Ошибка отправки:', err);
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
        if (!confirm('Удалить сообщение?')) return;
        
        try {
            await forumApi.deleteMessage(messageId);
        } catch (err) {
            console.error('Ошибка удаления сообщения:', err);
        }
    };

    const formatMessageTime = (date) => {
        return format(new Date(date), 'HH:mm');
    };

    const ReactionButton = ({ message, type, icon: Icon, color }) => {
        const userReaction = message.message_reactions?.find(r => r.user_id === user?.id && r.reaction_type === type);
        const count = message.message_reactions?.filter(r => r.reaction_type === type).length || 0;
        
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
        const userReaction = message.message_reactions?.find(r => r.user_id === user?.id);

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
                                {message.profiles?.full_name || message.profiles?.username || 'Пользователь'}
                            </span>
                            <span className="text-xs text-gray-500">
                                {formatMessageTime(message.created_at)}
                            </span>
                        </div>
                    )}

                    <div className="relative">
                        {message.image_url && (
                            <div className="mb-2 -mx-2">
                                <img
                                    src={message.image_url}
                                    alt="Изображение"
                                    className="rounded-lg max-w-full max-h-96 object-contain"
                                />
                            </div>
                        )}

                        {message.content && (
                            <div className={`rounded-2xl px-4 py-2 ${isOwn 
                                ? 'bg-blue-500 text-white rounded-br-md' 
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-md'
                            }`}>
                                <p className="whitespace-pre-wrap break-words">
                                    {message.content}
                                </p>
                                
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
                        )}

                        {(message.message_reactions?.length > 0 || showActions) && (
                            <div className={`flex flex-wrap gap-1 mt-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                <ReactionButton message={message} type="like" icon={ThumbsUp} color="#3b82f6" />
                                <ReactionButton message={message} type="heart" icon={Heart} color="#ef4444" />
                                <ReactionButton message={message} type="laugh" icon={Laugh} color="#f59e0b" />
                                <ReactionButton message={message} type="sad" icon={Frown} color="#8b5cf6" />
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
                                    { type: 'sad', icon: Frown, color: '#8b5cf6' },
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
            </div>
        );
    };

    return (
        <div className="h-screen bg-gray-900 flex flex-col">
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
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
                        <h1 className="font-semibold text-white">Форум</h1>
                        <p className="text-xs text-gray-400">
                            {onlineUsers.length} онлайн
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

            <div className="flex-1 overflow-hidden">
                <div className="h-full flex">
                    <div className="hidden lg:block w-80 border-r border-gray-700 bg-gray-800 overflow-y-auto">
                        <div className="p-4">
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold text-gray-300">Онлайн</h3>
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
                                                    {onlineUser.id === user?.id && ' (Вы)'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                        <div
                            ref={messagesContainerRef}
                            className="flex-1 overflow-y-auto bg-gray-900"
                        >
                            {loading ? (
                                <div className="flex justify-center items-center h-full">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                    <Send className="w-16 h-16 mb-4 opacity-50" />
                                    <p className="text-xl text-gray-400">Напишите первое сообщение!</p>
                                </div>
                            ) : (
                                <>
                                    {messages.map((message) => (
                                        <MessageItem
                                            key={message.id}
                                            message={message}
                                            isOwn={message.user_id === user?.id}
                                        />
                                    ))}
                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>

                        {replyingTo && (
                            <div className="border-t border-gray-700 bg-gray-800 px-4 py-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Reply className="w-4 h-4 text-blue-400" />
                                    <div className="text-sm">
                                        <span className="text-gray-300">
                                            {replyingTo.profiles?.full_name || replyingTo.profiles?.username || 'Пользователь'}
                                        </span>
                                        <span className="text-gray-400 ml-2">
                                            {replyingTo.content ? 
                                                (replyingTo.content.length > 50 ? 
                                                    replyingTo.content.substring(0, 50) + '...' : 
                                                    replyingTo.content
                                                ) : 
                                                'Изображение'
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

                        <div className="border-t border-gray-700 bg-gray-800">
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
                                        onChange={(e) => setSelectedImage(e.target.files[0])}
                                        accept="image/*"
                                        className="hidden"
                                    />

                                    <div className="flex-1 relative">
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder="Введите сообщение..."
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
                                                onEmojiClick={(emojiData) => {
                                                    setNewMessage(prev => prev + emojiData.emoji);
                                                    setShowEmojiPicker(false);
                                                    inputRef.current?.focus();
                                                }}
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
            </div>
        </div>
    );
};

export default ForumPage;