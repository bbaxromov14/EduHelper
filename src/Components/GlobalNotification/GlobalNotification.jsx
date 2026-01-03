import React, { useEffect, useState } from "react";
import DOMPurify from 'dompurify'; // npm install dompurify

const GlobalNotification = () => {
  const [notifications, setNotifications] = useState([]);

  // 🔒 Функция безопасной загрузки
  const safeLoadNotifications = () => {
    try {
      const saved = localStorage.getItem("global_notifications");
      if (!saved) return [];
      
      const parsed = JSON.parse(saved);
      
      // Проверяем что это массив
      if (!Array.isArray(parsed)) return [];
      
      // Ограничиваем количество (max 10)
      const limited = parsed.slice(0, 10);
      
      // Очищаем каждое сообщение от XSS
      return limited.map(notif => ({
        ...notif,
        message: DOMPurify.sanitize(notif.message || '').substring(0, 500), // max 500 символов
        id: String(notif.id || Date.now())
      }));
      
    } catch (error) {
      console.error('Safe load error:', error);
      return [];
    }
  };

  useEffect(() => {
    const load = () => {
      setNotifications(safeLoadNotifications());
    };

    load();
    const interval = setInterval(load, 10000); // Увеличил интервал
    
    const handleStorage = (e) => {
      if (e.key === "global_notifications") {
        load();
      }
    };
    
    window.addEventListener("storage", handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // 🔒 Безопасное удаление
  const safeRemoveNotification = (id) => {
    const updated = notifications.filter((x) => x.id !== id);
    setNotifications(updated);
    
    try {
      localStorage.setItem("global_notifications", JSON.stringify(updated));
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 space-y-3 max-w-2xl w-full px-4">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-5 rounded-2xl shadow-2xl border-4 border-white/30 animate-bounce"
        >
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm opacity-90">Админ</span>
                <span className="text-xs opacity-70">
                  {new Date(n.time).toLocaleString()}
                </span>
              </div>
              {/* 🔒 Безопасный вывод */}
              <div 
                className="font-bold text-lg"
                dangerouslySetInnerHTML={{ __html: n.message }}
              />
            </div>
            <button
              onClick={() => safeRemoveNotification(n.id)}
              className="text-3xl hover:scale-125 transition"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GlobalNotification;