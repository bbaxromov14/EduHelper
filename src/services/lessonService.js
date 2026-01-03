// src/services/lessonService.js
import { supabase } from '../lib/supabase';

export const lessonService = {
  // =============== ВАШИ СУЩЕСТВУЮЩИЕ МЕТОДЫ ===============
  
async getCourse(courseId) {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')  // Просто все поля курса, без сложных отношений
      .eq('id', courseId)
      .single();

    if (error) {
      console.error('Ошибка Supabase в getCourse:', error);
      throw error;
    }

    if (!data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Критическая ошибка в getCourse:', error);
    return null;
  }
},

async getCourseLessons(courseId) {
  try {
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Ошибка загрузки уроков:', error);
    return [];
  }
},

  // Получить прогресс пользователя
  async getUserProgress(userId, courseId) {
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')  // Просто все поля прогресса
        .eq('user_id', userId)
        .eq('course_id', courseId);
  
      if (error) throw error;
  
      // Сортируем на клиенте по order_index урока (если есть)
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('id, order_index')
        .in('id', data.map(p => p.lesson_id));
  
      const lessonOrderMap = {};
      lessonsData?.forEach(l => {
        lessonOrderMap[l.id] = l.order_index;
      });
  
      // Сортируем прогресс по order_index урока
      return data.sort((a, b) => {
        const orderA = lessonOrderMap[a.lesson_id] || 0;
        const orderB = lessonOrderMap[b.lesson_id] || 0;
        return orderA - orderB;
      }) || [];
    } catch (error) {
      console.error('Ошибка загрузки прогресса:', error);
      return [];
    }
  },

// Обновить прогресс с проверкой существования
async updateProgress(userId, lessonId, courseId, completed, progressPercent) {
  try {
    // Сначала проверим существует ли запись
    const { data: existing, error: checkError } = await supabase
      .from('user_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle();

    if (checkError) throw checkError;

    let result;
    const updateData = {
      completed: completed,
      progress_percent: progressPercent,
      updated_at: new Date().toISOString(),
      last_accessed: new Date().toISOString()
    };

    if (existing) {
      // Обновляем существующую запись
      const { data, error } = await supabase
        .from('user_progress')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Создаем новую запись
      const { data, error } = await supabase
        .from('user_progress')
        .insert({
          user_id: userId,
          lesson_id: lessonId,
          course_id: courseId,
          ...updateData
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return result;
  } catch (error) {
    console.error('Ошибка сохранения прогресса:', error);
    throw error;
  }
},

  // =============== НОВЫЕ МЕТОДЫ ===============

  // Создать урок
  async createLesson(lessonData) {
    try {
      // Валидация
      if (!lessonData.courseId) {
        throw new Error('ID курса обязателен');
      }
      
      if (!lessonData.title) {
        throw new Error('Название урока обязательно');
      }

      // Получаем максимальный order_index для этого курса
      const { data: existingLessons } = await supabase
        .from('lessons')
        .select('order_index')
        .eq('course_id', lessonData.courseId)
        .order('order_index', { ascending: false })
        .limit(1);

      const nextOrderIndex = existingLessons && existingLessons.length > 0 
        ? existingLessons[0].order_index + 1 
        : 0;

      const formattedData = {
        course_id: lessonData.courseId,
        title: lessonData.title,
        description: lessonData.description || '',
        content: lessonData.content || '',
        video_url: lessonData.videoUrl || null,
        duration_minutes: lessonData.duration || lessonData.duration_minutes || 0,
        order_index: lessonData.order || lessonData.order_index || nextOrderIndex,
        is_preview: lessonData.isPreview || lessonData.is_preview || false,
        resources: lessonData.resources || [],
        attachments: lessonData.attachments || [],
        prerequisites: lessonData.prerequisites || [],
        learning_objectives: lessonData.learningObjectives || [],
        is_published: lessonData.isPublished !== false,
        author_id: lessonData.authorId || null
      };

      const { data, error } = await supabase
        .from('lessons')
        .insert([formattedData])
        .select()
        .single();

      if (error) throw error;
      
      // Обновляем количество уроков в курсе
      await this.updateLessonCount(lessonData.courseId);
      
      return data;
    } catch (error) {
      console.error('Ошибка создания урока:', error);
      throw error;
    }
  },

  // Получить урок по ID с дополнительной информацией
  async getLessonById(id, userId = null) {
    try {
      let query = supabase
        .from('lessons')
        .select(`
          *,
          course:courses(
            id,
            title,
            cover_image_url,
            author:profiles(username, avatar_url)
          ),
          progress:user_progress!left(*)
        `)
        .eq('id', id);

      if (userId) {
        query = query.eq('progress.user_id', userId);
      }

      const { data, error } = await query.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка загрузки урока:', error);
      return null;
    }
  },

  // Обновить урок
  async updateLesson(id, updates) {
    try {
      const formattedUpdates = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('lessons')
        .update(formattedUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка обновления урока:', error);
      throw error;
    }
  },

  // Удалить урок
  async deleteLesson(id) {
    try {
      // Получаем информацию об уроке перед удалением
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .select('course_id')
        .eq('id', id)
        .single();

      if (lessonError) throw lessonError;

      // Удаляем урок
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Обновляем количество уроков в курсе
      if (lesson?.course_id) {
        await this.updateLessonCount(lesson.course_id);
      }

      return { 
        success: true, 
        message: 'Урок успешно удален' 
      };
    } catch (error) {
      console.error('Ошибка удаления урока:', error);
      throw error;
    }
  },

// Отметить урок как пройденный
async markLessonCompleted(userId, lessonId, courseId) {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .upsert({
        user_id: userId,
        lesson_id: lessonId,
        course_id: courseId,
        completed: true,
        completed_at: new Date().toISOString(),
        progress_percent: 100,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,lesson_id', // Добавьте это
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) throw error;
    
    // Обновляем общий прогресс курса
    await this.updateCourseProgress(userId, courseId);
    
    return data;
  } catch (error) {
    console.error('Ошибка отметки урока:', error);
    throw error;
  }
},

  // Обновить общий прогресс курса
  async updateCourseProgress(userId, courseId) {
    try {
      // Получаем все уроки курса
      const lessons = await this.getCourseLessons(courseId);
      
      // Получаем прогресс пользователя по всем урокам
      const progress = await this.getUserProgress(userId, courseId);
      
      // Подсчитываем прогресс
      const totalLessons = lessons.length;
      const completedLessons = progress.filter(p => p.completed).length;
      
      const overallProgress = totalLessons > 0 
        ? Math.round((completedLessons / totalLessons) * 100)
        : 0;

      // Обновляем прогресс в таблице enrollments (если существует)
      const { error: enrollmentError } = await supabase
        .from('enrollments')
        .update({
          progress: overallProgress,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('course_id', courseId);

      if (enrollmentError && enrollmentError.code !== 'PGRST116') {
        console.warn('Не удалось обновить enrollment прогресс:', enrollmentError);
      }

      return overallProgress;
    } catch (error) {
      console.error('Ошибка обновления прогресса курса:', error);
      throw error;
    }
  },

  // Получить следующий урок
  async getNextLesson(lessonId, courseId) {
    try {
      // Получить текущий урок
      const { data: currentLesson, error: currentError } = await supabase
        .from('lessons')
        .select('order_index')
        .eq('id', lessonId)
        .single();

      if (currentError) throw currentError;

      // Получить следующий урок
      const { data: nextLesson, error: nextError } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .gt('order_index', currentLesson.order_index)
        .order('order_index', { ascending: true })
        .limit(1)
        .single();

      if (nextError && nextError.code !== 'PGRST116') {
        throw nextError;
      }

      return nextLesson;
    } catch (error) {
      console.error('Ошибка получения следующего урока:', error);
      return null;
    }
  },

  // Получить предыдущий урок
  async getPreviousLesson(lessonId, courseId) {
    try {
      // Получить текущий урок
      const { data: currentLesson, error: currentError } = await supabase
        .from('lessons')
        .select('order_index')
        .eq('id', lessonId)
        .single();

      if (currentError) throw currentError;

      // Получить предыдущий урок
      const { data: previousLesson, error: previousError } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .lt('order_index', currentLesson.order_index)
        .order('order_index', { ascending: false })
        .limit(1)
        .single();

      if (previousError && previousError.code !== 'PGRST116') {
        throw previousError;
      }

      return previousLesson;
    } catch (error) {
      console.error('Ошибка получения предыдущего урока:', error);
      return null;
    }
  },

  // Добавить комментарий к уроку
  async addComment(userId, lessonId, content) {
    try {
      if (!content || content.trim().length === 0) {
        throw new Error('Комментарий не может быть пустым');
      }

      const { data, error } = await supabase
        .from('lesson_comments')
        .insert([{
          user_id: userId,
          lesson_id: lessonId,
          content: content.trim(),
          is_edited: false
        }])
        .select(`
          *,
          user:profiles(username, avatar_url)
        `)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка добавления комментария:', error);
      throw error;
    }
  },

  // Получить комментарии к уроку
  async getComments(lessonId, options = {}) {
    try {
      let query = supabase
        .from('lesson_comments')
        .select(`
          *,
          user:profiles(username, avatar_url),
          replies:lesson_comments!parent_id(
            *,
            user:profiles(username, avatar_url)
          )
        `)
        .eq('lesson_id', lessonId)
        .is('parent_id', null) // Только родительские комментарии
        .order('created_at', { ascending: false });

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Ошибка загрузки комментариев:', error);
      return [];
    }
  },

  // Удалить комментарий
  async deleteComment(commentId, userId) {
    try {
      // Проверить, принадлежит ли комментарий пользователю
      const { data: comment, error: checkError } = await supabase
        .from('lesson_comments')
        .select('user_id')
        .eq('id', commentId)
        .single();

      if (checkError) throw checkError;

      if (comment.user_id !== userId) {
        throw new Error('Вы не можете удалить этот комментарий');
      }

      const { error } = await supabase
        .from('lesson_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      return { success: true, message: 'Комментарий удален' };
    } catch (error) {
      console.error('Ошибка удаления комментария:', error);
      throw error;
    }
  },

  // Добавить заметку к уроку
  async addNote(userId, lessonId, content) {
    try {
      const { data, error } = await supabase
        .from('lesson_notes')
        .insert([{
          user_id: userId,
          lesson_id: lessonId,
          content,
          timestamp: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Ошибка добавления заметки:', error);
      throw error;
    }
  },

  // Получить заметки пользователя к уроку
  async getUserNotes(userId, lessonId) {
    try {
      const { data, error } = await supabase
        .from('lesson_notes')
        .select('*')
        .eq('user_id', userId)
        .eq('lesson_id', lessonId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Ошибка загрузки заметок:', error);
      return [];
    }
  },

  // Получить количество уроков курса
  async getLessonCount(courseId) {
    try {
      const { count, error } = await supabase
        .from('lessons')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', courseId)
        .eq('is_published', true);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Ошибка подсчета уроков:', error);
      return 0;
    }
  },

  // Обновить количество уроков в курсе
  async updateLessonCount(courseId) {
    try {
      const lessonCount = await this.getLessonCount(courseId);
      
      const { error } = await supabase
        .from('courses')
        .update({
          lessons_count: lessonCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', courseId);

      if (error) throw error;
      return lessonCount;
    } catch (error) {
      console.error('Ошибка обновления количества уроков:', error);
      throw error;
    }
  },

  // Переупорядочить уроки
  async reorderLessons(courseId, newOrder) {
    try {
      const updates = newOrder.map((lessonId, index) => ({
        id: lessonId,
        order_index: index
      }));

      const { error } = await supabase
        .from('lessons')
        .upsert(updates);

      if (error) throw error;
      return { success: true, message: 'Уроки успешно переупорядочены' };
    } catch (error) {
      console.error('Ошибка переупорядочивания уроков:', error);
      throw error;
    }
  },

  // Получить статистику урока
  async getLessonStats(lessonId) {
    try {
      // Количество пользователей, которые прошли урок
      const { count: completedCount, error: completedError } = await supabase
        .from('user_progress')
        .select('*', { count: 'exact', head: true })
        .eq('lesson_id', lessonId)
        .eq('completed', true);

      if (completedError) throw completedError;

      // Количество комментариев
      const { count: commentsCount, error: commentsError } = await supabase
        .from('lesson_comments')
        .select('*', { count: 'exact', head: true })
        .eq('lesson_id', lessonId);

      if (commentsError) throw commentsError;

      // Среднее время просмотра
      const { data: progressData, error: progressError } = await supabase
        .from('user_progress')
        .select('progress_percent')
        .eq('lesson_id', lessonId);

      if (progressError) throw progressError;

      const avgProgress = progressData && progressData.length > 0
        ? progressData.reduce((sum, p) => sum + (p.progress_percent || 0), 0) / progressData.length
        : 0;

      return {
        completedCount: completedCount || 0,
        commentsCount: commentsCount || 0,
        avgProgress: Math.round(avgProgress),
        totalViews: progressData?.length || 0
      };
    } catch (error) {
      console.error('Ошибка получения статистики урока:', error);
      return {
        completedCount: 0,
        commentsCount: 0,
        avgProgress: 0,
        totalViews: 0
      };
    }
  }
};

export default lessonService;