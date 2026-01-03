// src/services/userService.js
import { supabase } from './supabaseClient';

export const userService = {
  // Получить профиль пользователя
  async getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          courses_created:courses(count),
          enrollments:enrollments(count)
        `)
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error);
      return null;
    }
  },

  // Обновить профиль
  async updateProfile(userId, updates) {
    try {
      const allowedUpdates = {
        username: updates.username,
        full_name: updates.fullName || updates.full_name,
        avatar_url: updates.avatarUrl || updates.avatar_url,
        bio: updates.bio,
        location: updates.location,
        website: updates.website,
        language: updates.language || 'uz',
        notifications_enabled: updates.notificationsEnabled !== false,
        email_notifications: updates.emailNotifications !== false
      };

      // Удаляем undefined значения
      Object.keys(allowedUpdates).forEach(key => 
        allowedUpdates[key] === undefined && delete allowedUpdates[key]
      );

      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...allowedUpdates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка обновления профиля:', error);
      throw error;
    }
  },

  // Получить всех пользователей
  async getAllUsers(options = {}) {
    try {
      let query = supabase
        .from('profiles')
        .select(`
          *,
          courses_created:courses(count),
          enrollments:enrollments(count)
        `)
        .order('created_at', { ascending: false });

      // Поиск по имени или username
      if (options.search) {
        query = query.or(`full_name.ilike.%${options.search}%,username.ilike.%${options.search}%`);
      }

      // Фильтрация по роли
      if (options.role) {
        query = query.eq('role', options.role);
      }

      // Пагинация
      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      
      return { 
        data: data || [], 
        total: count || 0 
      };
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
      return { data: [], total: 0 };
    }
  },

  // Обновить статус активности
  async updateActiveStatus(userId, isActive) {
    try {
      const { error } = await supabase
        .from('user_activity')
        .upsert({
          user_id: userId,
          is_active: isActive,
          last_active_at: new Date().toISOString()
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Ошибка обновления статуса:', error);
      throw error;
    }
  },

  // Получить активных пользователей
  async getActiveUsers(limit = 10) {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data, error } = await supabase
        .from('user_activity')
        .select(`
          *,
          user:profiles(username, full_name, avatar_url)
        `)
        .gt('last_active_at', yesterday.toISOString())
        .eq('is_active', true)
        .order('last_active_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Ошибка загрузки активных пользователей:', error);
      return [];
    }
  },

  // Изменить роль пользователя (админ)
  async updateUserRole(userId, role) {
    try {
      const allowedRoles = ['user', 'teacher', 'admin'];
      if (!allowedRoles.includes(role)) {
        throw new Error('Недопустимая роль');
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ 
          role,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка обновления роли:', error);
      throw error;
    }
  },

  // Получить статистику пользователя
  async getUserStats(userId) {
    try {
      // Прогресс по курсам
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('progress')
        .eq('user_id', userId);

      if (enrollError) throw enrollError;

      // Пройденные уроки
      const { count: completedLessons, error: lessonsError } = await supabase
        .from('lesson_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_completed', true);

      if (lessonsError) throw lessonsError;

      // Созданные курсы
      const { count: createdCourses, error: coursesError } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', userId);

      if (coursesError) throw coursesError;

      // Достижения
      const { data: achievements, error: achievementsError } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId);

      if (achievementsError) throw achievementsError;

      const averageProgress = enrollments && enrollments.length > 0 
        ? enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length
        : 0;

      return {
        enrolledCourses: enrollments?.length || 0,
        completedLessons: completedLessons || 0,
        createdCourses: createdCourses || 0,
        averageProgress: Math.round(averageProgress),
        achievementsCount: achievements?.length || 0,
        totalStudyHours: Math.round((completedLessons || 0) * 0.5) // Примерная оценка
      };
    } catch (error) {
      console.error('Ошибка загрузки статистики пользователя:', error);
      return {
        enrolledCourses: 0,
        completedLessons: 0,
        createdCourses: 0,
        averageProgress: 0,
        achievementsCount: 0,
        totalStudyHours: 0
      };
    }
  },

  // Получить уведомления пользователя
  async getUserNotifications(userId, options = {}) {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (options.unreadOnly) {
        query = query.eq('is_read', false);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Ошибка загрузки уведомлений:', error);
      return [];
    }
  },

  // Отметить уведомление как прочитанное
  async markNotificationAsRead(notificationId) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка отметки уведомления:', error);
      throw error;
    }
  },

  // Отметить все уведомления как прочитанные
  async markAllNotificationsAsRead(userId) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return { success: true, message: 'Все уведомления отмечены как прочитанные' };
    } catch (error) {
      console.error('Ошибка отметки всех уведомлений:', error);
      throw error;
    }
  }
};