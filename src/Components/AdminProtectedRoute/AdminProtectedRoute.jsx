import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/ReactContext';
import { supabase } from '../../lib/supabase'; // Импортируем Supabase

const AdminProtectedRoute = ({ children }) => {
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
          .eq('id', user.id) // В Supabase user.id вместо user.uid
          .single();

        if (error) throw error;
        
        if (data) {
          // Проверяем роль в профиле
          setIsAdmin(data.role === 'admin');
        } else {
          // Если профиля нет, проверяем email (для совместимости)
          setIsAdmin(user.email === 'bbaxromov14@gmail.com' || 
                    user.email === 'admin@eduhelper.uz');
        }
      } catch (error) {
        console.error("Admin check error:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [user]);

  const isValidChildren = React.isValidElement(children);

  if (!isValidChildren) {
    console.error('AdminProtectedRoute: Invalid children');
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Проверка доступа...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-600 to-purple-800">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 text-center">
          <h1 className="text-6xl font-bold text-white mb-6">403</h1>
          <p className="text-2xl text-white mb-4">Доступ только для администраторов</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="mt-8 px-8 py-4 bg-white text-purple-600 rounded-xl font-bold hover:scale-105 transition"
          >
            ← На главную
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default AdminProtectedRoute;