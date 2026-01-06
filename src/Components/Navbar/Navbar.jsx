import React, { useState, useEffect, useCallback, useMemo } from "react";
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/ReactContext';
import items from "../../Utils/Utils";
import { supabase } from '../../lib/supabase'; // Заменили Firebase на Supabase

// Хук для отслеживания размера окна
const useWindowSize = () => {
    const [windowSize, setWindowSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight,
    });

    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return windowSize;
};

const Navbar = () => {
    const [nightMode, setNightMode] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userData, setUserData] = useState(null);
    const [isPremium, setIsPremium] = useState(false);
    const { width } = useWindowSize();
    const { user, isAuthenticated, logout } = useAuth();

    // Получаем данные пользователя из Supabase в реальном времени
    useEffect(() => {
        if (!user?.id) return; // В Supabase user.id вместо user.uid

        // Подписка на изменения профиля пользователя
        const channel = supabase
            .channel('user-profile-changes')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user.id}`
                },
                (payload) => {
                    const data = payload.new;
                    setUserData(data);

                    // Проверяем премиум статус
                    if (data.premium_until) {
                        const premiumUntil = new Date(data.premium_until);
                        const now = new Date();
                        setIsPremium(premiumUntil > now);
                    } else {
                        setIsPremium(false);
                    }

                    // Устанавливаем тему из настроек пользователя
                    if (data.theme_preference) {
                        const isDark = data.theme_preference === "dark";
                        setNightMode(isDark);
                        applyTheme(isDark);
                    }
                }
            )
            .subscribe();

        // Первоначальная загрузка данных
        const fetchUserData = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;

                if (data) {
                    setUserData(data);

                    // Проверяем премиум статус
                    if (data.premium_until) {
                        const premiumUntil = new Date(data.premium_until);
                        const now = new Date();
                        setIsPremium(premiumUntil > now);
                    }

                    // Устанавливаем тему
                    if (data.theme_preference) {
                        const isDark = data.theme_preference === "dark";
                        setNightMode(isDark);
                        applyTheme(isDark);
                    }
                }
            } catch (error) {
                console.error("Ошибка загрузки профиля:", error);
            }
        };

        fetchUserData();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    // Безопасное применение темы
    const applyTheme = useCallback((isDark) => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.classList.add('light');
            document.documentElement.classList.remove('dark');
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }, []);

    // Переключение темы с сохранением в Supabase
    const toggleNightMode = useCallback(async () => {
        const newMode = !nightMode;
        setNightMode(newMode);
        applyTheme(newMode);

        // Сохраняем в Supabase если пользователь авторизован
        if (user?.id) {
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        theme_preference: newMode ? "dark" : "light",
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', user.id);

                if (error) throw error;
            } catch (error) {
                console.error("Ошибка сохранения темы:", error);
                localStorage.setItem("theme", newMode ? "dark" : "light");
            }
        } else {
            localStorage.setItem("theme", newMode ? "dark" : "light");
        }
    }, [nightMode, applyTheme, user?.id]);

    // Безопасное имя пользователя
    const userName = useMemo(() => {
        if (!userData?.full_name && !user?.user_metadata?.full_name) return 'User';
        const name = userData?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
        const cleanName = name.replace(/[<>]/g, '');
        return width < 640 ? cleanName.split(' ')[0] : cleanName;
    }, [userData?.full_name, user?.user_metadata?.full_name, user?.email, width]);

    // Проверка роли администратора
    const isAdmin = userData?.role === 'admin' || user?.email?.includes('admin');

    // Инициализация темы при первом рендере
    useEffect(() => {
        if (!userData?.theme_preference) {
            // Проверяем localStorage для неавторизованных или новых пользователей
            const savedTheme = localStorage.getItem("theme");
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

            const isDark = savedTheme === "dark" || (!savedTheme && prefersDark);
            setNightMode(isDark);
            applyTheme(isDark);
        }
    }, [userData?.theme_preference, applyTheme]);

    const handleLogout = async () => {
        try {
            await logout();
            setMobileMenuOpen(false);
            setUserData(null);
            setIsPremium(false);
        } catch (error) {
            console.error("Ошибка выхода:", error);
        }
    };

    return (
        <div className='bg-white dark:bg-gray-800 shadow-[0_3px_5px_#D7E3E7] dark:shadow-gray-900 relative z-50'>
            <div className="navbar flex justify-between px-4 sm:px-6 md:px-8 lg:px-10 bg-base-100 dark:bg-gray-800">

                {/* Логотип */}
                <NavLink to={"/"} className="flex items-center">
                    <button className='logo flex items-center transition-all duration-300 hover:scale-110'>
                        <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-r from-[#0AB685] to-[#1855D4] rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base md:text-lg">
                            EH
                        </div>
                        <h1 className="text-lg sm:text-xl md:text-2xl font-bold ml-1 sm:ml-2 text-gray-800 dark:text-white">
                            EduHelper<span className="text-xs ml-1 bg-gradient-to-r from-[#0AB685] to-[#1855D4] bg-clip-text text-transparent">Uz</span>
                        </h1>
                    </button>
                </NavLink>

                {/* ДЕСКТОПНОЕ МЕНЮ — В ЦЕНТРЕ */}
                <div className="hidden lg:flex flex-1 justify-center font-light font-sans">
                    {items.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `btn btn-ghost rounded-[10px] mx-1 lg:mx-2 text-base lg:text-xl transition-all duration-300 hover:bg-[#F1F5F9] dark:hover:bg-gray-700 ${isActive ? 'bg-[#1D4ED8] text-white dark:bg-blue-600' : 'text-[#575C69] dark:text-gray-300'}`}
                        >
                            {item.title}
                        </NavLink>
                    ))}
                </div>

                {/* Правая часть */}
                <div className='flex items-center gap-2 sm:gap-3'>

                    {/* Кнопка доната */}
                    <NavLink
                        to="/donate"
                        className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-full text-sm font-medium hover:shadow-lg transition-all duration-300"
                    >
                        <span className="text-lg">🎁</span>
                        <span>Support</span>
                    </NavLink>

                    {/* Премиум бейдж */}
                    {isPremium && (
                        <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-yellow-400 to-yellow-600 text-gray-900 rounded-full text-xs font-bold">
                            <span className="text-xs">⭐</span>
                            <span>PREMIUM</span>
                        </div>
                    )}

                    {/* Кнопка темы с ARIA-атрибутами */}
                    <button
                        className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300"
                        onClick={toggleNightMode}
                        aria-label={nightMode ? "Switch to light mode" : "Switch to dark mode"}
                    >
                        {nightMode ?
                            <span className="text-yellow-400 text-sm sm:text-base" aria-hidden="true">☀️</span> :
                            <span className="text-gray-700 text-sm sm:text-base" aria-hidden="true">🌙</span>
                        }
                    </button>

                    {/* Профиль / Логин */}
                    {isAuthenticated ? (
                        <div className="dropdown dropdown-end">
                            <div tabIndex={0} role="button" className="flex items-center gap-1 sm:gap-2 p-1 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                                <div className="avatar placeholder relative">
                                    {/* Премиум индикатор */}
                                    {isPremium && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white dark:border-gray-800"></div>
                                    )}
                                    <div className="flex justify-center items-center bg-gradient-to-r from-[#0AB685] to-[#1855D4] text-white rounded-full w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8">
                                        <span className="text-xs font-bold">
                                            {userName?.charAt(0).toUpperCase() || 'U'}
                                        </span>
                                    </div>
                                </div>
                                <span className="font-medium text-gray-800 dark:text-white text-sm sm:text-base hidden sm:block">
                                    {userName}
                                    {isPremium && <span className="ml-1 text-yellow-500">⭐</span>}
                                </span>
                            </div>
                            <ul tabIndex={0} className="dropdown-content menu bg-base-100 dark:bg-gray-800 rounded-box z-[1] w-48 sm:w-52 p-2 shadow">
                                <li><NavLink to="/profile" className="text-sm sm:text-base">Profile</NavLink></li>
                                <li><NavLink to="/achievements" className="text-sm sm:text-base">Achievements</NavLink></li>

                                {/* Кнопка апгрейда для обычных пользователей */}
                                {!isPremium && (
                                    <li>
                                        <NavLink to="/premium" className="text-sm sm:text-base bg-gradient-to-r from-yellow-400 to-yellow-600 text-gray-900 font-bold">
                                            ⭐ Upgrade to Premium
                                        </NavLink>
                                    </li>
                                )}

                                <li><NavLink to="/settings" className="text-sm sm:text-base">Settings</NavLink></li>
                                <li><NavLink to="/referrals" className="text-sm sm:text-base">Referral</NavLink></li>
                                <li><button className="btn btn-error btn-sm sm:btn-md mt-2" onClick={handleLogout}>Logout</button></li>
                            </ul>
                        </div>
                    ) : (
                        <NavLink
                            to="/login"
                            className="flex justify-center items-center w-16 sm:w-20 md:w-24 h-8 sm:h-9 md:h-10 bg-gradient-to-r from-[#0AB685] to-[#1855D4] text-sm sm:text-base font-bold text-white rounded-[20px] transition-all duration-300 hover:scale-105 hover:shadow-[0_3px_15px_rgba(0,0,0,0.3)]"
                        >
                            Login
                        </NavLink>
                    )}

                    {/* ГАМБУРГЕР — ТОЛЬКО НА МОБИЛКАХ И ПЛАНШЕТАХ */}
                    <button
                        className="lg:hidden btn btn-ghost btn-circle p-1 sm:p-2"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                        </svg>
                    </button>
                </div>
            </div>

            {/* МОБИЛЬНОЕ МЕНЮ — выпадает снизу */}
            {mobileMenuOpen && (
                <div className="lg:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col items-center py-3 sm:py-4 space-y-2 sm:space-y-3 font-light font-sans">
                        {items.map(item => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={() => setMobileMenuOpen(false)}
                                className="text-lg sm:text-xl text-[#575C69] dark:text-gray-300 hover:text-blue-600 py-1 sm:py-2 transition-colors duration-200"
                            >
                                {item.title}
                            </NavLink>
                        ))}


                        <NavLink
                            to="/forum"
                            className="text-lg sm:text-xl text-[#575C69] dark:text-gray-300 hover:text-blue-600 py-1 sm:py-2 transition-colors duration-200"
                        >
                            Forum
                        </NavLink>
                        <NavLink
                            to="/forum"
                            onClick={() => setMobileMenuOpen(false)}
                            className="text-lg sm:text-xl text-[#575C69] dark:text-gray-300 hover:text-blue-600 py-1 sm:py-2 transition-colors duration-200"
                        >
                            Forum
                        </NavLink>

                        {/* Донат в мобильном меню */}
                        <NavLink
                            to="/donate"
                            onClick={() => setMobileMenuOpen(false)}
                            className="text-lg sm:text-xl text-[#575C69] dark:text-gray-300 hover:text-blue-600 py-1 sm:py-2 transition-colors duration-200"
                        >
                            🎁 Donate
                        </NavLink>

                        {/* Кнопка апгрейда в мобильном меню */}
                        {!isPremium && isAuthenticated && (
                            <NavLink
                                to="/premium"
                                onClick={() => setMobileMenuOpen(false)}
                                className="text-lg sm:text-xl bg-gradient-to-r from-yellow-400 to-yellow-600 text-gray-900 font-bold py-2 px-4 rounded-full"
                            >
                                ⭐ Upgrade to Premium
                            </NavLink>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Navbar;