import React, { useState, useEffect } from "react";
import { useNavigate, NavLink, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/ReactContext.jsx";
import { motion } from "framer-motion";

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Получаем реферальный код из URL при загрузке
  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode) {
      // Сохраняем код в localStorage для последующей обработки
      localStorage.setItem("referral_code_from_url", refCode);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isLogin) {
        // Вход через контекст
        await login(email, password);
        navigate("/");
      } else {
        // Регистрация через контекст
        if (!fullName.trim()) {
          setError("Ismingizni kiriting");
          setIsLoading(false);
          return;
        }

        // Регистрируем пользователя
        // Реферальный код уже в localStorage, его обработает AuthProvider
        await register(fullName, email, password);

        // Supabase автоматически отправляет письмо подтверждения
        navigate("/check-email", {
          state: { email, fullName },
        });
      }
    } catch (err) {
      console.error("Auth error:", err);
      
      // Обработка ошибок...
      if (err.message?.includes("Invalid login credentials")) {
        setError("Email yoki parol xato");
      } else if (err.message?.includes("already registered")) {
        setError("Bu email allaqachon ro'yxatdan o'tgan");
      } else if (err.message?.includes("Password should be at least 6 characters")) {
        setError("Parol kamida 6 ta belgidan iborat bo'lishi kerak");
      } else if (err.message?.includes("Invalid email")) {
        setError("Noto'g'ri email formati");
      } else if (err.message?.includes("rate limit") || err.message?.includes("too many requests")) {
        setError("Juda ko'p urinishlar. Biroz kutib qayta urining");
      } else if (err.message?.includes("new row violates row-level security policy")) {
        setError("Xavfsizlik sozlamalari xatosi. Iltimos, birozdan keyin qayta urining");
      } else if (err.message?.includes("42501")) {
        setError("Ruxsat yo'q. Profil yaratishda xatolik");
      } else {
        setError(err.message || "Xatolik yuz berdi. Qayta urining");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setIsLoading(true);

    try {
      // Google логин через контекст
      // Реферальный код уже в localStorage, его обработает AuthProvider
      await loginWithGoogle();
      // Supabase сам сделает редирект
    } catch (err) {
      console.error("Google login error:", err);
      setError("Google orqali kirishda xatolik yuz berdi");
      setIsLoading(false);
    }
  };

  // Функция для восстановления реферального кода при переключении формы
  const toggleForm = () => {
    setIsLogin(!isLogin);
    setError("");
    setFullName("");
    setEmail("");
    setPassword("");

    // Восстанавливаем код из localStorage для показа сообщения
    const savedCode = localStorage.getItem("referral_code_from_url");
    
    // Показываем сообщение о реферальном коде только при регистрации
    if (!isLogin && savedCode) {
      // Можно показать уведомление, что код сохранен
    }
  };

  // Проверяем есть ли реферальный код для отображения
  const hasReferralCode = () => {
    return localStorage.getItem("referral_code_from_url") || 
           localStorage.getItem("pending_referral_code");
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Космический фон */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950 via-black to-blue-950" />
        {[...Array(60)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 3 + Math.random() * 5, repeat: Infinity, delay: Math.random() * 5 }}
            style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%` }}
          />
        ))}
      </div>

      {/* Неоновая сфера */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 md:w-[600px] md:h-[600px] rounded-full bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 blur-3xl opacity-40 animate-pulse" />

      {/* Лоадер */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center flex-col gap-6"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-24 h-24 border-8 border-t-cyan-500 border-r-purple-500 border-b-pink-500 border-l-transparent rounded-full"
          />
          <p className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
            {isLogin ? "Kirilmoqda..." : "Ro'yxatdan o'tilmoqda..."}
          </p>
        </motion.div>
      )}

      <div className="relative z-10 flex items-center justify-center min-h-screen p-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="w-full max-w-md"
        >
          {/* Логотип */}
          <div className="text-center mb-12">
            <motion.div whileHover={{ scale: 1.2, rotate: 360 }} transition={{ duration: 0.8 }}>
              <div className="inline-block p-6 rounded-3xl bg-gradient-to-br from-cyan-500 to-purple-600 shadow-2xl">
                <span className="text-6xl font-black text-white">EH</span>
              </div>
            </motion.div>
            <h1 className="text-6xl font-black mt-6 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              EDUHELPER
            </h1>

            {/* Показываем реферальный код если есть */}
            {!isLogin && hasReferralCode() && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="mt-4 inline-block px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full text-sm font-bold"
              >
                🎁 Do'stingiz taklif qildi!
              </motion.div>
            )}

            <p className="text-xl mt-4 opacity-90">Kelajak bugundan boshlanadi</p>
          </div>

          {/* Основная карточка */}
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white/10 backdrop-blur-3xl rounded-3xl p-10 border border-white/20 shadow-2xl"
          >
            {/* Google кнопка */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-4 py-5 rounded-2xl bg-white/20 border border-white/30 hover:bg-white/30 transition-all mb-6 group disabled:opacity-60"
            >
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold text-red-500">G</span>
              </div>
              <span className="font-bold text-lg">
                Google orqali {isLogin ? "kirish" : "davom etish"}
              </span>
            </motion.button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/20" />
              </div>
              <span className="relative px-6 bg-black/50 backdrop-blur text-sm">yoki email bilan</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <motion.input
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  type="text"
                  placeholder="Ismingiz"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-6 py-5 rounded-2xl bg-white/10 border border-white/20 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 placeholder-white/50 text-lg transition-all"
                  required
                />
              )}

              <motion.input
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-6 py-5 rounded-2xl bg-white/10 border border-white/20 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 placeholder-white/50 text-lg transition-all"
                required
              />

              <motion.input
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                type="password"
                placeholder="Parol (6+ belgidan)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-6 py-5 rounded-2xl bg-white/10 border border-white/20 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/30 placeholder-white/50 text-lg transition-all"
                required
                minLength="6"
              />

              {error && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-red-500/20 border border-red-500/50 text-red-300 p-4 rounded-2xl text-center font-medium"
                >
                  {error}
                </motion.div>
              )}

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={isLoading}
                className="w-full py-5 rounded-2xl font-black text-xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-400 hover:to-pink-400 shadow-2xl transition-all disabled:opacity-60"
              >
                {isLogin ? "KIRISH" : "RO'YXATDAN O'TISH"}
              </motion.button>
            </form>

            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={toggleForm}
                className="text-cyan-400 hover:text-cyan-300 font-bold text-lg transition"
              >
                {isLogin ? "Hisobingiz yo'qmi? → Ro'yxatdan o'ting" : "Hisobingiz bormi? → Kirish"}
              </button>
            </div>

            <div className="mt-6 text-center">
              <NavLink to="/" className="text-white/60 hover:text-white transition text-sm">
                ← Bosh sahifaga
              </NavLink>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-center mt-12 text-2xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
          >
            100% BEPUL • REKLAMASIZ • O'ZBEKISTON UCHUN
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;