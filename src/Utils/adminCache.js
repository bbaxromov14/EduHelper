// utils/adminCache.js (создайте новый файл)
let adminCache = {
    emails: [],
    lastUpdated: 0
  };
  
  export const getAdminEmails = async () => {
    const now = Date.now();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 минут
    
    // Возвращаем кеш если он свежий
    if (adminCache.emails.length > 0 && (now - adminCache.lastUpdated) < CACHE_DURATION) {
      return adminCache.emails;
    }
    
    try {
      const { data: adminUsers } = await supabase
        .from('admin_users')
        .select('email')
        .eq('is_active', true)
        .in('role', ['admin', 'super_admin']);
      
      const emails = adminUsers?.map(u => u.email) || [];
      
      // Обновляем кеш
      adminCache = {
        emails: [...emails, 'bbaxromov14@gmail.com', 'eduhelperuz@gmail.com'], // Добавляем fallback
        lastUpdated: now
      };
      
      return adminCache.emails;
    } catch (error) {
      console.error('Failed to fetch admins:', error);
      // Возвращаем старый кеш или fallback
      return adminCache.emails.length > 0 
        ? adminCache.emails 
        : ['bbaxromov14@gmail.com', 'eduhelperuz@gmail.com'];
    }
  };
  
  // В ProtectedRoute.jsx
  import { getAdminEmails } from '../../utils/adminCache';
  
  // Внутри checkAdmin:
  const adminEmails = await getAdminEmails();
  const isAdminUser = adminEmails.includes(user.email) || 
                     user.role === 'admin' || 
                     user.role === 'super_admin';