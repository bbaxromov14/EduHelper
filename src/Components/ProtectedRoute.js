import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, user } = useAuth();
  
  // 🔒 Проверка что children - валидный React элемент
  const isValidChildren = React.isValidElement(children);
  
  // 🔒 Дополнительная проверка аутентификации
  const isReallyAuthenticated = React.useMemo(() => {
    return Boolean(
      isAuthenticated && 
      user && 
      typeof isAuthenticated === 'boolean'
    );
  }, [isAuthenticated, user]);

  // 🔒 Проверка админских прав (если требуется)
  const hasAdminRights = React.useMemo(() => {
    if (!adminOnly) return true; // Если не требуется админ, пропускаем
    
    return Boolean(
      user?.is_admin === true || 
      user?.role === 'admin' ||
      user?.role === 'superadmin'
    );
  }, [user, adminOnly]);

  // 🔒 Безопасный рендер
  if (!isValidChildren) {
    console.error('ProtectedRoute: Invalid children');
    return <Navigate to="/login" replace />;
  }

  if (!isReallyAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !hasAdminRights) {
    console.warn('ProtectedRoute: User lacks admin privileges', { user });
    return <Navigate to="/" replace />; // Или на /login, или /access-denied
  }

  return children;
};

export default ProtectedRoute;