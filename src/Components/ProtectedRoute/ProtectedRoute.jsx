// src/Components/ProtectedRoute/ProtectedRoute.jsx
import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/ReactContext.jsx';
import { supabase } from '../../lib/supabase'; // Добавьте импорт!

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading, isAuthenticated } = useAuth();
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
        
        // 2. Fallback на статичные email (на всякий случай)
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-lg">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  // Если пользователь не авторизован
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Проверка на админа
  if (adminOnly) {
    if (adminLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-green-600 border-r-transparent"></div>
            <p className="mt-4 text-lg">Admin tekshirilmoqda...</p>
          </div>
        </div>
      );
    }

    if (!isAdmin) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center p-8">
            <h1 className="text-3xl font-bold text-red-600 mb-4">🚫 Ruxsat yo'q</h1>
            <p>Bu sahifani faqat administratorlar ko'ra oladi</p>
            <button
              onClick={() => window.location.href = '/'}
              className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Bosh sahifaga qaytish
            </button>
          </div>
        </div>
      );
    }
  }

  return children;
};

export default ProtectedRoute;