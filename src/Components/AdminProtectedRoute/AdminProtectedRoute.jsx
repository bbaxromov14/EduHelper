import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/ReactContext';
import { supabase } from '../../lib/supabase';

const AdminProtectedRoute = ({ children }) => {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user?.id) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Проверяем роль в Supabase таблице 'profiles'
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setIsAdmin(data.role === 'admin' || data.role === 'super_admin');
        } else {
          // Если профиля нет, проверяем email (для совместимости)
          setIsAdmin(user.email === 'bbaxromov14@gmail.com' ||
            user.email === 'eduhelperuz@gmail.com');
        }
      } catch (error) {
        console.error(t('admin_check_error') || "Admin check error:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [user, t]);

  const isValidChildren = React.isValidElement(children);

  if (!isValidChildren) {
    console.error(t('invalid_children_error') || 'AdminProtectedRoute: Invalid children');
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-blue-50 dark:from-gray-900 dark:to-blue-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-gray-700 dark:text-gray-300">
            {t('checking_access') || 'Проверка доступа...'}
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {t('please_wait') || 'Пожалуйста, подождите'}
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-600 to-purple-800 p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 md:p-12 text-center max-w-lg w-full">
          <h1 className="text-6xl font-bold text-white mb-4 animate-pulse">403</h1>
          <div className="text-4xl mb-4">🚫</div>
          <p className="text-2xl text-white mb-4 font-bold">
            {t('admin_access_required') || 'Доступ только для администраторов'}
          </p>
          <p className="text-white/80 mb-6 text-lg">
            {t('admin_access_description') || 'Эта страница доступна только пользователям с правами администратора.'}
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-4 px-8 py-4 bg-white text-purple-600 rounded-xl font-bold hover:scale-105 transition transform duration-200 hover:shadow-xl"
          >
            ← {t('back_to_home') || 'На главную'}
          </button>
          <div className="mt-8 text-white/60 text-sm">
            <p>{t('need_admin_access') || 'Нужен доступ администратора?'}</p>
            <p className="mt-1">
              {t('contact_support') || 'Свяжитесь с поддержкой: support@eduhelper.uz'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default AdminProtectedRoute;