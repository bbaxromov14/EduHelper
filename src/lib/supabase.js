import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uuppgfdgcrzewxfjpxkc.supabase.co'
const supabaseAnonKey = 'sb_publishable_AGCtOWD0jWK0gEeShEqQBA_jtfWs5Ps'

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

export const forumApi = {
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
          message_reactions (
            id,
            user_id,
            reaction_type,
            profiles:user_id (
              full_name
            )
          )
        `)
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error)
      return []
    }
  },

  addReaction: async (messageId, userId, reactionType) => {
    try {
      const { data: existingReaction } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('reaction_type', reactionType)
        .single()

      if (existingReaction) {
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingReaction.id)
        
        if (error) throw error
        return { deleted: true, reactionId: existingReaction.id }
      }

      const { data: oldReaction } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .single()

      if (oldReaction) {
        await supabase
          .from('message_reactions')
          .delete()
          .eq('id', oldReaction.id)
      }

      const { data, error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: userId,
          reaction_type: reactionType,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Ошибка добавления реакции:', error)
      throw error
    }
  },

  removeReaction: async (reactionId) => {
    try {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('id', reactionId)
      
      if (error) throw error
    } catch (error) {
      console.error('Ошибка удаления реакции:', error)
      throw error
    }
  },

  deleteMessage: async (messageId) => {
    try {
      const { error: reactionsError } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
      
      if (reactionsError) throw reactionsError

      const { error } = await supabase
        .from('forum_messages')
        .delete()
        .eq('id', messageId)
      
      if (error) throw error
    } catch (error) {
      console.error('Ошибка удаления сообщения:', error)
      throw error
    }
  },

  sendMessage: async (content, userId, imageUrl = null, replyToId = null) => {
    try {
      const messageData = {
        content,
        user_id: userId,
        type: imageUrl ? 'image' : 'text',
        created_at: new Date().toISOString()
      }

      if (imageUrl) {
        messageData.image_url = imageUrl
      }
      if (replyToId) {
        messageData.reply_to_id = replyToId
      }

      const { data, error } = await supabase
        .from('forum_messages')
        .insert([messageData])
        .select(`
          *,
          profiles:user_id (
            full_name,
            avatar_url,
            username
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

// ==================== АУТЕНТИФИКАЦИЯ ====================

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

// ==================== ОСТАЛЬНЫЕ ФУНКЦИИ ====================

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

// Проверка лимита устройств
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