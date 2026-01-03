// utils/adminUtils.js
export const adminUtils = {
    // Проверка прав администратора
    hasPermission: (adminData, permission) => {
      if (!adminData) return false;
      
      // Если super_admin - все права
      if (adminData.role === 'super_admin') return true;
      
      // Проверка permissions из JSONB
      if (adminData.permissions && Array.isArray(adminData.permissions)) {
        return adminData.permissions.includes(permission);
      }
      
      // Если permissions в виде строки JSON
      if (typeof adminData.permissions === 'string') {
        try {
          const perms = JSON.parse(adminData.permissions);
          return Array.isArray(perms) && perms.includes(permission);
        } catch (e) {
          console.error('Ошибка парсинга permissions:', e);
          return false;
        }
      }
      
      return false;
    },
  
    // Получить список всех прав
    getAllPermissions: () => [
      'manage_courses',
      'manage_lessons',
      'manage_users',
      'view_reports',
      'manage_admins',
      'manage_settings',
      'manage_content',
      'view_analytics'
    ],
  
    // Проверка email в списке админов
    isAdminEmail: (email) => {
      const adminEmails = [
        'bbaxromov14@gmail.com',
        'eduhelperuz@gmail.com'
      ];
      return adminEmails.includes(email);
    }
  };