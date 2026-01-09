import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/ReactContext.jsx';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';

const ProtectedRoute = ({ 
  children, 
  adminOnly = false, 
  requiredRoles = [],
  redirectPath = '/login'
}) => {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Проверка прав и авторизации
  useEffect(() => {
    const checkPermissions = async () => {
      setChecking(true);
      
      // Если не авторизован, просто завершаем проверку
      if (!isAuthenticated || !user) {
        setChecking(false);
        return;
      }
      
      // Если требуется проверка администратора
      if (adminOnly && user?.email) {
        setAdminLoading(true);
        
        try {
          // Способ 1: Сначала проверим статические email
          const fallbackAdmins = ['bbaxromov14@gmail.com', 'eduhelperuz@gmail.com'];
          
          if (fallbackAdmins.includes(user.email)) {
            setIsAdmin(true);
            setAdminLoading(false);
            setChecking(false);
            return;
          }
          
          // Способ 2: Проверяем в базе данных с безопасным запросом
          const { data: adminUsers, error: adminError } = await supabase
            .from('admin_users')
            .select('email, role, is_active')
            .eq('is_active', true)
            .eq('email', user.email) // Ищем конкретный email
            .in('role', ['admin', 'super_admin']); // Проверяем роль
          
          if (adminError) {
            console.error('Admin check database error:', adminError);
            // Если ошибка БД, проверяем только статические email
            setIsAdmin(fallbackAdmins.includes(user.email));
          } else {
            // Если нашли пользователя в таблице админов
            const isAdminUser = adminUsers && adminUsers.length > 0;
            setIsAdmin(isAdminUser);
          }
          
        } catch (error) {
          console.error('Admin check error:', error);
          // При любой ошибке проверяем статические email
          const fallbackAdmins = ['bbaxromov14@gmail.com', 'eduhelperuz@gmail.com'];
          setIsAdmin(fallbackAdmins.includes(user.email));
        } finally {
          setAdminLoading(false);
        }
      } else {
        // Если не требуется проверка админа, сразу завершаем
        setIsAdmin(false);
      }
      
      setChecking(false);
    };

    // Добавляем небольшую задержку для предотвращения мигания
    const timer = setTimeout(() => {
      checkPermissions();
    }, 100);

    return () => clearTimeout(timer);
  }, [adminOnly, user, isAuthenticated, location]);

  // Отображаем загрузку
  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block h-14 w-14 animate-spin rounded-full border-[5px] border-solid border-blue-600 border-r-transparent dark:border-blue-500"></div>
          <p className="mt-6 text-xl font-medium text-gray-700 dark:text-gray-300">
            {t('loading') || 'Yuklanmoqda...'}
          </p>
        </div>
      </div>
    );
  }

  // Если пользователь не авторизован
  if (!isAuthenticated || !user) {
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  // Если требуется проверка администратора и загружается
  if (adminOnly && adminLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block h-14 w-14 animate-spin rounded-full border-[5px] border-solid border-green-600 border-r-transparent dark:border-green-500"></div>
          <p className="mt-6 text-xl font-medium text-gray-700 dark:text-gray-300">
            {t('checking_admin') || 'Admin tekshirilmoqda...'}
          </p>
        </div>
      </div>
    );
  }

  // Если требуется админ, но пользователь не админ
  if (adminOnly && !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="mx-auto w-20 h-20 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
            <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0H8m10-10v4a2 2 0 01-2 2H8a2 2 0 01-2-2V7a2 2 0 012-2h8a2 2 0 012 2z" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
            {t('access_denied') || '🚫 Ruxsat yo\'q'}
          </h1>
          
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            {t('not_authorized') || 'Sizga ruxsat berilmagan'}
          </p>
          
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
            {t('admin_only') || 'Bu sahifani faqat administratorlar ko\'ra oladi'}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              {t('back_home') || 'Bosh sahifaga qaytish'}
            </button>
            
            <button
              onClick={() => window.location.href = '/profile'}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              {t('profile') || 'Profil'}
            </button>
          </div>
          
          {/* Отладочная информация для разработки */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg text-left">
              <p className="text-sm font-mono text-gray-600 dark:text-gray-400 mb-2">
                <span className="font-semibold">Email:</span> {user.email}
              </p>
              <p className="text-sm font-mono text-gray-600 dark:text-gray-400">
                <span className="font-semibold">Admin status:</span> {isAdmin ? '✅ Yes' : '❌ No'}
              </p>
              <p className="text-sm font-mono text-gray-600 dark:text-gray-400 mt-2">
                <span className="font-semibold">Path:</span> {location.pathname}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Все проверки пройдены, рендерим children
  return children;
};

export default ProtectedRoute;