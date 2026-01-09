// src/Components/ProtectedRoute/ProtectedRoute.jsx
import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/ReactContext.jsx';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!adminOnly || !user?.email) return;
      
      setAdminLoading(true);
      try {
        // 1. Проверяем по базе данных
        const { data: adminUsers } = await supabase
          .from('admin_users')
          .select('email, role, is_active')
          .eq('is_active', true)
          .in('role', ['admin', 'super_admin']);

        const adminEmails = adminUsers?.map(u => u.email) || [];
        
        // 2. Fallback на статичные email
        const fallbackAdmins = ['bbaxromov14@gmail.com', 'eduhelperuz@gmail.com'];
        
        // 3. Проверяем email пользователя
        const isAdminUser = adminEmails.includes(user.email) || 
                           fallbackAdmins.includes(user.email) ||
                           user.role === 'admin' || 
                           user.role === 'super_admin';
        
        setIsAdmin(isAdminUser);
      } catch (error) {
        console.error('Admin check error:', error);
        // Если база недоступна, проверяем только статичные email
        const fallbackAdmins = ['bbaxromov14@gmail.com', 'eduhelperuz@gmail.com'];
        setIsAdmin(fallbackAdmins.includes(user.email));
      } finally {
        setAdminLoading(false);
      }
    };

    if (adminOnly && user) {
      checkAdmin();
    }
  }, [adminOnly, user]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-black">
        <div className="text-center">
          <div className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-6 text-xl font-semibold text-gray-700 dark:text-gray-300">
            {t('loading')}
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Navigate 
        to="/login" 
        replace 
        state={{ 
          from: window.location.pathname,
          message: t('authentication_required')
        }} 
      />
    );
  }

  // Admin check
  if (adminOnly) {
    if (adminLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-black">
          <div className="text-center">
            <div className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-green-600 border-r-transparent"></div>
            <p className="mt-6 text-xl font-semibold text-gray-700 dark:text-gray-300">
              {t('admin_checking')}
            </p>
          </div>
        </div>
      );
    }

    if (!isAdmin) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-50 dark:from-gray-900 dark:to-black">
          <div className="text-center p-8 max-w-md mx-auto">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
                <span className="text-4xl">🚫</span>
              </div>
              <h1 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-3">
                {t('access_denied')}
              </h1>
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                {t('admin_only_page')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t('unauthorized')}
              </p>
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:scale-105 transition-transform shadow-lg"
            >
              {t('back_to_home')}
            </button>
            <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-bold">{user?.email}</span>
                <br />
                <span className="text-xs text-gray-500">
                  User ID: {user?.id?.substring(0, 8)}...
                </span>
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

  // All checks passed - render children
  return children;
};

export default ProtectedRoute;