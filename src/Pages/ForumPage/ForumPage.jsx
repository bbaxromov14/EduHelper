import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { forumApi } from "../../lib/forumApi";
import {
  Reply,
  Users,
  Search,
  Volume2,
  LogOut,
  User,
  Send,
  Paperclip,
  Smile,
  Mic,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";

export default function ForumPage({ user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  // ===== Загрузка сообщений =====
  const loadMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("forum_messages")
      .select(`
        *,
        profiles:user_id (
          full_name,
          avatar_url,
          username
        ),
        reply_to:reply_to (
          id,
          content,
          image_url,
          profiles:user_id (
            full_name
          )
        )
      `)
      .order("created_at", { ascending: true });

    if (data) setMessages(data);
    setLoading(false);
  };

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel("forum-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "forum_messages" },
        async (payload) => {
          const { data } = await supabase
            .from("forum_messages")
            .select(`
              *,
              profiles:user_id (
                full_name,
                avatar_url,
                username
              ),
              reply_to:reply_to (
                id,
                content,
                image_url,
                profiles:user_id (
                  full_name
                )
              )
            `)
            .eq("id", payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => [...prev, data]);
            scrollToBottom();
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // ===== Отправка =====
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !selectedImage) return;

    await forumApi.sendMessage(
      newMessage,
      user.id,
      selectedImage,
      replyTo?.id || null
    );

    setNewMessage("");
    setSelectedImage(null);
    setReplyTo(null);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ===== UI =====
  return (
    <div className="h-screen bg-gray-900 flex flex-col">

      {/* ===== HEADER ===== */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOnlineUsers(!showOnlineUsers)}
            className="lg:hidden p-2 rounded-full hover:bg-gray-700"
          >
            <Users className="w-5 h-5 text-gray-300" />
          </button>
          <h1 className="text-white font-semibold">EduHelper Forum</h1>
        </div>

        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-gray-300" />
          <Volume2 className="w-5 h-5 text-gray-300" />
          <NavLink to="/" className="text-gray-300">
            <LogOut className="w-5 h-5" />
          </NavLink>
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div className="flex flex-1 overflow-hidden">

        {/* ===== MESSAGES ===== */}
        <div className="flex-1 flex flex-col">
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin h-8 w-8 border-b-2 border-blue-500 rounded-full" />
              </div>
            ) : (
              messages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  isOwn={message.user_id === user.id}
                  onReply={() => setReplyTo(message)}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ===== REPLY BAR ===== */}
          {replyTo && (
            <div className="mx-4 mb-2 p-2 bg-gray-700 text-white rounded-lg flex justify-between">
              <div className="truncate">
                <b>{replyTo.profiles?.full_name}</b>:{" "}
                {replyTo.content || "📷 Расм"}
              </div>
              <button onClick={() => setReplyTo(null)}>✕</button>
            </div>
          )}

          {/* ===== INPUT ===== */}
          <form onSubmit={sendMessage} className="p-4 border-t border-gray-700">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                className="text-gray-400"
              >
                <Paperclip />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
              />

              <input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Хабар ёзинг..."
                className="flex-1 px-4 py-2 bg-gray-700 rounded-full text-white"
              />

              <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                <Smile className="text-gray-400" />
              </button>

              <button type="submit" className="bg-blue-500 p-2 rounded-full">
                <Send className="text-white w-4 h-4" />
              </button>
            </div>

            {showEmojiPicker && (
              <div className="absolute bottom-20 left-4 z-50">
                <EmojiPicker
                  onEmojiClick={(e) =>
                    setNewMessage((prev) => prev + e.emoji)
                  }
                  previewConfig={{ showPreview: false }}
                />
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

// ===== MESSAGE ITEM =====
function MessageItem({ message, isOwn, onReply }) {
  return (
    <div className={`flex gap-2 ${isOwn ? "justify-end" : ""}`}>
      {!isOwn && (
        <img
          src={message.profiles?.avatar_url || "/avatar.png"}
          className="w-8 h-8 rounded-full"
        />
      )}

      <div className="max-w-[75%] bg-gray-800 text-white rounded-xl p-2">
        {message.reply_to && (
          <div className="mb-1 px-2 py-1 text-xs bg-gray-700 rounded border-l-2 border-blue-400">
            <b>{message.reply_to.profiles?.full_name}</b>
            <div className="truncate">
              {message.reply_to.content || "📷 Расм"}
            </div>
          </div>
        )}

        {message.content && <div>{message.content}</div>}

        {message.image_url && (
          <img src={message.image_url} className="mt-1 rounded-lg" />
        )}
      </div>

      <button onClick={onReply} className="text-gray-400">
        <Reply className="w-4 h-4" />
      </button>
    </div>
  );
}
