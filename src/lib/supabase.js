import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uuppgfdgcrzewxfjpxkc.supabase.co'
const supabaseAnonKey = 'sb_publishable_AGCtOWD0jWK0gEeShEqQBA_jtfWs5Ps'

// Основной клиент с Realtime поддержкой
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// ==================== ФУНКЦИИ ДЛЯ ФОРУМА ====================

export const forumApi = {
  // Получить сообщения форума
  getForumMessages: async () => {
    try {
      const { data, error } = await supabase
        .from('forum_messages')
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url,
            username
          ),
          replies:forum_messages!parent_id (
            id,
            content,
            created_at,
            image_url,
            user_id,
            profiles:user_id (
              full_name,
              avatar_url
            )
          ),
          reactions:message_reactions!message_reactions_message_id_fkey (
            id,
            reaction,
            user_id,
            profiles:user_id (
              full_name,
              avatar_url
            )
          )
        `)
        .is('parent_id', null)
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error)
      return []
    }
  },

  // Получить больше сообщений (для пагинации)
  getMoreMessages: async (lastCreatedAt) => {
    try {
      const { data, error } = await supabase
        .from('forum_messages')
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url,
            username
          ),
          replies:forum_messages!parent_id (
            id,
            content,
            created_at,
            image_url,
            user_id,
            profiles:user_id (
              full_name,
              avatar_url
            )
          ),
          reactions:message_reactions!message_reactions_message_id_fkey (
            id,
            reaction,
            user_id,
            profiles:user_id (
              full_name,
              avatar_url
            )
          )
        `)
        .is('parent_id', null)
        .lt('created_at', lastCreatedAt)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Ошибка загрузки истории:', error)
      return []
    }
  },

  // Отправить сообщение
  sendMessage: async (content, userId, imageUrl = null, parentId = null) => {
    try {
      const { data, error } = await supabase
        .from('forum_messages')
        .insert([
          {
            content,
            user_id: userId,
            image_url: imageUrl,
            parent_id: parentId,
            type: imageUrl ? 'image' : 'text'
          }
        ])
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url,
            username
          ),
          replies:forum_messages!parent_id (
            id,
            content,
            created_at,
            image_url,
            user_id,
            profiles:user_id (
              full_name,
              avatar_url
            )
          ),
          reactions:message_reactions!message_reactions_message_id_fkey (
            id,
            reaction,
            user_id,
            profiles:user_id (
              full_name,
              avatar_url
            )
          )
        `)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error)
      throw error
    }
  },

  // Редактировать сообщение
  updateMessage: async (messageId, content, imageUrl = null) => {
    try {
      const { data, error } = await supabase
        .from('forum_messages')
        .update({
          content,
          image_url: imageUrl,
          edited_at: new Date().toISOString(),
          type: imageUrl ? 'image' : 'text'
        })
        .eq('id', messageId)
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url,
            username
          ),
          replies:forum_messages!parent_id (
            id,
            content,
            created_at,
            image_url,
            user_id,
            profiles:user_id (
              full_name,
              avatar_url
            )
          ),
          reactions:message_reactions!message_reactions_message_id_fkey (
            id,
            reaction,
            user_id,
            profiles:user_id (
              full_name,
              avatar_url
            )
          )
        `)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Ошибка редактирования сообщения:', error)
      throw error
    }
  },

  // Удалить сообщение
  deleteMessage: async (messageId) => {
    try {
      const { error } = await supabase
        .from('forum_messages')
        .delete()
        .eq('id', messageId)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Ошибка удаления сообщения:', error)
      throw error
    }
  },

  // Добавить реакцию
  addReaction: async (messageId, userId, reaction) => {
    try {
      const { data, error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: userId,
          reaction: reaction
        })
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Ошибка добавления реакции:', error)
      throw error
    }
  },

  // Удалить реакцию
  removeReaction: async (reactionId) => {
    try {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('id', reactionId)

      if (error) throw error
      return { success: true }
    } catch (error) {
      console.error('Ошибка удаления реакции:', error)
      throw error
    }
  },

  // Обновить реакцию
  updateReaction: async (reactionId, newReaction) => {
    try {
      const { data, error } = await supabase
        .from('message_reactions')
        .update({ 
          reaction: newReaction,
          created_at: new Date().toISOString()
        })
        .eq('id', reactionId)
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Ошибка обновления реакции:', error)
      throw error
    }
  },

  // Получить реакции сообщения
  getMessageReactions: async (messageId) => {
    try {
      const { data, error } = await supabase
        .from('message_reactions')
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .eq('message_id', messageId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Ошибка получения реакций:', error)
      return []
    }
  },

  // Получить ответы на сообщение
  getMessageReplies: async (messageId) => {
    try {
      const { data, error } = await supabase
        .from('forum_messages')
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .eq('parent_id', messageId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Ошибка получения ответов:', error)
      return []
    }
  },

  // Загрузить изображение для форума
  uploadForumImage: async (file, userId) => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${userId}/${Date.now()}.${fileExt}`
      const filePath = `forum/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Ошибка загрузки изображения:', error)
      throw error
    }
  },

  // Обновить онлайн статус
  updateOnlineStatus: async (userId, isOnline = true) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString()
        })
        .eq('id', userId)
        .select()

      if (error) throw error
      return data[0]
    } catch (error) {
      console.error('Ошибка обновления статуса:', error)
    }
  },

  // Получить онлайн пользователей
  getOnlineUsers: async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, is_online, last_seen')
        .eq('is_online', true)
        .order('last_seen', { ascending: false })
        .limit(20)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Ошибка получения онлайн пользователей:', error)
      return []
    }
  },

  // Поиск сообщений
  searchMessages: async (query) => {
    try {
      const { data, error } = await supabase
        .from('forum_messages')
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url,
            username
          )
        `)
        .or(`content.ilike.%${query}%,profiles.full_name.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Ошибка поиска сообщений:', error)
      return []
    }
  },

  // Получить детали сообщения по ID
  getMessageById: async (messageId) => {
    try {
      const { data, error } = await supabase
        .from('forum_messages')
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url,
            username
          ),
          replies:forum_messages!parent_id (
            id,
            content,
            created_at,
            image_url,
            user_id,
            profiles:user_id (
              full_name,
              avatar_url
            )
          ),
          reactions:message_reactions!message_reactions_message_id_fkey (
            id,
            reaction,
            user_id,
            profiles:user_id (
              full_name,
              avatar_url
            )
          )
        `)
        .eq('id', messageId)
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Ошибка получения сообщения:', error)
      throw error
    }
  }
}

// ==================== ФУНКЦИИ ДЛЯ ВИДЕО И ИЗОБРАЖЕНИЙ ====================

export const videoStorage = {
  uploadVideo: async (courseId, lessonId, file) => {
    const filePath = `videos/${courseId}/${lessonId}/${Date.now()}_${file.name}`
    
    const { data, error } = await supabase.storage
      .from('edhelper-videos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })
    
    if (error) throw error
    
    const { data: { publicUrl } } = supabase.storage
      .from('edhelper-videos')
      .getPublicUrl(filePath)
    
    return {
      path: filePath,
      url: publicUrl,
      size: file.size
    }
  },
  
  getVideoUrl: (filePath) => {
    const { data } = supabase.storage
      .from('edhelper-videos')
      .getPublicUrl(filePath)
    return data.publicUrl
  },

  // Загрузка изображений для форума
  uploadForumImage: async (file, userId) => {
    const filePath = `forum/${userId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
    
    const { data, error } = await supabase.storage
      .from('forum-images')
      .upload(filePath, file, {
        cacheControl: '86400',
        upsert: false
      })
    
    if (error) throw error
    
    const { data: { publicUrl } } = supabase.storage
      .from('forum-images')
      .getPublicUrl(filePath)
    
    return publicUrl
  }
}

// ==================== АУТЕНТИФИКАЦИЯ (ваши существующие функции) ====================

// Регистрация с email/password
export const signUpWithEmail = async (email, password, fullName) => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          email_verified: false
        }
      }
    })
    
    if (authError) throw authError
    
    // Создаем профиль после успешной регистрации
    if (authData.user) {
      await createUserProfile(authData.user.id, email, fullName)
    }
    
    return authData
  } catch (error) {
    console.error('Ошибка регистрации:', error)
    throw error
  }
}

// Вход с email/password
export const signInWithEmail = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) throw error
    
    // Обновляем онлайн статус при входе
    if (data.user) {
      await forumApi.updateOnlineStatus(data.user.id, true)
    }
    
    return data
  } catch (error) {
    console.error('Ошибка входа:', error)
    throw error
  }
}

// Вход через Google
export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
};

// Выход
export const signOut = async () => {
  try {
    // Обновляем статус перед выходом
    const user = await getCurrentUser()
    if (user) {
      await forumApi.updateOnlineStatus(user.id, false)
    }
    
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  } catch (error) {
    console.error('Ошибка выхода:', error)
    throw error
  }
}

// Получение текущего пользователя
export const getCurrentUser = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user || null
}

// Получение профиля пользователя
export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (error) {
    console.error('Ошибка получения профиля:', error)
    return null
  }
  
  return data
}

// Обновление профиля
export const updateUserProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
  
  if (error) throw error
  return data[0]
}

// Создание профиля
export const createUserProfile = async (userId, email, fullName) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        full_name: fullName,
        username: email.split('@')[0].toLowerCase(),
        role: 'user',
        is_online: true,
        last_seen: new Date().toISOString(),
        rating: 0,
        total_points: 0,
        theme_preference: 'light',
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.warn('Не удалось создать профиль:', error.message)
      return null
    }
    
    return data
  } catch (error) {
    console.error('Ошибка создания профиля:', error)
    return null
  }
}

// ==================== ОСТАЛЬНЫЕ ФУНКЦИИ (ваши существующие) ====================

// ФУНКЦИИ ДЛЯ КУРСОВ
export const courseApi = {
  getCourses: async () => {
    const { data, error } = await supabase
      .from('courses')
      .select(`*, lessons:lessons(*)`)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Ошибка загрузки курсов:', error)
      return []
    }
    
    return data
  },
  
  createCourse: async (courseData) => {
    const { data, error } = await supabase
      .from('courses')
      .insert([{
        title: courseData.title,
        description: courseData.description,
        image_url: courseData.imageUrl,
        is_free: courseData.isFree === 'free' || courseData.isFree === true,
        level: courseData.level,
        tags: courseData.tags ? 
          courseData.tags.split(',').map(t => t.trim()) : 
          [],
        lessons_count: 0,
        total_students: 0,
        rating: 0.0,
        status: 'active'
      }])
      .select()
    
    if (error) throw error
    return data[0]
  },
  
  deleteCourse: async (courseId) => {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId)
    
    if (error) throw error
    return true
  }
}

// ФУНКЦИИ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ
export const userApi = {
  getAllUsers: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Ошибка загрузки пользователей:', error)
      return []
    }
    
    return data
  },
  
  addPoints: async (userId, points) => {
    try {
      const { data: userData, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (fetchError) throw fetchError
      
      const hasPointsColumn = userData.hasOwnProperty('points')
      const currentPoints = hasPointsColumn ? (userData.points || 0) : 0
      const newPoints = currentPoints + parseInt(points)
      
      const updateData = {
        updated_at: new Date().toISOString()
      }
      
      if (hasPointsColumn) {
        updateData.points = newPoints
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
      
      if (error) throw error
      return data[0]
    } catch (error) {
      console.error('Ошибка добавления баллов:', error)
      throw error
    }
  },
  
  deleteUser: async (userId) => {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)
    
    if (error) throw error
    return true
  }
}

// ФУНКЦИИ ДЛЯ УРОКОВ
export const lessonApi = {
  getLessons: async (courseId) => {
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('order_number', { ascending: true })
    
    if (error) {
      console.error('Ошибка загрузки уроков:', error)
      return []
    }
    
    return data
  },
  
  updateLessonVideo: async (lessonId, videoUrl, duration) => {
    const { data, error } = await supabase
      .from('lessons')
      .update({
        video_url: videoUrl,
        video_duration: duration,
        has_video: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', lessonId)
      .select()
    
    if (error) throw error
    return data[0]
  },
  
  createLesson: async (courseId, lessonData) => {
    const { data, error } = await supabase
      .from('lessons')
      .insert([{
        course_id: courseId,
        title: lessonData.title,
        description: lessonData.description,
        order_number: lessonData.order || 1,
        has_video: false
      }])
      .select()
    
    if (error) throw error
    return data[0]
  }
}

// ПРОВЕРКА ПОДКЛЮЧЕНИЯ
export const checkSupabaseConnection = async () => {
  try {
    const { data: forumMessages, error: forumError } = await supabase
      .from('forum_messages')
      .select('count')
      .limit(1)
    
    const { data: buckets, error: storageError } = await supabase.storage
      .listBuckets()
    
    const { data: authData } = await supabase.auth.getUser()
    
    return {
      success: true,
      forum: forumError ? '❌ Ошибка' : '✅ Работает',
      storage: buckets?.length ? '✅ Работает' : '❌ Нет buckets',
      authentication: authData?.user ? '✅ Работает' : '⚠️ Не авторизован',
      forumMessagesCount: forumMessages?.[0]?.count || 0
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      forum: '❌ Ошибка',
      storage: '❌ Ошибка',
      authentication: '❌ Ошибка'
    }
  }
}

// Дополнительно к вашим функциям:
export const checkDeviceLimit = async (deviceId) => {
  const { data, error } = await supabase
    .from('device_tracking')
    .select('count')
    .eq('device_id', deviceId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return {
    count: data?.count || 0,
    limitExceeded: data?.count >= 3
  };
};