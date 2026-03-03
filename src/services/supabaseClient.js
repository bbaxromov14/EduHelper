// src/services/courseService.js (новый файл)
import { supabase } from '../lib/supabase';

export const courseService = {
  // Получить все курсы
  async getAllCourses() {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Ошибка загрузки курсов:', error);
      return [];
    }
  },

  // Создать новый курс
  async createCourse(courseData) {
    try {
      // Проверяем существование обязательных полей
      const requiredFields = ['title'];
      for (const field of requiredFields) {
        if (!courseData[field]) {
          throw new Error(`Обязательное поле ${field} отсутствует`);
        }
      }

      const { data, error } = await supabase
        .from('courses')
        .insert([{
          title: courseData.title,
          description: courseData.description || '',
          cover_image_url: courseData.imageUrl || null,
          is_free: courseData.isFree !== false, // по умолчанию true
          difficulty_level: courseData.level || 'beginner',
          tags: courseData.tags || [],
          lessons_count: courseData.lessons_count || 0,
          estimated_hours: courseData.estimated_hours || 10
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка создания курса:', error);
      throw error;
    }
  },

  // Получить курс по ID
  async getCourseById(id) {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка загрузки курса:', error);
      return null;
    }
  },

  // Обновить курс
  async updateCourse(id, updates) {
    try {
      const { data, error } = await supabase
        .from('courses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка обновления курса:', error);
      throw error;
    }
  },

  // Удалить курс
  async deleteCourse(id) {
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Ошибка удаления курса:', error);
      throw error;
    }
  }
};