// src/Components/ProtectedRoute/ProtectedRoute.jsx (НОВЫЙ файл)
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/ReactContext.jsx';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading, isAuthenticated } = useAuth();

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
    const adminEmails = ['bbaxromov14@gmail.com', 'eduhelperuz@gmail.com'];
    const isAdmin = adminEmails.includes(user.email) || user.role === 'admin';
    
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