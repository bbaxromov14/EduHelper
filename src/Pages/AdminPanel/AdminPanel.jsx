import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/ReactContext.jsx";
import { supabase } from '../../lib/supabase';
import DOMPurify from 'dompurify';
import { v4 as uuidv4 } from "uuid"; // npm install uuid


const AdminPanel = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("courses");
  const [accessChecked, setAccessChecked] = useState(false);
  const [adminData, setAdminData] = useState(null);

  // Локальные состояния для каждого раздела
  const [courses, setCourses] = useState([]);
  const [userProgress, setUserProgress] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sitePages, setSitePages] = useState([]);
  const [editingPage, setEditingPage] = useState(null);
  const [pageForm, setPageForm] = useState({
    title_uz: "",
    title_ru: "",
    title_en: "",
    content_uz: "",
    content_ru: "",
    content_en: "",
    meta_description: "",
    meta_keywords: "",
    is_active: true
  });

  // Форма нового курса
  const [newCourse, setNewCourse] = useState({
    title: "",
    description: "",
    cover_image_url: "",
    access_type: "free",
    price: 0,
    difficulty_level: "beginner",
    category: "general",
    estimated_hours: 10,
    is_published: true
  });

  // ============= БЕЗОПАСНОСТЬ: Проверка админа =============
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user?.id) {
        setAccessChecked(true);
        return;
      }

      try {
        // Список админ email
        const adminEmails = [
          'bbaxromov14@gmail.com',
          'eduhelperuz@gmail.com',
          'lahena2199@gavrom.com'
        ];

        // ПРЯМОЙ ДОСТУП: Если email в списке админов
        if (adminEmails.includes(user.email)) {
          setAdminData({
            permissions: ["admin"],
            id: 'system',
            is_active: true
          });
          setAccessChecked(true);
          return;
        }

        // Попытка запроса к базе с обработкой ошибок
        try {
          const { data, error } = await supabase
            .from("admin_users")
            .select("id, permissions, is_active, created_at")
            .eq("user_id", user.id)
            .eq("is_active", true)
            .maybeSingle();

          if (error) {
            console.error('Database query error:', error);
            throw error;
          }

          if (data) {
            setAdminData(data);
            setAccessChecked(true);
            return;
          }
        } catch (dbError) {
          console.error('Admin check failed, using email fallback:', dbError);
          // Если база недоступна, проверяем по email
          const { data: emailData } = await supabase
            .from("admin_users")
            .select("id, permissions")
            .eq("email", user.email)
            .eq("is_active", true)
            .maybeSingle()
            .catch(() => null);

          if (emailData) {
            setAdminData(emailData);
            setAccessChecked(true);
            return;
          }
        }

        setAccessChecked(true);
      } catch (error) {
        console.error("Admin access check failed completely:", error);
        setAccessChecked(true);
      }
    };

    checkAdminAccess();
  }, [user]);

  // Загрузка данных при смене вкладки
  useEffect(() => {
    if (!user || !adminData) return;

    switch (activeTab) {
      case "courses":
        loadCourses();
        break;
      case "users":
        loadUserProgress();
        break;
      case "notifications":
        loadNotifications();
        break;
      case "pages":
        loadSitePages();
        break;
    }
  }, [user, activeTab, adminData]);

  const loadSitePages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("site_pages")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setSitePages(data || []);
    } catch (error) {
      console.error("Ошибка загрузки страниц:", error);
      alert("Не удалось загрузить страницы");
    }
  }, []);

  // ДОБАВЛЯЕМ функцию сохранения страницы
  const savePage = async (slug) => {
    if (!pageForm.title_uz.trim()) {
      alert("Введите заголовок на узбекском языке!");
      return;
    }

    if (!pageForm.content_uz.trim()) {
      alert("Введите содержание на узбекском языке!");
      return;
    }

    try {
      const pageData = {
        title_uz: DOMPurify.sanitize(pageForm.title_uz.trim()),
        title_ru: pageForm.title_ru ? DOMPurify.sanitize(pageForm.title_ru.trim()) : null,
        title_en: pageForm.title_en ? DOMPurify.sanitize(pageForm.title_en.trim()) : null,
        content_uz: DOMPurify.sanitize(pageForm.content_uz),
        content_ru: pageForm.content_ru ? DOMPurify.sanitize(pageForm.content_ru) : null,
        content_en: pageForm.content_en ? DOMPurify.sanitize(pageForm.content_en) : null,
        meta_description: pageForm.meta_description ? DOMPurify.sanitize(pageForm.meta_description.trim()) : null,
        meta_keywords: pageForm.meta_keywords ? DOMPurify.sanitize(pageForm.meta_keywords.trim()) : null,
        is_active: pageForm.is_active,
        last_updated: new Date().toISOString(),
        updated_by: user.id
      };

      const { error } = await supabase
        .from("site_pages")
        .update(pageData)
        .eq("slug", slug);

      if (error) throw error;

      // Логируем действие
      await logAdminAction("update_site_page", {
        page_slug: slug,
        title: pageData.title_uz
      });

      alert("✅ Страница обновлена!");
      loadSitePages();
      setEditingPage(null);
    } catch (error) {
      console.error("Ошибка сохранения страницы:", error);
      alert("❌ Ошибка сохранения страницы");
    }
  };

  // ДОБАВЛЯЕМ функцию для начала редактирования
  const startEditPage = (page) => {
    setEditingPage(page.slug);
    setPageForm({
      title_uz: page.title_uz || "",
      title_ru: page.title_ru || "",
      title_en: page.title_en || "",
      content_uz: page.content_uz || "",
      content_ru: page.content_ru || "",
      content_en: page.content_en || "",
      meta_description: page.meta_description || "",
      meta_keywords: page.meta_keywords || "",
      is_active: page.is_active !== false
    });
  };

  // ДОБАВЛЯЕМ обработчик изменения формы
  const handlePageFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPageForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // ============= Оптимизированные загрузчики =============
  const loadCourses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          id,
          title,
          description,
          cover_image_url,
          access_type,
          price,
          difficulty_level,
          category,
          estimated_hours,
          is_published,
          created_at,
          created_by
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error("Ошибка загрузки курсов:", error);
      alert("Ошибка загрузки курсов");
    }
  }, []);

  const loadUserProgress = useCallback(async () => {
    setProgressLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_progress")
        .select(`
          id,
          progress_percent,
          updated_at,
          profiles!inner (id, email, full_name),
          lessons!inner (id, title, course_id),
          courses!inner (id, title)
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setUserProgress(data || []);
    } catch (error) {
      console.error("Ошибка загрузки прогресса:", error);
      alert("Не удалось загрузить прогресс пользователей");
    } finally {
      setProgressLoading(false);
    }
  }, []);

  const loadNotifications = useCallback(() => {
    try {
      const saved = localStorage.getItem("global_notifications");
      if (!saved) return setNotifications([]);

      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const validated = parsed.slice(0, 20).map(notif => ({
          ...notif,
          message: DOMPurify.sanitize(notif.message || "")
        }));
        setNotifications(validated);
      }
    } catch (e) {
      console.error("Ошибка загрузки уведомлений:", e);
      setNotifications([]);
    }
  }, []);


  const logAdminAction = useCallback(async (action, details = {}) => {
    if (!user || !adminData) return;
  
    try {
      // Получение IP
      const getClientIP = async () => {
        try {
          const response = await fetch("https://api.ipify.org?format=json");
          const data = await response.json();
          return data.ip;
        } catch {
          return "unknown";
        }
      };
  
      await supabase.from("admin_audit_log").insert({
        id: uuidv4(),                     // ⚠ обязательное поле
        user_id: user.id,
        action: action,                   // ⚠ обязательное поле
        details: details,
        ip_address: await getClientIP(),
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error("Ошибка логирования:", error);
    }
  }, [user]);
  

  // ============= Валидация курса =============
  const validateCourseData = useMemo(() => {
    const errors = [];

    if (!newCourse.title.trim()) errors.push("Введите название курса!");
    if (newCourse.title.length > 200) errors.push("Название слишком длинное (макс. 200 символов)");

    if (newCourse.access_type === "paid" && (!newCourse.price || newCourse.price < 1000)) {
      errors.push("Укажите цену курса (минимум 1000 UZS)");
    }

    if (newCourse.cover_image_url) {
      try {
        new URL(newCourse.cover_image_url);
      } catch {
        errors.push("Некорректный URL изображения");
      }
    }

    if (newCourse.description && newCourse.description.length > 5000) {
      errors.push("Описание слишком длинное (макс. 5000 символов)");
    }

    return errors;
  }, [newCourse]);

  // ============= Создание курса =============
  const createCourse = async () => {
    if (validateCourseData.length > 0) {
      alert(validateCourseData[0]);
      return;
    }

    await logAdminAction("create_course", {
      title: newCourse.title,
      access_type: newCourse.access_type
    });

    setLoading(true);
    try {
      const courseData = {
        title: DOMPurify.sanitize(newCourse.title.trim()),
        description: DOMPurify.sanitize(newCourse.description || ""),
        cover_image_url: newCourse.cover_image_url ? DOMPurify.sanitize(newCourse.cover_image_url) : null,
        access_type: newCourse.access_type,
        price: newCourse.access_type === "paid" ? parseFloat(newCourse.price) : null,
        difficulty_level: newCourse.difficulty_level,
        category: newCourse.category || "general",
        estimated_hours: Math.min(Math.max(parseInt(newCourse.estimated_hours) || 10, 1), 500),
        is_published: newCourse.is_published,
        created_by: user.id,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from("courses").insert([courseData]);
      if (error) throw error;

      // Сброс формы
      setNewCourse({
        title: "", description: "", cover_image_url: "",
        access_type: "free", price: 0,
        difficulty_level: "beginner", category: "general", estimated_hours: 10,
        is_published: true
      });

      alert("✅ Курс создан!");
      loadCourses();
    } catch (error) {
      console.error("Ошибка:", error);
      alert(`❌ Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteCourse = async (courseId) => {
    await logAdminAction("delete_course", {
      course_id: courseId
    });

    if (!confirm("Удалить курс? Все уроки также будут удалены!")) return;

    try {
      const { error: lessonsError } = await supabase
        .from("lessons")
        .delete()
        .eq("course_id", courseId);

      if (lessonsError) throw lessonsError;

      const { error: courseError } = await supabase
        .from("courses")
        .delete()
        .eq("id", courseId);

      if (courseError) throw courseError;

      alert("Курс удален!");
      loadCourses();
    } catch (error) {
      console.error("Ошибка удаления курса:", error);
      alert("Ошибка удаления курса");
    }
  };

  // Обновление статуса публикации
  const togglePublished = async (courseId, currentStatus) => {
    const newStatus = !currentStatus;

    await logAdminAction("toggle_published", {
      course_id: courseId,
      new_status: newStatus
    });

    try {
      const { error } = await supabase
        .from('courses')
        .update({ is_published: newStatus })
        .eq('id', courseId);

      if (error) throw error;

      setCourses(courses.map(c =>
        c.id === courseId ? { ...c, is_published: newStatus } : c
      ));
    } catch (err) {
      console.error("Ошибка обновления статуса публикации:", err);
      alert("Не удалось изменить статус публикации");
    }
  };

  const sendGlobalNotification = async () => {
    const message = notificationMessage.trim();

    if (!message) {
      alert("Введите текст уведомления!");
      return;
    }

    if (message.length > 1000) {
      alert("Текст уведомления слишком длинный (макс. 1000 символов)");
      return;
    }

    // Логирование отправки уведомления
    await logAdminAction("send_notification", {
      message_length: message.length
    });

    const newNotif = {
      id: Date.now().toString(),
      message: DOMPurify.sanitize(message),
      time: new Date().toISOString(),
      sent_by: user.id
    };

    const updated = [newNotif, ...notifications].slice(0, 20);
    setNotifications(updated);
    localStorage.setItem("global_notifications", JSON.stringify(updated));

    setNotificationMessage("");
    alert("Уведомление отправлено всем пользователям!");
  };

  const deleteNotification = (id) => {
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    localStorage.setItem("global_notifications", JSON.stringify(updated));
  };

  // Обработчик изменения полей формы
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Валидация длины для текстовых полей
    if (name === 'title' && value.length > 200) {
      alert("Максимальная длина названия - 200 символов");
      return;
    }

    if (name === 'description' && value.length > 5000) {
      alert("Максимальная длина описания - 5000 символов");
      return;
    }

    if (name === 'price') {
      const numValue = parseInt(value) || 0;
      if (numValue < 0) {
        alert("Цена не может быть отрицательной");
        return;
      }
      setNewCourse(prev => ({ ...prev, [name]: numValue }));
      return;
    }

    setNewCourse(prev => ({ ...prev, [name]: value }));
  };

  // Группировка прогресса по пользователям
  const groupedUserProgress = useMemo(() => {
    const filtered = userProgress.filter(item =>
      (item.profiles?.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.profiles?.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.courses?.title || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.reduce((acc, item) => {
      const userKey = item.profiles?.id || item.profiles?.email;
      if (!acc[userKey]) {
        acc[userKey] = {
          user: item.profiles,
          courses: {}
        };
      }

      const courseKey = item.courses?.id;
      if (!acc[userKey].courses[courseKey]) {
        acc[userKey].courses[courseKey] = {
          course: item.courses,
          lessons: [],
          totalProgress: 0,
          lessonCount: 0
        };
      }

      acc[userKey].courses[courseKey].lessons.push({
        lesson: item.lessons,
        progress: item.progress_percent,
        updated_at: item.updated_at
      });

      acc[userKey].courses[courseKey].totalProgress += item.progress_percent || 0;
      acc[userKey].courses[courseKey].lessonCount += 1;

      return acc;
    }, {});
  }, [userProgress, searchTerm]);

  // Если доступ не проверен, показываем загрузку
  if (!accessChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Проверка доступа...</p>
        </div>
      </div>
    );
  }

  // Проверка прав доступа
  if (!user || !adminData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center p-8">
          <h1 className="text-5xl font-bold text-red-600 dark:text-red-400 mb-4">Доступ запрещён</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            У вас нет прав для доступа к этой странице
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            На главную
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-500">
      <div className="max-w-7xl mx-auto p-4 md:p-8">

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 gap-6">
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Админ Панель
          </h1>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/')}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg transition"
            >
              На главную
            </button>
            <button
              onClick={logout}
              className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg transition"
            >
              Выйти
            </button>
          </div>
        </div>

        {/* НАВИГАЦИОННЫЕ КНОПКИ */}
        <div className="flex flex-wrap gap-4 mb-10 border-b border-gray-300 dark:border-gray-700 pb-4">
          <button
            onClick={() => setActiveTab("courses")}
            className={`px-8 py-3 text-lg font-semibold rounded-t-xl transition ${activeTab === "courses"
              ? "bg-indigo-600 text-white"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
              }`}
          >
            Курсы
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-8 py-3 text-lg font-semibold rounded-t-xl transition ${activeTab === "users"
              ? "bg-indigo-600 text-white"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
              }`}
          >
            Прогресс пользователей
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={`px-8 py-3 text-lg font-semibold rounded-t-xl transition ${activeTab === "notifications"
              ? "bg-indigo-600 text-white"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
              }`}
          >
            Глобальные уведомления
          </button>
          <button
            onClick={() => setActiveTab("pages")}
            className={`px-8 py-3 text-lg font-semibold rounded-t-xl transition ${activeTab === "pages"
              ? "bg-indigo-600 text-white"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
              }`}
          >
            Политика и страницы
          </button>
        </div>

        {/* === ВКЛАДКА: КУРСЫ === */}
        {activeTab === "courses" && (
          <>
            {/* Форма создания курса */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 mb-12 border border-gray-200 dark:border-gray-700">
              <h2 className="text-4xl font-bold mb-8 text-gray-800 dark:text-white">Yangi kurs yaratish</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Kurs nomi *</label>
                  <input
                    type="text"
                    name="title"
                    placeholder="Kurs nomini kiriting"
                    value={newCourse.title}
                    onChange={handleInputChange}
                    maxLength="200"
                    className="w-full px-6 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-700 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Muqova URL</label>
                  <input
                    type="text"
                    name="cover_image_url"
                    placeholder="https://example.com/image.jpg"
                    value={newCourse.cover_image_url}
                    onChange={handleInputChange}
                    className="w-full px-6 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-700 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Turkum</label>
                  <select
                    name="category"
                    value={newCourse.category}
                    onChange={handleInputChange}
                    className="w-full px-6 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-700 outline-none transition"
                  >
                    <option value="mathematics">Matematika</option>
                    <option value="programming">Dasturlash</option>
                    <option value="science">Fan</option>
                    <option value="languages">Tillar</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Qiyinchilik darajasi</label>
                  <select
                    name="difficulty_level"
                    value={newCourse.difficulty_level}
                    onChange={handleInputChange}
                    className="w-full px-6 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-700 outline-none transition"
                  >
                    <option value="beginner">Boshlang'ich</option>
                    <option value="intermediate">O'rta</option>
                    <option value="advanced">Murakkab</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Kursga kirish turi</label>
                  <select
                    name="access_type"
                    value={newCourse.access_type}
                    onChange={handleInputChange}
                    className="w-full px-6 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-700 outline-none transition"
                  >
                    <option value="free">Bepul</option>
                    <option value="paid">Pullik</option>
                    <option value="premium_only">Faqat PREMIUM obunachilar uchun</option>
                  </select>
                </div>

                {/* Чекбокс публикации */}
                <div className="md:col-span-2 flex items-center gap-4 mt-6">
                  <input
                    type="checkbox"
                    id="is_published"
                    checked={newCourse.is_published}
                    onChange={e => setNewCourse({ ...newCourse, is_published: e.target.checked })}
                    className="h-6 w-6 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                  />
                  <label htmlFor="is_published" className="text-xl font-medium text-gray-700 dark:text-gray-300">
                    Videni joylash
                  </label>
                </div>

                {newCourse.access_type === "paid" && (
                  <div className="md:col-span-2">
                    <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Цена курса (UZS)
                    </label>
                    <input
                      type="number"
                      name="price"
                      min="1000"
                      step="1000"
                      placeholder="Например: 150000"
                      value={newCourse.price || ""}
                      onChange={handleInputChange}
                      className="w-full max-w-md px-6 py-4 rounded-xl border border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-white focus:ring-4 focus:ring-yellow-300 dark:focus:ring-yellow-700 outline-none transition"
                    />
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Пользователь сможет купить этот курс отдельно
                    </p>
                  </div>
                )}
              </div>

              <div className="mb-8">
                <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-3">Tavsif</label>
                <textarea
                  name="description"
                  placeholder="Kursning qisqacha tavsifi"
                  value={newCourse.description}
                  onChange={handleInputChange}
                  rows="5"
                  maxLength="5000"
                  className="w-full px-6 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-700 outline-none transition"
                />
              </div>

              <div className="flex items-center gap-10 mb-10">
                <div className="flex items-center gap-4">
                  <span className="text-lg text-gray-700 dark:text-gray-300">To'liq o'quv soati:</span>
                  <input
                    type="number"
                    name="estimated_hours"
                    min="1"
                    max="500"
                    value={newCourse.estimated_hours}
                    onChange={handleInputChange}
                    className="w-28 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                onClick={createCourse}
                disabled={loading || !newCourse.title.trim() || (newCourse.access_type === "paid" && (!newCourse.price || newCourse.price < 1000))}
                className={`px-10 py-5 rounded-xl text-xl font-bold text-white shadow-xl transition ${loading || !newCourse.title.trim() || (newCourse.access_type === "paid" && (!newCourse.price || newCourse.price < 1000))
                  ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  }`}
              >
                {loading ? "Yaratilmoqda..." : "Kurs yaratish"}
              </button>
            </div>

            {/* Список курсов */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
              <h2 className="text-4xl font-bold mb-8 text-gray-800 dark:text-white">Существующие курсы ({courses.length})</h2>

              {courses.length === 0 ? (
                <p className="text-center text-2xl text-gray-500 dark:text-gray-400 py-16">Курсов пока нет</p>
              ) : (
                <div className="grid gap-8">
                  {courses.map(course => {
                    let accessLabel = "Бесплатный";
                    let accessColor = "bg-gradient-to-r from-green-500 to-emerald-500 text-white";

                    if (course.access_type === "paid") {
                      accessLabel = `Платный — ${course.price?.toLocaleString()} UZS`;
                      accessColor = "bg-gradient-to-r from-yellow-500 to-orange-500 text-black";
                    } else if (course.access_type === "premium_only") {
                      accessLabel = "Только Premium ⭐";
                      accessColor = "bg-gradient-to-r from-purple-600 to-pink-600 text-white";
                    }

                    return (
                      <div
                        key={course.id}
                        className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-8 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-200 dark:border-gray-600 hover:shadow-2xl transition"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-4">
                            <h3 className="text-3xl font-bold text-gray-800 dark:text-white">{DOMPurify.sanitize(course.title)}</h3>
                            {!course.is_published && (
                              <span className="px-4 py-2 bg-gray-500 text-white rounded-full text-sm font-bold">
                                ЧЕРНОВИК
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-4">
                            <span className={`px-6 py-3 rounded-full text-lg font-bold shadow-md ${accessColor}`}>
                              {accessLabel}
                            </span>
                            <span className="px-5 py-2 rounded-full text-base font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400">
                              {course.difficulty_level || 'Не указан'}
                            </span>
                            <span className="px-5 py-2 rounded-full text-base font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-400">
                              ⏱️ {course.estimated_hours || 10} ч
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-6 mt-6 lg:mt-0 items-start lg:items-center">
                          {/* Переключатель публикации */}
                          <div className="flex items-center gap-4">
                            <input
                              type="checkbox"
                              id={`published-${course.id}`}
                              checked={course.is_published || false}
                              onChange={() => togglePublished(course.id, course.is_published)}
                              className="h-6 w-6 text-green-600 rounded focus:ring-green-500"
                            />
                            <label htmlFor={`published-${course.id}`} className="text-lg font-medium text-gray-700 dark:text-gray-300">
                              {course.is_published ? "Опубликован" : "Черновик"}
                            </label>
                          </div>

                          <div className="flex gap-4">
                            <button
                              onClick={() => navigate(`/course-manage/${course.id}`)}
                              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition"
                            >
                              Управлять уроками
                            </button>
                            <button
                              onClick={() => deleteCourse(course.id)}
                              className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition"
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* === ВКЛАДКА: ПРОГРЕСС ПОЛЬЗОВАТЕЛЕЙ === */}
        {activeTab === "users" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
            <h2 className="text-4xl font-bold mb-8 text-gray-800 dark:text-white">Прогресс всех пользователей</h2>

            <input
              type="text"
              placeholder="Поиск по имени, email или курсу..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full max-w-lg mb-8 px-6 py-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-700 outline-none"
            />

            {progressLoading ? (
              <p className="text-center text-2xl text-gray-500 dark:text-gray-400 py-16">Загрузка...</p>
            ) : Object.keys(groupedUserProgress).length === 0 ? (
              <p className="text-center text-2xl text-gray-500 dark:text-gray-400 py-16">Нет данных о прогрессе</p>
            ) : (
              <div className="space-y-12">
                {Object.values(groupedUserProgress).map((group, index) => (
                  <div key={index} className="p-6 bg-gray-50 dark:bg-gray-700 rounded-2xl border border-gray-200 dark:border-gray-600">
                    <h3 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">
                      {DOMPurify.sanitize(group.user?.full_name || "Без имени")} ({DOMPurify.sanitize(group.user?.email || "")})
                    </h3>

                    {Object.keys(group.courses).length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400">Нет прогресса по курсам</p>
                    ) : (
                      Object.values(group.courses).map((courseGroup, courseIndex) => {
                        const avgProgress = courseGroup.lessonCount > 0 
                          ? Math.round(courseGroup.totalProgress / courseGroup.lessonCount)
                          : 0;

                        return (
                          <div key={courseIndex} className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-2xl font-semibold text-indigo-600 dark:text-indigo-400">
                                {DOMPurify.sanitize(courseGroup.course?.title || "Курс без названия")}
                              </h4>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                                    <th className="px-6 py-4 text-base font-bold rounded-tl-2xl">Урок</th>
                                    <th className="px-6 py-4 text-base font-bold">Прогресс / Баллы</th>
                                    <th className="px-6 py-4 text-base font-bold rounded-tr-2xl">Обновлено</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {courseGroup.lessons.map((lessonItem, lessonIndex) => (
                                    <tr 
                                      key={lessonIndex} 
                                      className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition"
                                    >
                                      <td className="px-6 py-4 text-gray-800 dark:text-white">
                                        {DOMPurify.sanitize(lessonItem.lesson?.title || "-")}
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                          <div className="w-32 bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                                            <div
                                              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full"
                                              style={{ width: `${lessonItem.progress || 0}%` }}
                                            />
                                          </div>
                                          <span className="font-medium text-gray-800 dark:text-white">
                                            {lessonItem.progress || 0}% 
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                        {new Date(lessonItem.updated_at).toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === ВКЛАДКА: ГЛОБАЛЬНЫЕ УВЕДОМЛЕНИЯ === */}
        {activeTab === "notifications" && (
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Отправка */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
              <h2 className="text-4xl font-bold mb-8 text-gray-800 dark:text-white">Отправить уведомление всем</h2>
              <textarea
                placeholder="Текст уведомления (поддерживается HTML)"
                value={notificationMessage}
                onChange={e => setNotificationMessage(e.target.value)}
                rows="8"
                maxLength="1000"
                className="w-full px-6 py-5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-purple-300 dark:focus:ring-purple-700 outline-none mb-8 transition"
              />
              <button
                onClick={sendGlobalNotification}
                className="w-full py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xl font-bold rounded-xl shadow-xl transition"
              >
                Отправить всем пользователям
              </button>
            </div>

            {/* Список отправленных */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
              <h2 className="text-4xl font-bold mb-8 text-gray-800 dark:text-white">Отправленные уведомления</h2>
              {notifications.length === 0 ? (
                <p className="text-center text-2xl text-gray-500 dark:text-gray-400 py-16">Нет отправленных уведомлений</p>
              ) : (
                <div className="space-y-6">
                  {notifications.map(n => (
                    <div key={n.id} className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl border border-purple-200 dark:border-purple-800">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {new Date(n.time).toLocaleString()}
                          </div>
                          <div
                            className="text-lg font-medium text-gray-800 dark:text-white"
                            dangerouslySetInnerHTML={{ __html: n.message }}
                          />
                        </div>
                        <button
                          onClick={() => deleteNotification(n.id)}
                          className="ml-6 text-3xl text-red-600 dark:text-red-400 hover:scale-110 transition"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* === НОВАЯ ВКЛАДКА: ПОЛИТИКА И СТРАНИЦЫ === */}
        {activeTab === "pages" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
            <h2 className="text-4xl font-bold mb-8 text-gray-800 dark:text-white">Управление страницами сайта</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Список страниц */}
              <div>
                <h3 className="text-2xl font-bold mb-6 text-gray-700 dark:text-gray-300">Доступные страницы</h3>
                <div className="space-y-4">
                  {sitePages.map(page => (
                    <div key={page.slug} className="p-6 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                            {page.title_uz}
                            {!page.is_active && (
                              <span className="ml-3 px-3 py-1 bg-gray-500 text-white rounded-full text-sm font-bold">
                                Скрыта
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Ссылка: /page/{page.slug}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Обновлено: {new Date(page.last_updated).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => startEditPage(page)}
                          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition"
                        >
                          Редактировать
                        </button>
                      </div>

                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        <div className="flex gap-4 mb-2">
                          <span className={`px-3 py-1 rounded-full ${page.content_uz ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                            🇺🇿 UZ
                          </span>
                          <span className={`px-3 py-1 rounded-full ${page.content_ru ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                            🇷🇺 RU
                          </span>
                          <span className={`px-3 py-1 rounded-full ${page.content_en ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                            🇺🇸 EN
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Форма редактирования */}
              <div>
                <h3 className="text-2xl font-bold mb-6 text-gray-700 dark:text-gray-300">
                  {editingPage ? `Редактирование: ${editingPage}` : 'Выберите страницу для редактирования'}
                </h3>

                {editingPage && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Заголовок (Uzbek) *
                      </label>
                      <input
                        type="text"
                        name="title_uz"
                        value={pageForm.title_uz}
                        onChange={handlePageFormChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        maxLength="200"
                      />
                    </div>

                    <div>
                      <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Заголовок (Russian)
                      </label>
                      <input
                        type="text"
                        name="title_ru"
                        value={pageForm.title_ru}
                        onChange={handlePageFormChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        maxLength="200"
                      />
                    </div>

                    <div>
                      <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Содержание (Uzbek) *
                      </label>
                      <textarea
                        name="content_uz"
                        value={pageForm.content_uz}
                        onChange={handlePageFormChange}
                        rows="8"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                        placeholder="Используйте Markdown для форматирования..."
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Поддерживается Markdown: **жирный**, *курсив*, ### заголовки, [ссылки](url)
                      </p>
                    </div>

                    <div>
                      <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Содержание (Russian)
                      </label>
                      <textarea
                        name="content_ru"
                        value={pageForm.content_ru}
                        onChange={handlePageFormChange}
                        rows="8"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        id="is_active"
                        name="is_active"
                        checked={pageForm.is_active}
                        onChange={handlePageFormChange}
                        className="h-5 w-5 text-green-600 rounded"
                      />
                      <label htmlFor="is_active" className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        Страница активна (видна пользователям)
                      </label>
                    </div>

                    <div className="flex gap-4 pt-6">
                      <button
                        onClick={() => savePage(editingPage)}
                        className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg transition"
                      >
                        Сохранить изменения
                      </button>
                      <button
                        onClick={() => setEditingPage(null)}
                        className="px-8 py-4 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl shadow-lg transition"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;